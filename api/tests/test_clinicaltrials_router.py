"""
Router-level wiring tests: confirms /clinicaltrials/* actually calls through
to ClinicalTrialsClient and returns parsed (not raw) data with the right
status codes. Parsing correctness itself is covered by
test_clinicaltrials_parsing.py against real fixtures — this file only needs
to prove the endpoints are wired up right, so the client's network calls are
monkeypatched here rather than re-mocked at the transport level.
"""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import clinicaltrials as ctgov_module
from app.services.clinicaltrials import InvalidNctIdError

FIXTURES = Path(__file__).parent / "fixtures"
client = TestClient(app)


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


@pytest.fixture
def janx007_study():
    return load_fixture("ctgov_study_NCT05519449.json")


def test_get_by_nct_id_returns_parsed_summary(monkeypatch, janx007_study):
    async def fake_get_study(self, nct_id):
        assert nct_id == "NCT05519449"
        return janx007_study

    monkeypatch.setattr(ctgov_module.ClinicalTrialsClient, "get_study", fake_get_study)

    response = client.get("/clinicaltrials/nct/NCT05519449")
    assert response.status_code == 200
    body = response.json()
    assert body["nct_id"] == "NCT05519449"
    assert body["lead_sponsor"] == "Janux Therapeutics"
    # Confirms the router returns *parsed* data, not the raw CT.gov payload.
    assert "protocolSection" not in body


def test_get_by_nct_id_404s_when_not_found(monkeypatch):
    async def fake_get_study(self, nct_id):
        return None

    monkeypatch.setattr(ctgov_module.ClinicalTrialsClient, "get_study", fake_get_study)

    response = client.get("/clinicaltrials/nct/NCT99999999")
    assert response.status_code == 404


def test_get_by_nct_id_422s_on_malformed_id(monkeypatch):
    # Distinct from the 404 case above — verified against the live API that
    # CT.gov itself treats these as different failures (see
    # InvalidNctIdError's docstring).
    async def fake_get_study(self, nct_id):
        raise InvalidNctIdError(f"'{nct_id}' is not a validly formatted NCT ID")

    monkeypatch.setattr(ctgov_module.ClinicalTrialsClient, "get_study", fake_get_study)

    response = client.get("/clinicaltrials/nct/not-a-real-id")
    assert response.status_code == 422


def test_search_by_sponsor_returns_parsed_list(monkeypatch, janx007_study):
    async def fake_search(self, sponsor_name, *, page_size=10):
        assert sponsor_name == "Janux Therapeutics"
        return [janx007_study]

    monkeypatch.setattr(ctgov_module.ClinicalTrialsClient, "search_by_sponsor", fake_search)

    response = client.get("/clinicaltrials/search/sponsor", params={"name": "Janux Therapeutics"})
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["nct_id"] == "NCT05519449"


def test_search_by_intervention_includes_confidence_flag(monkeypatch, janx007_study):
    async def fake_search(self, drug_name, *, page_size=10):
        return [janx007_study]

    monkeypatch.setattr(ctgov_module.ClinicalTrialsClient, "search_by_intervention", fake_search)

    response = client.get("/clinicaltrials/search/intervention", params={"name": "JANX007"})
    assert response.status_code == 200
    body = response.json()
    assert body[0]["confident_match"] is True


def test_search_requires_non_empty_name():
    response = client.get("/clinicaltrials/search/sponsor", params={"name": ""})
    assert response.status_code == 422
