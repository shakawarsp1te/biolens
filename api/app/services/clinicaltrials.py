"""
ClinicalTrials.gov API v2 client (PLAN.md Phase 3): NCT ID lookup,
sponsor/company search, drug/intervention search — plus the parsing logic
that turns a raw CT.gov study payload into BioLens's normalized shape.

Response shape verified directly against the live API
(https://clinicaltrials.gov/api/v2), not assumed — see
tests/fixtures/ctgov_*.json for captured real examples. No API key is
required; this is a public API.
"""

from __future__ import annotations

from typing import Any

import httpx

from app.core.config import get_settings
from app.models.domain import TrialPhase
from app.services.cache import CacheStore, get_cache_store

# CT.gov's `designModule.phases` is a list because a trial can span two
# phases (e.g. ["PHASE1", "PHASE2"] for a combined Phase I/II study). This
# maps every combination BioLens's categorical TrialPhase actually covers.
# EARLY_PHASE1 and NA (observational studies, mostly) have no equivalent in
# our scheme, so they map to None rather than being forced into a bucket
# that would misrepresent them.
_PHASE_COMBO_MAP: dict[frozenset[str], TrialPhase] = {
    frozenset({"PHASE1"}): TrialPhase.PHASE_I,
    frozenset({"PHASE1", "PHASE2"}): TrialPhase.PHASE_I_II,
    frozenset({"PHASE2"}): TrialPhase.PHASE_II,
    frozenset({"PHASE2", "PHASE3"}): TrialPhase.PHASE_II_III,
    frozenset({"PHASE3"}): TrialPhase.PHASE_III,
    frozenset({"PHASE4"}): TrialPhase.APPROVED,
}


def map_ctgov_phases(phases: list[str] | None) -> TrialPhase | None:
    """Translate CT.gov's `designModule.phases` list into our categorical
    TrialPhase, or None if it doesn't correspond to one of our buckets
    (EARLY_PHASE1, NA, or an unexpected combination)."""
    if not phases:
        return None
    return _PHASE_COMBO_MAP.get(frozenset(phases))


def parse_study_summary(raw_study: dict[str, Any]) -> dict[str, Any]:
    """Extract BioLens's normalized fields from one raw CT.gov study object.

    Works on both the single-study response (GET /studies/{nctId}, which has
    `protocolSection` at the top level) and one entry from a search response's
    `studies` array (same shape).
    """
    protocol = raw_study.get("protocolSection", {})
    identification = protocol.get("identificationModule", {})
    status = protocol.get("statusModule", {})
    sponsors = protocol.get("sponsorCollaboratorsModule", {})
    design = protocol.get("designModule", {})
    conditions = protocol.get("conditionsModule", {})
    arms = protocol.get("armsInterventionsModule", {})

    intervention_names = []
    for intervention in arms.get("interventions", []):
        name = intervention.get("name")
        if name:
            intervention_names.append(name)
    # Some search-field-limited responses only include armGroups, not a
    # top-level interventions list — fall back to arm group intervention
    # names (formatted like "Biological: JANX007") if that's all we have.
    if not intervention_names:
        for arm_group in arms.get("armGroups", []):
            for name in arm_group.get("interventionNames", []):
                intervention_names.append(name.split(":", 1)[-1].strip())

    primary_completion = status.get("primaryCompletionDateStruct", {}) or {}
    completion = status.get("completionDateStruct", {}) or {}

    return {
        "nct_id": identification.get("nctId"),
        "brief_title": identification.get("briefTitle"),
        "lead_sponsor": sponsors.get("leadSponsor", {}).get("name"),
        "overall_status": status.get("overallStatus"),
        "phase": map_ctgov_phases(design.get("phases")),
        "raw_phases": design.get("phases") or [],
        "enrollment_count": design.get("enrollmentInfo", {}).get("count"),
        "conditions": conditions.get("conditions", []),
        "interventions": sorted(set(intervention_names)),
        # A trial's own disclosed timeline (services/catalysts.py's source of
        # every catalyst date) -- each explicitly typed ESTIMATED or ACTUAL
        # by the sponsor, never inferred by BioLens.
        "primary_completion_date": primary_completion.get("date"),
        "primary_completion_date_type": primary_completion.get("type"),
        "completion_date": completion.get("date"),
        "completion_date_type": completion.get("type"),
    }


