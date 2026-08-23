"""
Tests for the auto-discovery pipeline (app/services/discovery.py). CT.gov
calls use httpx.MockTransport (same pattern as test_clinicaltrials_client.py);
the LLM uses a FakeLLMProvider double (same pattern as
test_ask_biolens.py/test_readout_extraction.py) -- this proves the
pipeline's own orchestration and validation logic, not AnthropicProvider
itself (that's separately, live-verified elsewhere).
"""

from __future__ import annotations

import httpx
import pytest

from app.services.company_store import CompanyStore
from app.services.discovery import (
    LARGE_PHARMA_DENYLIST,
    DiscoveryDraftError,
    assemble_profile,
    draft_narrative,
    estimate_frontier_components,
    fetch_sponsor_trials,
    find_candidate_sponsors,
    run_discovery_pass,
    slugify,
)
from app.services.llm import LLMProvider, LLMResponse

VALID_NARRATIVE = {
    "primaryFocus": "Oncology",
    "technology": "Test technology",
    "biolensSummary": "A test summary describing the company's lead program.",
    "whyItMatters": ["Reason one.", "Reason two."],
    "oneSentenceSummary": "A one-sentence summary.",
    "keyRisk": "A key risk.",
    "whyItSurfaced": ["Surfaced reason."],
    "thesisMap": {"whatHasToGoRight": ["Thing one."], "whatCouldGoWrong": ["Risk one."]},
    "pipeline": [
        {
            "drugName": "TEST-001",
            "target": "TESTTARGET",
            "modality": "Small molecule inhibitor",
            "disease": "Solid tumors",
            "stage": "Phase I",
            "trialIds": ["NCT12345678"],
            "nextMilestone": "Phase I data",
        }
    ],
    "confidence": "moderate",
    "therapeuticArea": "Oncology",
    "stage": "Phase I",
    "maturity": "emerging",
    "modalities": ["Small molecule inhibitor"],
    "targets": ["TESTTARGET"],
}


class FakeLLMProvider(LLMProvider):
    def __init__(self, results: list):
        self._results = list(results)
        self.calls: list[dict] = []

    async def complete(self, *, system: str, prompt: str, json_mode: bool = False) -> LLMResponse:
        raise NotImplementedError("not used by discovery")

    async def complete_structured(self, *, system, prompt, response_model):
        self.calls.append({"system": system, "prompt": prompt})
        if not self._results:
            raise AssertionError("FakeLLMProvider ran out of programmed results")
        result = self._results.pop(0)
        if isinstance(result, Exception):
            raise result
        return response_model(**result)


class RequestCountingTransport(httpx.MockTransport):
    def __init__(self, handler):
        self.request_count = 0
        self._handler = handler
        super().__init__(self._counting_handler)

    def _counting_handler(self, request: httpx.Request) -> httpx.Response:
        self.request_count += 1
        return self._handler(request)


def _sponsor_search_response(name: str) -> dict:
    return {
        "studies": [
            {
                "protocolSection": {
                    "identificationModule": {"nctId": "NCT12345678", "briefTitle": "A test trial"},
                    "statusModule": {"overallStatus": "RECRUITING"},
                    "designModule": {"phases": ["PHASE1"]},
                    "conditionsModule": {"conditions": ["Solid Tumors"]},
                    "armsInterventionsModule": {"interventions": [{"name": "TEST-001"}]},
                }
            }
        ]
    }


def _candidate_list_response(names: list[str]) -> dict:
    return {
        "studies": [
            {
                "protocolSection": {
                    "sponsorCollaboratorsModule": {"leadSponsor": {"name": name}},
                }
            }
            for name in names
        ]
    }


# --- slugify ---


def test_slugify_lowercases_and_hyphenates():
    assert slugify("Small Bio, Inc.") == "small-bio-inc"


def test_slugify_falls_back_to_a_random_id_for_empty_input():
    assert slugify("!!!") != ""


# --- find_candidate_sponsors ---


@pytest.mark.asyncio
async def test_find_candidate_sponsors_excludes_known_and_large_pharma():
    def handler(request: httpx.Request) -> httpx.Response:
        assert "LeadSponsorClass" in request.url.params["filter.advanced"]
        return httpx.Response(
            200,
            json=_candidate_list_response(["Small Bio Inc", "Pfizer", "Already Known Co"]),
        )

    http_client = httpx.AsyncClient(
        base_url="https://clinicaltrials.gov/api/v2", transport=httpx.MockTransport(handler)
    )
    candidates = await find_candidate_sponsors(
        known_names={"already known co"}, http_client=http_client
    )
    assert candidates == ["Small Bio Inc"]


@pytest.mark.asyncio
async def test_find_candidate_sponsors_dedupes_case_insensitively():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, json=_candidate_list_response(["Small Bio Inc", "small bio inc"])
        )

    http_client = httpx.AsyncClient(
        base_url="https://clinicaltrials.gov/api/v2", transport=httpx.MockTransport(handler)
    )
    candidates = await find_candidate_sponsors(known_names=set(), http_client=http_client)
    assert candidates == ["Small Bio Inc"]


