"""Router-level wiring tests for /pubmed/* — mirrors test_clinicaltrials_router.py's approach."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import pubmed as pubmed_module

client = TestClient(app)


@pytest.fixture(autouse=True)
def stub_pubmed_client(monkeypatch):
    async def fake_search_by_nct_id(self, nct_id, *, retmax=10):
        assert nct_id == "NCT06106308"
        return ["111", "222"]

    async def fake_search_by_drug_name(self, drug_name, *, aliases=None, retmax=10):
        assert drug_name == "onvansertib"
        return ["333"]

    async def fake_search_by_target_indication(self, target, indication, *, retmax=10):
        assert target == "PLK1"
        assert indication == "colorectal cancer"
        return ["444"]

    async def fake_build_package(self, pmids, *, query):
        return {"query": query, "paper_count": len(pmids), "papers": []}

    monkeypatch.setattr(pubmed_module.PubMedClient, "search_by_nct_id", fake_search_by_nct_id)
    monkeypatch.setattr(pubmed_module.PubMedClient, "search_by_drug_name", fake_search_by_drug_name)
    monkeypatch.setattr(
        pubmed_module.PubMedClient,
        "search_by_target_and_indication",
        fake_search_by_target_indication,
    )
    monkeypatch.setattr(pubmed_module.PubMedClient, "build_research_package", fake_build_package)


def test_search_by_nct_returns_package():
    response = client.get("/pubmed/nct/NCT06106308")
    assert response.status_code == 200
    body = response.json()
    assert body["paper_count"] == 2
    assert body["query"] == "nct:NCT06106308"


def test_search_by_drug_returns_package():
    response = client.get("/pubmed/drug", params={"name": "onvansertib"})
    assert response.status_code == 200
    assert response.json()["paper_count"] == 1


def test_search_by_drug_with_aliases_labels_query():
    response = client.get(
        "/pubmed/drug", params={"name": "onvansertib", "aliases": "PCM-075, NMS-P937"}
    )
    assert response.status_code == 200
    assert "aliases:PCM-075,NMS-P937" in response.json()["query"]


def test_search_by_target_indication_returns_package():
    response = client.get(
        "/pubmed/target-indication", params={"target": "PLK1", "indication": "colorectal cancer"}
    )
    assert response.status_code == 200
    assert response.json()["paper_count"] == 1


def test_drug_search_requires_non_empty_name():
    response = client.get("/pubmed/drug", params={"name": ""})
    assert response.status_code == 422


def test_target_indication_requires_both_params():
    response = client.get("/pubmed/target-indication", params={"target": "PLK1"})
    assert response.status_code == 422
