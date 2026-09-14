"""Router-level tests for POST /scan/run."""

from fastapi.testclient import TestClient

import app.routers.scan as scan_router_module
from app.main import app

client = TestClient(app)


def test_scan_run_is_open_when_no_admin_token_configured(monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "admin_token", "")

    async def fake_run_scan_pass(*, run_discovery, max_new_companies):
        return {"companiesScanned": 0, "newPapers": 0, "newFilings": 0, "newCompaniesDiscovered": 0}

    monkeypatch.setattr(scan_router_module, "run_scan_pass", fake_run_scan_pass)

    response = client.post("/scan/run")
    assert response.status_code == 200


def test_scan_run_rejects_missing_token_once_configured(monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "admin_token", "correct-token")

    response = client.post("/scan/run")
    assert response.status_code == 401


def test_scan_run_accepts_correct_token_and_returns_summary(monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "admin_token", "correct-token")

    async def fake_run_scan_pass(*, run_discovery, max_new_companies):
        assert run_discovery is False
        assert max_new_companies == 2
        return {
            "companiesScanned": 10,
            "newPapers": 3,
            "newFilings": 1,
            "newCompaniesDiscovered": 0,
        }

    monkeypatch.setattr(scan_router_module, "run_scan_pass", fake_run_scan_pass)

    response = client.post("/scan/run", headers={"X-Admin-Token": "correct-token"})

    assert response.status_code == 200
    body = response.json()
    assert body["newPapers"] == 3


def test_scan_run_forwards_run_discovery_query_param(monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "admin_token", "")

    async def fake_run_scan_pass(*, run_discovery, max_new_companies):
        assert run_discovery is True
        assert max_new_companies == 5
        return {"companiesScanned": 0, "newPapers": 0, "newFilings": 0, "newCompaniesDiscovered": 0}

    monkeypatch.setattr(scan_router_module, "run_scan_pass", fake_run_scan_pass)

    response = client.post("/scan/run", params={"run_discovery": "true", "max_new_companies": 5})
    assert response.status_code == 200
