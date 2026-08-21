"""Router-level tests for GET /market/quote/{ticker}."""

from fastapi.testclient import TestClient

import app.routers.market as market_router_module
from app.main import app

client = TestClient(app)


def test_returns_quote_on_success(monkeypatch):
    async def fake_get_quote(self, ticker):
        assert ticker == "CRDF"
        return {"ticker": "CRDF", "price": 0.91, "company_name": "Cardiff Oncology, Inc."}

    monkeypatch.setattr(market_router_module.MarketDataClient, "get_quote", fake_get_quote)

    response = client.get("/market/quote/CRDF")
    assert response.status_code == 200
    assert response.json()["ticker"] == "CRDF"


def test_returns_404_when_no_quote_available(monkeypatch):
    async def fake_get_quote(self, ticker):
        return None

    monkeypatch.setattr(market_router_module.MarketDataClient, "get_quote", fake_get_quote)

    response = client.get("/market/quote/NOTATICKER")
    assert response.status_code == 404
