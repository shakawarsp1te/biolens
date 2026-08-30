"""
get_catalysts_for_company() tests: a fake ClinicalTrialsClient (same
FakeLLMProvider-style test-double pattern used elsewhere in this codebase)
stands in for real CT.gov responses, so these verify the date-filtering and
event-construction logic without any network access.
"""

from datetime import date

import pytest

from app.services.catalysts import get_catalysts_for_company


class FakeClinicalTrialsClient:
    """Duck-types ClinicalTrialsClient.get_study — that's the only method
    catalysts.py actually calls."""

    def __init__(self, studies: dict[str, dict]):
        self._studies = studies

    async def get_study(self, nct_id: str):
        return self._studies.get(nct_id)


def _study(
    *,
    nct_id: str,
    phase=("PHASE3",),
    overall_status="ACTIVE_NOT_RECRUITING",
    primary_completion_date=None,
    primary_completion_date_type=None,
    completion_date=None,
    completion_date_type=None,
) -> dict:
    status = {"overallStatus": overall_status}
    if primary_completion_date:
        status["primaryCompletionDateStruct"] = {
            "date": primary_completion_date,
            "type": primary_completion_date_type,
        }
    if completion_date:
        status["completionDateStruct"] = {"date": completion_date, "type": completion_date_type}

    return {
        "protocolSection": {
            "identificationModule": {"nctId": nct_id},
            "statusModule": status,
            "designModule": {"phases": list(phase)},
        }
    }


def _company(pipeline: list[dict]) -> dict:
    return {"id": "test-co", "pipeline": pipeline}


@pytest.mark.asyncio
async def test_returns_estimated_future_primary_completion():
    client = FakeClinicalTrialsClient(
        {
            "NCT001": _study(
                nct_id="NCT001",
                primary_completion_date="2027-03-15",
                primary_completion_date_type="ESTIMATED",
            )
        }
    )
    company = _company(
        [{"drugId": "drug-1", "trialIds": ["NCT001"]}],
    )

    events = await get_catalysts_for_company(company, client=client, today=date(2026, 8, 30))

    assert len(events) == 1
    event = events[0]
    assert event.nctId == "NCT001"
    assert event.eventType == "primary_completion"
    assert event.expectedDate == "2027-03-15"
    assert event.dateType == "ESTIMATED"
    assert event.hasDayPrecision is True
    assert event.phase == "Phase III"
    assert event.drugId == "drug-1"
    assert event.companyId == "test-co"
    assert event.sourceUrl == "https://clinicaltrials.gov/study/NCT001"


@pytest.mark.asyncio
async def test_past_estimated_date_is_excluded():
    client = FakeClinicalTrialsClient(
        {
            "NCT001": _study(
                nct_id="NCT001",
                primary_completion_date="2025-01-01",
                primary_completion_date_type="ESTIMATED",
            )
        }
    )
    company = _company([{"drugId": "drug-1", "trialIds": ["NCT001"]}])

    events = await get_catalysts_for_company(company, client=client, today=date(2026, 8, 30))

    assert events == []


@pytest.mark.asyncio
async def test_recent_actual_date_is_included_as_a_fresh_readout():
    client = FakeClinicalTrialsClient(
        {
            "NCT001": _study(
                nct_id="NCT001",
                primary_completion_date="2026-08-01",  # 29 days before "today"
                primary_completion_date_type="ACTUAL",
            )
        }
    )
    company = _company([{"drugId": "drug-1", "trialIds": ["NCT001"]}])

    events = await get_catalysts_for_company(company, client=client, today=date(2026, 8, 30))

    assert len(events) == 1
    assert events[0].dateType == "ACTUAL"


@pytest.mark.asyncio
async def test_old_actual_date_is_excluded_as_stale_history():
    client = FakeClinicalTrialsClient(
        {
            "NCT001": _study(
                nct_id="NCT001",
                primary_completion_date="2024-01-01",
                primary_completion_date_type="ACTUAL",
            )
        }
    )
    company = _company([{"drugId": "drug-1", "trialIds": ["NCT001"]}])

    events = await get_catalysts_for_company(company, client=client, today=date(2026, 8, 30))

    assert events == []


@pytest.mark.asyncio
async def test_month_precision_date_normalizes_to_first_of_month():
    client = FakeClinicalTrialsClient(
        {
            "NCT001": _study(
                nct_id="NCT001",
                primary_completion_date="2027-06",
                primary_completion_date_type="ESTIMATED",
            )
        }
    )
    company = _company([{"drugId": "drug-1", "trialIds": ["NCT001"]}])

    events = await get_catalysts_for_company(company, client=client, today=date(2026, 8, 30))

    assert events[0].expectedDate == "2027-06-01"
    assert events[0].hasDayPrecision is False


@pytest.mark.asyncio
async def test_returns_both_primary_completion_and_completion_events():
    client = FakeClinicalTrialsClient(
        {
            "NCT001": _study(
                nct_id="NCT001",
                primary_completion_date="2027-01-01",
                primary_completion_date_type="ESTIMATED",
                completion_date="2028-01-01",
                completion_date_type="ESTIMATED",
            )
        }
    )
    company = _company([{"drugId": "drug-1", "trialIds": ["NCT001"]}])

    events = await get_catalysts_for_company(company, client=client, today=date(2026, 8, 30))

    assert {e.eventType for e in events} == {"primary_completion", "completion"}
    # Nearest first.
    assert events[0].expectedDate < events[1].expectedDate


@pytest.mark.asyncio
async def test_missing_study_is_skipped_not_an_error():
    client = FakeClinicalTrialsClient({})  # CT.gov has no record for this ID
    company = _company([{"drugId": "drug-1", "trialIds": ["NCT404"]}])

    events = await get_catalysts_for_company(company, client=client, today=date(2026, 8, 30))

    assert events == []


@pytest.mark.asyncio
async def test_deduplicates_a_trial_id_shared_across_pipeline_assets():
    client = FakeClinicalTrialsClient(
        {
            "NCT001": _study(
                nct_id="NCT001",
                primary_completion_date="2027-01-01",
                primary_completion_date_type="ESTIMATED",
            )
        }
    )
    company = _company(
        [
            {"drugId": "drug-1", "trialIds": ["NCT001"]},
            {"drugId": "drug-2", "trialIds": ["NCT001"]},
        ]
    )

    events = await get_catalysts_for_company(company, client=client, today=date(2026, 8, 30))

    assert len(events) == 1


@pytest.mark.asyncio
async def test_no_disclosed_dates_returns_empty_list():
    client = FakeClinicalTrialsClient({"NCT001": _study(nct_id="NCT001")})
    company = _company([{"drugId": "drug-1", "trialIds": ["NCT001"]}])

    events = await get_catalysts_for_company(company, client=client, today=date(2026, 8, 30))

    assert events == []
