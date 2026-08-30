"""
Upcoming catalyst events for a company, derived purely from its own real
ClinicalTrials.gov trial records -- the same NCT IDs already stored on each
of its pipeline assets (models/company.py's PipelineAssetModel.trialIds).
No LLM, no scraped or invented PDUFA date: CT.gov's own
primaryCompletionDateStruct/completionDateStruct, each explicitly typed
ESTIMATED or ACTUAL by the trial's own sponsor, is the deterministic source
of every date shown here, per PLAN.md §3's "never invent statistics" rule.

On-demand, not bulk-ingested (PLAN.md §3.8): this only ever looks up the
specific NCT IDs a company's own profile already lists, through
ClinicalTrialsClient.get_study's existing cache -- never a broad crawl.

A PDUFA-decision-window event type (derived from a company's *own*
disclosed NDA/BLA submission date, per The BioLens Playbook's Phase A) is a
deliberate fast-follow, not here yet -- that one needs extracting a
disclosed submission date out of filing/press-release text, which is a
heavier, LLM-assisted pipeline closer to discovery.py than this deterministic
CT.gov-only pass.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from app.models.catalyst import CatalystEventModel
from app.services.clinicaltrials import ClinicalTrialsClient, parse_study_summary

# How far in the past an ACTUAL (already-reached) completion date still
# counts as a fresh, worth-surfacing readout rather than old history a user
# has presumably already seen play out.
_RECENT_ACTUAL_WINDOW_DAYS = 90

# (event_type, human label, CT.gov date field, CT.gov date-type field) --
# parse_study_summary already normalizes both into these keys.
_EVENT_FIELDS: list[tuple[str, str, str, str]] = [
    ("primary_completion", "Primary completion", "primary_completion_date", "primary_completion_date_type"),
    ("completion", "Full trial completion", "completion_date", "completion_date_type"),
]


def _normalize_date(raw: str) -> tuple[str, bool]:
    """CT.gov sometimes gives only "YYYY-MM" (month precision, no day) --
    returns an ISO date normalized to the first of the month in that case,
    plus whether the original actually had day precision."""
    if len(raw) == 7:  # "YYYY-MM"
        return f"{raw}-01", False
    return raw, True


def _build_event(
    *,
    company_id: str,
    drug_id: str | None,
    nct_id: str,
    event_type: str,
    label: str,
    raw_date: str | None,
    date_type: str | None,
    phase: str | None,
    overall_status: str | None,
) -> CatalystEventModel | None:
    if not raw_date or not date_type:
        return None
    expected_date, has_day_precision = _normalize_date(raw_date)
    return CatalystEventModel(
        id=f"{nct_id}:{event_type}",
        companyId=company_id,
        drugId=drug_id,
        nctId=nct_id,
        eventType=event_type,
        title=f"{label} — {phase or 'trial'} ({nct_id})",
        phase=phase,
        expectedDate=expected_date,
        dateType=date_type,
        hasDayPrecision=has_day_precision,
        overallStatus=overall_status,
        sourceUrl=f"https://clinicaltrials.gov/study/{nct_id}",
    )


def _is_worth_surfacing(event: CatalystEventModel, *, today: date) -> bool:
    event_date = date.fromisoformat(event.expectedDate)
    if event.dateType == "ESTIMATED":
        return event_date >= today
    # ACTUAL -- the trial already reached this milestone. Only worth
    # surfacing if recent (a readout the user likely hasn't seen yet), not
    # indefinitely -- this is a catalyst calendar, not a trial archive.
    return today - timedelta(days=_RECENT_ACTUAL_WINDOW_DAYS) <= event_date <= today


async def get_catalysts_for_company(
    company: dict[str, Any],
    *,
    client: ClinicalTrialsClient,
    today: date | None = None,
) -> list[CatalystEventModel]:
    """Every upcoming (or very recently reached) trial-completion catalyst
    across a company's real pipeline, nearest first. `company` is the same
    dict shape company_store.get_company returns. Silently skips a trial ID
    CT.gov no longer has a record for -- an absent catalyst is a normal
    outcome here, never an error."""
    today = today or date.today()
    seen_nct_ids: set[str] = set()
    events: list[CatalystEventModel] = []

    for asset in company.get("pipeline", []):
        drug_id = asset.get("drugId")
        for nct_id in asset.get("trialIds", []):
            if nct_id in seen_nct_ids:
                continue
            seen_nct_ids.add(nct_id)

            raw_study = await client.get_study(nct_id)
            if raw_study is None:
                continue
            summary = parse_study_summary(raw_study)
            phase = summary["phase"].value if summary["phase"] else None

            for event_type, label, date_key, type_key in _EVENT_FIELDS:
                event = _build_event(
                    company_id=company["id"],
                    drug_id=drug_id,
                    nct_id=nct_id,
                    event_type=event_type,
                    label=label,
                    raw_date=summary.get(date_key),
                    date_type=summary.get(type_key),
                    phase=phase,
                    overall_status=summary.get("overall_status"),
                )
                if event is not None and _is_worth_surfacing(event, today=today):
                    events.append(event)

    events.sort(key=lambda e: e.expectedDate)
    return events
