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