@pytest.mark.asyncio
async def test_find_candidate_sponsors_respects_max_candidates():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, json=_candidate_list_response([f"Company {i}" for i in range(10)])
        )

    http_client = httpx.AsyncClient(
        base_url="https://clinicaltrials.gov/api/v2", transport=httpx.MockTransport(handler)
    )
    candidates = await find_candidate_sponsors(
        known_names=set(), http_client=http_client, max_candidates=3
    )
    assert len(candidates) == 3


def test_large_pharma_denylist_contains_well_known_companies():
    assert "pfizer" in LARGE_PHARMA_DENYLIST
    assert "novartis" in LARGE_PHARMA_DENYLIST


# --- fetch_sponsor_trials ---


@pytest.mark.asyncio
async def test_fetch_sponsor_trials_parses_real_shape():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_sponsor_search_response("Small Bio Inc"))

    http_client = httpx.AsyncClient(
        base_url="https://clinicaltrials.gov/api/v2", transport=httpx.MockTransport(handler)
    )
    trials = await fetch_sponsor_trials("Small Bio Inc", http_client=http_client)
    assert trials == [
        {
            "nct_id": "NCT12345678",
            "title": "A test trial",
            "status": "RECRUITING",
            "phases": ["PHASE1"],
            "conditions": ["Solid Tumors"],
            "interventions": ["TEST-001"],
        }
    ]


@pytest.mark.asyncio
async def test_fetch_sponsor_trials_skips_studies_without_an_nct_id():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"studies": [{"protocolSection": {}}]})

    http_client = httpx.AsyncClient(
        base_url="https://clinicaltrials.gov/api/v2", transport=httpx.MockTransport(handler)
    )
    trials = await fetch_sponsor_trials("No NCT Co", http_client=http_client)
    assert trials == []


# --- estimate_frontier_components ---


def test_estimate_frontier_components_scales_with_active_trials_and_phase():
    trials = [
        {"status": "RECRUITING", "phases": ["PHASE2"]},
        {"status": "RECRUITING", "phases": ["PHASE2"]},
        {"status": "COMPLETED", "phases": ["PHASE1"]},
    ]
    components = estimate_frontier_components(trials)
    assert components.evidence_maturity == 50
    assert components.clinical_momentum == 40 + 2 * 15


def test_estimate_frontier_components_handles_no_trials():
    components = estimate_frontier_components([])
    assert components.evidence_maturity == 20
    assert components.clinical_momentum == 40


# --- draft_narrative ---


@pytest.mark.asyncio
async def test_draft_narrative_succeeds_on_first_try():
    provider = FakeLLMProvider([VALID_NARRATIVE])
    trials = [
        {
            "nct_id": "NCT12345678",
            "title": "t",
            "status": "RECRUITING",
            "phases": ["PHASE1"],
            "conditions": ["c"],
            "interventions": ["i"],
        }
    ]
    narrative = await draft_narrative("Small Bio Inc", trials, provider=provider)
    assert narrative.confidence == "moderate"
    assert len(provider.calls) == 1


@pytest.mark.asyncio
async def test_draft_narrative_retries_on_fabricated_trial_id():
    bad = {
        **VALID_NARRATIVE,
        "pipeline": [{**VALID_NARRATIVE["pipeline"][0], "trialIds": ["NCT99999999"]}],
    }
    provider = FakeLLMProvider([bad, VALID_NARRATIVE])
    trials = [
        {
            "nct_id": "NCT12345678",
            "title": "t",
            "status": "RECRUITING",
            "phases": ["PHASE1"],
            "conditions": ["c"],
            "interventions": ["i"],
        }
    ]
    narrative = await draft_narrative("Small Bio Inc", trials, provider=provider)
    assert narrative == type(narrative)(**VALID_NARRATIVE)
    assert len(provider.calls) == 2


@pytest.mark.asyncio
async def test_draft_narrative_rejects_investment_language():
    bad = {**VALID_NARRATIVE, "keyRisk": "We recommend a strong buy rating on this stock."}
    provider = FakeLLMProvider([bad, bad, bad])
    trials = [
        {
            "nct_id": "NCT12345678",
            "title": "t",
            "status": "RECRUITING",
            "phases": ["PHASE1"],
            "conditions": ["c"],
            "interventions": ["i"],
        }
    ]
    with pytest.raises(DiscoveryDraftError) as exc_info:
        await draft_narrative("Small Bio Inc", trials, provider=provider, max_repair_attempts=2)
    assert exc_info.value.attempts == 3


@pytest.mark.asyncio
async def test_draft_narrative_rejects_non_categorical_confidence():
    bad = {**VALID_NARRATIVE, "confidence": "83%"}
    provider = FakeLLMProvider([bad, bad, bad])
    trials = [
        {
            "nct_id": "NCT12345678",
            "title": "t",
            "status": "RECRUITING",
            "phases": ["PHASE1"],
            "conditions": ["c"],
            "interventions": ["i"],
        }
    ]
    with pytest.raises(DiscoveryDraftError):
        await draft_narrative("Small Bio Inc", trials, provider=provider, max_repair_attempts=2)


