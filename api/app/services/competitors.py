"""
Competitor pipelines: for each of a company's pipeline assets, other
companies' active Phase 2+ industry trials aimed at the same target, from
ClinicalTrials.gov. Deterministic -- no LLM decides who competes with whom.

How a trial counts as targeting the same thing: the target's name appears
in the trial's title, official title, keywords, or a drug's own description
-- not merely anywhere in the record. A plain full-text search also matches
trials that only mention the target in eligibility criteria ("KRAS
wild-type" patients for an EGFR antibody), so those are excluded too.

The honest limit, shown in the app rather than hidden: a trial that names
only its drug ("adavosertib") and never its target ("WEE1") isn't found. An
empty result means "no active Phase 2+ trial names this target", not "no
competition".
"""

from __future__ import annotations

import asyncio
import logging
import re
import time
from typing import Any

import httpx

from app.services.cache import CacheStore, get_cache_store
from app.services.discovery import candidate_for_name, resolve_parent

logger = logging.getLogger("biolens.competitors")

_CACHE_TTL_SECONDS = 24 * 3600.0
# CT.gov rate-limits bursts (seen live: 429 partway through a 12-company run).
_MAX_RETRIES = 3
_RETRY_BACKOFF_SECONDS = 1.0
_MAX_COMPETITORS_PER_ASSET = 8
_MAX_TRIALS_SHOWN = 3

_FILTER = (
    "AREA[LeadSponsorClass]INDUSTRY AND AREA[Phase](PHASE2 OR PHASE3) AND "
    "AREA[OverallStatus](RECRUITING OR ACTIVE_NOT_RECRUITING OR NOT_YET_RECRUITING)"
)
_FIELDS = (
    "NCTId,LeadSponsorName,Phase,OverallStatus,BriefTitle,OfficialTitle,Keyword,"
    "InterventionName,InterventionDescription"
)

# Profile target strings -> terms trial records actually use. Anything not
# listed is used as written, minus any parenthetical.
_TARGET_ALIASES: dict[str, list[str]] = {
    "er": ["estrogen receptor", "ESR1"],
    "menin-kmt2a": ["menin"],
    "pi3kα": ["PI3Kα", "PI3K alpha", "PIK3CA"],
    "pan-ras": ["pan-RAS"],
    "pkc": ["PKC", "protein kinase C"],
}
_UNUSABLE_TARGET = re.compile(r"not specified|not disclosed|undisclosed|unknown|inferred", re.I)
_PHASE_RANK = {"PHASE3": 3, "PHASE2": 2, "PHASE1": 1, "EARLY_PHASE1": 0, "PHASE4": 4}
_PHASE_LABEL = {4: "Phase IV", 3: "Phase III", 2: "Phase II", 1: "Phase I", 0: "Early Phase I"}


def search_terms_for_target(target: str) -> list[str]:
    """[] when the profile's target isn't a usable search term."""
    if not target or _UNUSABLE_TARGET.search(target):
        return []
    base = re.sub(r"\(.*?\)", "", target).strip()
    if not base:
        return []
    return _TARGET_ALIASES.get(base.lower(), [base])


def _mentions_target(text: str, term: str) -> bool:
    lowered = text.lower()
    t = re.escape(term.lower())
    if not re.search(rf"(?<![a-z0-9]){t}(?![a-z0-9])", lowered):
        return False
    # "KRAS wild-type" describes the patients, not the drug's target.
    without_wild_type = re.sub(rf"{t}[\s-]*wild[\s-]*type", "", lowered)
    return re.search(rf"(?<![a-z0-9]){t}(?![a-z0-9])", without_wild_type) is not None


def _study_text(protocol: dict[str, Any]) -> str:
    ident = protocol.get("identificationModule", {})
    conditions = protocol.get("conditionsModule", {})
    arms = protocol.get("armsInterventionsModule", {}).get("interventions", [])
    return " | ".join(
        [
            ident.get("briefTitle", ""),
            ident.get("officialTitle", ""),
            " ".join(conditions.get("keywords") or []),
            *(i.get("description", "") for i in arms),
        ]
    )


def group_competitor_trials(
    studies: list[dict[str, Any]],
    *,
    terms: list[str],
    company_name: str,
    tracked: dict[str, str],
) -> list[dict[str, Any]]:
    """Pure function: raw CT.gov studies -> competitors, one per company
    (subsidiaries folded into their parent), most advanced first. `tracked`
    maps lowercased company names BioLens tracks to their ids."""
    own = candidate_for_name(company_name)
    by_sponsor: dict[str, dict[str, Any]] = {}
    for study in studies:
        protocol = study.get("protocolSection", {})
        lead = protocol.get("sponsorCollaboratorsModule", {}).get("leadSponsor", {}).get("name")
        if not lead or own.owns(lead):
            continue
        text = _study_text(protocol)
        if not any(_mentions_target(text, term) for term in terms):
            continue
        parent = resolve_parent(lead)
        name = parent.name if parent else lead
        ident = protocol.get("identificationModule", {})
        phases = protocol.get("designModule", {}).get("phases") or []
        rank = max((_PHASE_RANK.get(p, 0) for p in phases if p != "PHASE4"), default=0)
        interventions = [
            i.get("name")
            for i in protocol.get("armsInterventionsModule", {}).get("interventions", [])
            if i.get("name")
        ]
        entry = by_sponsor.setdefault(
            name,
            {
                "company": name,
                "ticker": parent.ticker if parent else None,
                "trackedCompanyId": tracked.get(name.lower()),
                "_rank": -1,
                "trialCount": 0,
                "drugs": [],
                "trials": [],
            },
        )
        entry["trialCount"] += 1
        entry["_rank"] = max(entry["_rank"], rank)
        for raw in interventions:
            drug = clean_drug_name(raw)
            if drug and drug not in entry["drugs"] and not _looks_generic(drug):
                entry["drugs"].append(drug)
        if len(entry["trials"]) < _MAX_TRIALS_SHOWN:
            entry["trials"].append(
                {
                    "nctId": ident.get("nctId"),
                    "title": ident.get("briefTitle"),
                    "phase": _phase_label(phases),
                    "status": protocol.get("statusModule", {}).get("overallStatus"),
                    "url": f"https://clinicaltrials.gov/study/{ident.get('nctId')}",
                }
            )

    competitors = sorted(
        by_sponsor.values(), key=lambda c: (c["_rank"], c["trialCount"]), reverse=True
    )[:_MAX_COMPETITORS_PER_ASSET]
    for c in competitors:
        c["mostAdvancedPhase"] = _PHASE_LABEL.get(c.pop("_rank"), "Phase II")
        c["drugs"] = c["drugs"][:4]
    return competitors


