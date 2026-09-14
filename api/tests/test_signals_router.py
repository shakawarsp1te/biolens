"""Router-level tests for GET /signals/recent."""

from fastapi.testclient import TestClient

import app.routers.signals as signals_router_module
from app.main import app

client = TestClient(app)


def test_returns_recent_signals(monkeypatch):
    async def fake_list_recent_signals(self, *, limit):
        assert limit == 20
        return [{"id": "paper:1", "title": "A paper"}]

    monkeypatch.setattr(
        signals_router_module.get_signal_store().__class__,
        "list_recent_signals",
        fake_list_recent_signals,
    )

    response = client.get("/signals/recent")
    assert response.status_code == 200
    assert response.json() == [{"id": "paper:1", "title": "A paper"}]


def test_forwards_limit_query_param(monkeypatch):
    async def fake_list_recent_signals(self, *, limit):
        assert limit == 5
        return []

    monkeypatch.setattr(
        signals_router_module.get_signal_store().__class__,
        "list_recent_signals",
        fake_list_recent_signals,
    )

    response = client.get("/signals/recent", params={"limit": 5})
    assert response.status_code == 200


def test_rejects_limit_outside_bounds():
    response = client.get("/signals/recent", params={"limit": 1000})
    assert response.status_code == 422