@pytest.mark.asyncio
async def test_draft_narrative_rejects_non_roman_numeral_phase():
    # Caught on this pipeline's first real live run: the LLM wrote "Phase 1"
    # instead of "Phase I" -- the exact string the app's TrialPhase type and
    # Discover's Stage filter pills require to group correctly.
    bad = {**VALID_NARRATIVE, "stage": "Phase 1"}
    provider = FakeLLMProvider([bad, bad, bad])
    trials = [
        {
            "nct_id": "NCT12345678",
            "title": "t",
            "status": "RECRUITING",
            "phases": ["PHASE1"],
            "conditions": ["c"],
            "interventions": ["i"],
        }
    ]
    with pytest.raises(DiscoveryDraftError):
        await draft_narrative("Small Bio Inc", trials, provider=provider, max_repair_attempts=2)


@pytest.mark.asyncio
async def test_draft_narrative_rejects_free_text_maturity():
    bad = {**VALID_NARRATIVE, "maturity": "Clinical-stage, first-in-human"}
    provider = FakeLLMProvider([bad, bad, bad])
    trials = [
        {
            "nct_id": "NCT12345678",
            "title": "t",
            "status": "RECRUITING",
            "phases": ["PHASE1"],
            "conditions": ["c"],
            "interventions": ["i"],
        }
    ]
    with pytest.raises(DiscoveryDraftError):
        await draft_narrative("Small Bio Inc", trials, provider=provider, max_repair_attempts=2)


@pytest.mark.asyncio
async def test_draft_narrative_rejects_malformed_pipeline_asset_stage():
    bad = {
        **VALID_NARRATIVE,
        "pipeline": [{**VALID_NARRATIVE["pipeline"][0], "stage": "Phase 1"}],
    }
    provider = FakeLLMProvider([bad, bad, bad])
    trials = [
        {
            "nct_id": "NCT12345678",
            "title": "t",
            "status": "RECRUITING",
            "phases": ["PHASE1"],
            "conditions": ["c"],
            "interventions": ["i"],
        }
    ]
    with pytest.raises(DiscoveryDraftError):
        await draft_narrative("Small Bio Inc", trials, provider=provider, max_repair_attempts=2)


# --- assemble_profile ---


def test_assemble_profile_produces_a_valid_ai_drafted_record():
    from app.services.discovery import DraftedNarrative

    narrative = DraftedNarrative(**VALID_NARRATIVE)
    trials = [{"nct_id": "NCT12345678", "status": "RECRUITING", "phases": ["PHASE1"]}]
    profile = assemble_profile("Small Bio Inc", trials, narrative)
    assert profile["id"] == "small-bio-inc"
    assert profile["reviewStatus"] == "ai_drafted_unreviewed"
    assert profile["source"] == "auto_discovery"
    assert profile["ticker"] is None
    assert profile["pipeline"][0]["drugId"] == "small-bio-inc-test-001"
    assert profile["frontierScore"] > 0


# --- run_discovery_pass (integration of the above) ---


@pytest.mark.asyncio
async def test_run_discovery_pass_adds_a_new_company(tmp_path, monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        if "leadSponsor" in str(request.url) or "filter.advanced" in str(request.url):
            pass
        if request.url.params.get("query.spons"):
            return httpx.Response(200, json=_sponsor_search_response("Small Bio Inc"))
        return httpx.Response(200, json=_candidate_list_response(["Small Bio Inc"]))

    transport = RequestCountingTransport(handler)

    class PatchedAsyncClient(httpx.AsyncClient):
        def __init__(self, *args, **kwargs):
            kwargs["transport"] = transport
            super().__init__(*args, **kwargs)

    monkeypatch.setattr("app.services.discovery.httpx.AsyncClient", PatchedAsyncClient)

    store = CompanyStore(db_path=str(tmp_path / "test_companies.sqlite3"))
    provider = FakeLLMProvider([VALID_NARRATIVE])

    added = await run_discovery_pass(store=store, provider=provider, max_new=1)
    assert len(added) == 1
    assert added[0]["name"] == "Small Bio Inc"

    stored = await store.get_company("small-bio-inc")
    assert stored is not None
    assert stored["reviewStatus"] == "ai_drafted_unreviewed"


@pytest.mark.asyncio
async def test_run_discovery_pass_skips_a_candidate_with_no_real_trials(tmp_path, monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.params.get("query.spons"):
            return httpx.Response(200, json={"studies": []})
        return httpx.Response(200, json=_candidate_list_response(["Empty Pipeline Co"]))

    transport = RequestCountingTransport(handler)

    class PatchedAsyncClient(httpx.AsyncClient):
        def __init__(self, *args, **kwargs):
            kwargs["transport"] = transport
            super().__init__(*args, **kwargs)

    monkeypatch.setattr("app.services.discovery.httpx.AsyncClient", PatchedAsyncClient)

    store = CompanyStore(db_path=str(tmp_path / "test_companies.sqlite3"))
    provider = FakeLLMProvider([])  # would raise if called -- must not be, since no trials found

    added = await run_discovery_pass(store=store, provider=provider, max_new=1)
    assert added == []