def study_mentions_intervention(raw_study: dict[str, Any], drug_name: str) -> bool:
    """Defensive matching logic: CT.gov's `query.intr` search does its own
    fuzzy/synonym matching server-side, so a result can come back without the
    exact drug name appearing anywhere in the record. This checks whether it
    actually does, case-insensitively, so callers can distinguish a confident
    match from a loose one."""
    needle = drug_name.strip().lower()
    if not needle:
        return False
    summary = parse_study_summary(raw_study)
    haystack = " ".join([summary["brief_title"] or "", *summary["interventions"]]).lower()
    return needle in haystack


class InvalidNctIdError(ValueError):
    """Raised when CT.gov rejects an NCT ID as malformed (HTTP 400) — a
    caller error, distinct from a well-formed ID that just doesn't exist
    (HTTP 404, which get_study reports as None). Discovered by hitting the
    real API during manual verification: a syntactically-off ID like
    "NCT00000000" 400s, while a well-formed but unassigned one like
    "NCT99999999" 404s — the two are not the same failure."""


class ClinicalTrialsClient:
    def __init__(
        self, *, http_client: httpx.AsyncClient | None = None, cache: CacheStore | None = None
    ):
        self._base_url = get_settings().clinicaltrials_api_base
        self._http_client = http_client
        self._cache = cache or get_cache_store()
        self._owns_client = http_client is None

    async def __aenter__(self) -> "ClinicalTrialsClient":
        if self._http_client is None:
            self._http_client = httpx.AsyncClient(base_url=self._base_url, timeout=10.0)
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        if self._owns_client and self._http_client is not None:
            await self._http_client.aclose()

    async def get_study(self, nct_id: str) -> dict[str, Any] | None:
        """NCT ID lookup. Returns the raw study payload, None if the ID is
        well-formed but no study exists (404), or raises InvalidNctIdError if
        CT.gov rejects the ID as malformed (400)."""
        cache_key = f"ctgov:study:{nct_id}"
        cached = await self._cache.get(cache_key)
        if cached is not None:
            return cached.value

        assert self._http_client is not None, "use `async with ClinicalTrialsClient() as client:`"
        response = await self._http_client.get(f"/studies/{nct_id}")
        if response.status_code == 400:
            raise InvalidNctIdError(f"'{nct_id}' is not a validly formatted NCT ID")
        if response.status_code == 404:
            return None
        response.raise_for_status()
        data = response.json()
        await self._cache.set(cache_key, data)
        return data

    async def search_by_sponsor(
        self, sponsor_name: str, *, page_size: int = 10
    ) -> list[dict[str, Any]]:
        """Sponsor/company search."""
        return await self._search(
            query_key="query.spons", query_value=sponsor_name, page_size=page_size
        )

    async def search_by_intervention(
        self, drug_name: str, *, page_size: int = 10
    ) -> list[dict[str, Any]]:
        """Drug/intervention search."""
        return await self._search(
            query_key="query.intr", query_value=drug_name, page_size=page_size
        )

    async def _search(
        self, *, query_key: str, query_value: str, page_size: int
    ) -> list[dict[str, Any]]:
        cache_key = f"ctgov:search:{query_key}:{query_value.lower()}:{page_size}"
        cached = await self._cache.get(cache_key)
        if cached is not None:
            return cached.value.get("studies", [])

        assert self._http_client is not None, "use `async with ClinicalTrialsClient() as client:`"
        response = await self._http_client.get(
            "/studies",
            params={
                query_key: query_value,
                "pageSize": page_size,
                "fields": "NCTId,BriefTitle,OverallStatus,Phase,LeadSponsorName,"
                "Condition,InterventionName",
            },
        )
        response.raise_for_status()
        data = response.json()
        await self._cache.set(cache_key, data)
        return data.get("studies", [])