_GENERIC_INTERVENTIONS = re.compile(
    r"placebo|standard of care|chemotherapy|docetaxel|folfiri|folfox|"
    r"investigator'?s choice|best supportive|saline|radiotherapy|radiation|"
    r"lhrh|\bpet\b|imaging|biopsy|^azoles?$",
    re.I,
)


_DOSE = re.compile(r"\b\d+(\.\d+)?\s*(mg|mcg|µg|g|ml|mg/kg|mg/m2|iu)\b.*$", re.I)
_ARM_WORDS = re.compile(
    r"\s*[-–(]?\s*\b(monotherapy|combination|arm [a-z0-9]+|cohort [a-z0-9]+|"
    r"treatment group [a-z0-9]+|rp2d|dose (escalation|expansion)|oral dose.*)\b.*$",
    re.I,
)


def clean_drug_name(name: str) -> str:
    """ "S243249 600mg" -> "S243249", "BN104 monotherapy - rp2d" -> "BN104":
    CT.gov intervention names often carry dose and arm labels, which made
    one drug show up four times."""
    cleaned = re.sub(r"\s*\(.*?(\)|$)", "", name)
    cleaned = _DOSE.sub("", cleaned)
    cleaned = _ARM_WORDS.sub("", cleaned)
    return cleaned.strip(" -–,;:()")


def _phase_label(phases: list[str]) -> str:
    """["PHASE1", "PHASE2"] -> "Phase I/II", matching how the app writes phases."""
    labels = [_PHASE_LABEL[_PHASE_RANK.get(p, 0)] for p in phases]
    if not labels:
        return "Phase not listed"
    return "Phase " + "/".join(label.removeprefix("Phase ") for label in labels)


def _looks_generic(name: str) -> bool:
    return bool(_GENERIC_INTERVENTIONS.search(name))


async def _search(
    term: str, *, http_client: httpx.AsyncClient, cache: CacheStore
) -> list[dict[str, Any]]:
    key = f"competitors:ctgov:{term.lower()}"
    cached = await cache.get(key)
    if cached is not None and time.time() - cached.fetched_at < _CACHE_TTL_SECONDS:
        return cached.value["studies"]
    params = {"query.term": term, "filter.advanced": _FILTER, "pageSize": 100, "fields": _FIELDS}
    for attempt in range(_MAX_RETRIES + 1):
        response = await http_client.get("/studies", params=params)
        if response.status_code != 429 or attempt == _MAX_RETRIES:
            break
        await asyncio.sleep(_RETRY_BACKOFF_SECONDS * 2**attempt)
    response.raise_for_status()
    studies = response.json().get("studies", [])
    await cache.set(key, {"studies": studies})
    return studies


async def get_competitors_for_company(
    company: dict[str, Any],
    *,
    http_client: httpx.AsyncClient,
    tracked: dict[str, str],
    cache: CacheStore | None = None,
) -> list[dict[str, Any]]:
    """One entry per pipeline asset with a searchable target. An asset
    whose target isn't specified in its profile is listed with
    `searchable: false` so the app can say why it has no comparison."""
    cache = cache or get_cache_store()
    results = []
    for asset in company.get("pipeline", []):
        terms = search_terms_for_target(asset.get("target", ""))
        if not terms:
            results.append(
                {
                    "drugName": asset.get("drugName"),
                    "target": asset.get("target"),
                    "searchable": False,
                    "available": True,
                    "searchTerms": [],
                    "competitors": [],
                }
            )
            continue
        studies: dict[str, dict[str, Any]] = {}
        try:
            for term in terms:
                for study in await _search(term, http_client=http_client, cache=cache):
                    ident = study.get("protocolSection", {}).get("identificationModule", {})
                    if nct := ident.get("nctId"):
                        studies[nct] = study
        except httpx.HTTPError:
            logger.exception("competitor lookup failed for %s", asset.get("drugName"))
            results.append(
                {
                    "drugName": asset.get("drugName"),
                    "target": asset.get("target"),
                    "searchable": True,
                    "available": False,
                    "searchTerms": terms,
                    "competitors": [],
                }
            )
            continue
        results.append(
            {
                "drugName": asset.get("drugName"),
                "target": asset.get("target"),
                "searchable": True,
                "available": True,
                "searchTerms": terms,
                "competitors": group_competitor_trials(
                    list(studies.values()),
                    terms=terms,
                    company_name=company.get("name", ""),
                    tracked=tracked,
                ),
            }
        )
    return results
