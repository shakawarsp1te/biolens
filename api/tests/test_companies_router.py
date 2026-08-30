from fastapi.testclient import TestClient

import app.routers.companies as companies_router_module
from app.main import app

client = TestClient(app)


def test_list_companies_returns_store_contents(monkeypatch):
    async def fake_list_companies(self):
        return [{"id": "co-1", "name": "Test Co"}]

    monkeypatch.setattr(
        companies_router_module.get_company_store().__class__,
        "list_companies",
        fake_list_companies,
    )

    response = client.get("/companies")
    assert response.status_code == 200
    assert response.json() == [{"id": "co-1", "name": "Test Co"}]


def test_get_company_returns_404_when_missing(monkeypatch):
    async def fake_get_company(self, company_id):
        return None

    monkeypatch.setattr(
        companies_router_module.get_company_store().__class__, "get_company", fake_get_company
    )

    response = client.get("/companies/not-a-real-id")
    assert response.status_code == 404


def test_get_company_returns_profile_when_found(monkeypatch):
    async def fake_get_company(self, company_id):
        assert company_id == "co-1"
        return {"id": "co-1", "name": "Test Co"}

    monkeypatch.setattr(
        companies_router_module.get_company_store().__class__, "get_company", fake_get_company
    )

    response = client.get("/companies/co-1")
    assert response.status_code == 200
    assert response.json()["name"] == "Test Co"


def test_discover_runs_a_pass_and_returns_what_was_added(monkeypatch):
    async def fake_run_discovery_pass(*, max_new):
        assert max_new == 2
        return [{"id": "small-bio-inc", "name": "Small Bio Inc", "trialCount": 3}]

    monkeypatch.setattr(companies_router_module, "run_discovery_pass", fake_run_discovery_pass)

    response = client.post("/companies/discover", params={"max_new": 2})
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 1
    assert body["added"][0]["name"] == "Small Bio Inc"


def test_discover_defaults_max_new_to_three(monkeypatch):
    async def fake_run_discovery_pass(*, max_new):
        assert max_new == 3
        return []

    monkeypatch.setattr(companies_router_module, "run_discovery_pass", fake_run_discovery_pass)

    response = client.post("/companies/discover")
    assert response.status_code == 200
    assert response.json() == {"added": [], "count": 0}


def test_discover_rejects_max_new_outside_bounds():
    response = client.post("/companies/discover", params={"max_new": 100})
    assert response.status_code == 422


# --- GET /companies/{id}/catalysts ---


def test_catalysts_returns_404_when_company_missing(monkeypatch):
    async def fake_get_company(self, company_id):
        return None

    monkeypatch.setattr(
        companies_router_module.get_company_store().__class__, "get_company", fake_get_company
    )

    response = client.get("/companies/not-a-real-id/catalysts")
    assert response.status_code == 404


def test_catalysts_returns_events_for_an_existing_company(monkeypatch):
    async def fake_get_company(self, company_id):
        assert company_id == "co-1"
        return {"id": "co-1", "name": "Test Co", "pipeline": []}

    async def fake_get_catalysts_for_company(company, *, client):
        assert company["id"] == "co-1"
        from app.models.catalyst import CatalystEventModel

        return [
            CatalystEventModel(
                id="NCT001:primary_completion",
                companyId="co-1",
                nctId="NCT001",
                eventType="primary_completion",
                title="Primary completion — Phase III (NCT001)",
                phase="Phase III",
                expectedDate="2027-01-01",
                dateType="ESTIMATED",
                hasDayPrecision=False,
                sourceUrl="https://clinicaltrials.gov/study/NCT001",
            )
        ]

    monkeypatch.setattr(
        companies_router_module.get_company_store().__class__, "get_company", fake_get_company
    )
    monkeypatch.setattr(
        companies_router_module, "get_catalysts_for_company", fake_get_catalysts_for_company
    )

    response = client.get("/companies/co-1/catalysts")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["nctId"] == "NCT001"
    assert body[0]["expectedDate"] == "2027-01-01"


def test_catalysts_returns_empty_list_when_none_found(monkeypatch):
    async def fake_get_company(self, company_id):
        return {"id": "co-1", "pipeline": []}

    async def fake_get_catalysts_for_company(company, *, client):
        return []

    monkeypatch.setattr(
        companies_router_module.get_company_store().__class__, "get_company", fake_get_company
    )
    monkeypatch.setattr(
        companies_router_module, "get_catalysts_for_company", fake_get_catalysts_for_company
    )

    response = client.get("/companies/co-1/catalysts")
    assert response.status_code == 200
    assert response.json() == []
