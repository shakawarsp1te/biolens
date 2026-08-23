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
