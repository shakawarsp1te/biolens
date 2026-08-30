"""Router-level tests for GET /market/quote/{ticker} and /market/history/{ticker}."""

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


def test_history_returns_points_on_success(monkeypatch):
    async def fake_get_history(self, ticker, chart_range):
        assert ticker == "CRDF"
        assert chart_range == "1M"
        return {"ticker": "CRDF", "range": "1M", "points": [{"time": 1, "close": 0.9}]}

    monkeypatch.setattr(market_router_module.MarketDataClient, "get_history", fake_get_history)

    response = client.get("/market/history/CRDF", params={"range": "1M"})
    assert response.status_code == 200
    body = response.json()
    assert body["range"] == "1M"
    assert body["points"] == [{"time": 1, "close": 0.9}]


def test_history_rejects_unsupported_range_before_calling_client(monkeypatch):
    async def fake_get_history(self, ticker, chart_range):
        raise AssertionError("should not be called for an unsupported range")

    monkeypatch.setattr(market_router_module.MarketDataClient, "get_history", fake_get_history)

    response = client.get("/market/history/CRDF", params={"range": "10Y"})
    assert response.status_code == 422


def test_history_returns_404_when_no_data_available(monkeypatch):
    async def fake_get_history(self, ticker, chart_range):
        return None

    monkeypatch.setattr(market_router_module.MarketDataClient, "get_history", fake_get_history)

    response = client.get("/market/history/NOTATICKER", params={"range": "1M"})
    assert response.status_code == 404


def test_history_defaults_to_1m_range(monkeypatch):
    async def fake_get_history(self, ticker, chart_range):
        assert chart_range == "1M"
        return {"ticker": ticker, "range": "1M", "points": []}

    monkeypatch.setattr(market_router_module.MarketDataClient, "get_history", fake_get_history)

    response = client.get("/market/history/CRDF")
    assert response.status_code == 200


# --- GET /market/financial-health/{ticker} ---


def test_financial_health_returns_computed_result(monkeypatch):
    async def fake_get_cik(self, ticker):
        assert ticker == "CRDF"
        return "0001837929"

    async def fake_get_company_facts(self, cik):
        assert cik == "0001837929"
        return {"entityName": "Cardiff Oncology, Inc.", "facts": {"us-gaap": {}}}

    def fake_compute(facts):
        from app.services.financial_health import FinancialHealthResult

        return FinancialHealthResult(
            cashOnHand=45_000_000,
            cashAsOf="2026-03-31",
            quarterlyBurn=-15_000_000,
            runwayMonths=9.0,
        )

    monkeypatch.setattr(market_router_module.SecEdgarClient, "get_cik", fake_get_cik)
    monkeypatch.setattr(
        market_router_module.SecEdgarClient, "get_company_facts", fake_get_company_facts
    )
    monkeypatch.setattr(market_router_module, "compute_financial_health", fake_compute)

    response = client.get("/market/financial-health/CRDF")

    assert response.status_code == 200
    body = response.json()
    assert body["ticker"] == "CRDF"
    assert body["companyName"] == "Cardiff Oncology, Inc."
    assert body["runwayMonths"] == 9.0


def test_financial_health_404_when_ticker_not_a_sec_filer(monkeypatch):
    async def fake_get_cik(self, ticker):
        return None

    monkeypatch.setattr(market_router_module.SecEdgarClient, "get_cik", fake_get_cik)

    response = client.get("/market/financial-health/NOTATICKER")
    assert response.status_code == 404


def test_financial_health_404_when_no_facts_available(monkeypatch):
    async def fake_get_cik(self, ticker):
        return "0001837929"

    async def fake_get_company_facts(self, cik):
        return None

    monkeypatch.setattr(market_router_module.SecEdgarClient, "get_cik", fake_get_cik)
    monkeypatch.setattr(
        market_router_module.SecEdgarClient, "get_company_facts", fake_get_company_facts
    )

    response = client.get("/market/financial-health/CRDF")
    assert response.status_code == 404


def test_financial_health_404_when_facts_have_no_usable_figures(monkeypatch):
    async def fake_get_cik(self, ticker):
        return "0001837929"

    async def fake_get_company_facts(self, cik):
        return {"entityName": "Cardiff Oncology, Inc.", "facts": {"us-gaap": {}}}

    monkeypatch.setattr(market_router_module.SecEdgarClient, "get_cik", fake_get_cik)
    monkeypatch.setattr(
        market_router_module.SecEdgarClient, "get_company_facts", fake_get_company_facts
    )
    monkeypatch.setattr(market_router_module, "compute_financial_health", lambda facts: None)

    response = client.get("/market/financial-health/CRDF")
    assert response.status_code == 404
