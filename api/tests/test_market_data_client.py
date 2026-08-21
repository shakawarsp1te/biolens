"""
MarketDataClient tests: parsing, caching, and graceful-degradation behavior,
using httpx.MockTransport (same pattern as test_clinicaltrials_client.py —
no network access, no new dependency).
"""

import httpx
import pytest

from app.services.cache import InMemoryCacheStore
from app.services.market_data import MarketDataClient

CRDF_CHART_RESPONSE = {
    "chart": {
        "result": [
            {
                "meta": {
                    "symbol": "CRDF",
                    "currency": "USD",
                    "exchangeName": "NCM",
                    "fullExchangeName": "NasdaqCM",
                    "longName": "Cardiff Oncology, Inc.",
                    "regularMarketPrice": 0.9087,
                    "chartPreviousClose": 0.84,
                    "regularMarketDayHigh": 0.92,
                    "regularMarketDayLow": 0.8735,
                    "regularMarketVolume": 554191,
                    "fiftyTwoWeekHigh": 3.31,
                    "fiftyTwoWeekLow": 0.76,
                    "regularMarketTime": 1787256001,
                }
            }
        ],
        "error": None,
    }
}


class RequestCountingTransport(httpx.MockTransport):
    def __init__(self, handler):
        self.request_count = 0
        self._handler = handler
        super().__init__(self._counting_handler)

    def _counting_handler(self, request: httpx.Request) -> httpx.Response:
        self.request_count += 1
        return self._handler(request)


@pytest.mark.asyncio
async def test_get_quote_parses_price_change_and_metadata():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v8/finance/chart/CRDF"
        return httpx.Response(200, json=CRDF_CHART_RESPONSE)

    transport = RequestCountingTransport(handler)
    http_client = httpx.AsyncClient(
        base_url="https://query1.finance.yahoo.com", transport=transport
    )

    cache = InMemoryCacheStore()
    async with MarketDataClient(http_client=http_client, cache=cache) as client:
        quote = await client.get_quote("CRDF")

    assert quote is not None
    assert quote["ticker"] == "CRDF"
    assert quote["company_name"] == "Cardiff Oncology, Inc."
    assert quote["price"] == 0.9087
    assert quote["previous_close"] == 0.84
    assert round(quote["change"], 4) == round(0.9087 - 0.84, 4)
    assert quote["change_percent"] == round((0.9087 - 0.84) / 0.84 * 100, 2)
    assert quote["exchange"] == "NasdaqCM"
    assert quote["market_time"] is not None


@pytest.mark.asyncio
async def test_second_call_within_ttl_is_served_from_cache():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=CRDF_CHART_RESPONSE)

    transport = RequestCountingTransport(handler)
    http_client = httpx.AsyncClient(
        base_url="https://query1.finance.yahoo.com", transport=transport
    )
    cache = InMemoryCacheStore()

    async with MarketDataClient(http_client=http_client, cache=cache) as client:
        await client.get_quote("CRDF")
        await client.get_quote("CRDF")

    assert transport.request_count == 1


@pytest.mark.asyncio
async def test_unknown_ticker_returns_none():
    def handler(request: httpx.Request) -> httpx.Response:
        body = {"chart": {"result": None, "error": {"code": "Not Found"}}}
        return httpx.Response(404, json=body)

    transport = RequestCountingTransport(handler)
    http_client = httpx.AsyncClient(
        base_url="https://query1.finance.yahoo.com", transport=transport
    )

    async with MarketDataClient(http_client=http_client, cache=InMemoryCacheStore()) as client:
        quote = await client.get_quote("NOTAREALTICKER")

    assert quote is None


@pytest.mark.asyncio
async def test_malformed_response_returns_none_instead_of_raising():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"chart": {"result": [{"meta": {}}]}})

    transport = RequestCountingTransport(handler)
    http_client = httpx.AsyncClient(
        base_url="https://query1.finance.yahoo.com", transport=transport
    )

    async with MarketDataClient(http_client=http_client, cache=InMemoryCacheStore()) as client:
        quote = await client.get_quote("CRDF")

    assert quote is None


CRDF_HISTORY_RESPONSE = {
    "chart": {
        "result": [
            {
                "meta": {"symbol": "CRDF"},
                "timestamp": [1786714200, 1786715100, 1786716000],
                "indicators": {
                    "quote": [
                        {
                            "close": [0.9792, 0.9782, None],
                            "open": [],
                            "high": [],
                            "low": [],
                            "volume": [],
                        }
                    ]
                },
            }
        ],
        "error": None,
    }
}


@pytest.mark.asyncio
async def test_get_history_parses_points_and_drops_nulls():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v8/finance/chart/CRDF"
        assert request.url.params["range"] == "5d"
        assert request.url.params["interval"] == "15m"
        return httpx.Response(200, json=CRDF_HISTORY_RESPONSE)

    transport = RequestCountingTransport(handler)
    http_client = httpx.AsyncClient(
        base_url="https://query1.finance.yahoo.com", transport=transport
    )

    async with MarketDataClient(http_client=http_client, cache=InMemoryCacheStore()) as client:
        history = await client.get_history("CRDF", "1W")

    assert history is not None
    assert history["ticker"] == "CRDF"
    assert history["range"] == "1W"
    # The trailing None close is dropped, not coerced to 0 or kept as null.
    assert history["points"] == [
        {"time": 1786714200, "close": 0.9792},
        {"time": 1786715100, "close": 0.9782},
    ]


@pytest.mark.asyncio
async def test_get_history_rejects_unsupported_range():
    async with MarketDataClient(cache=InMemoryCacheStore()) as client:
        history = await client.get_history("CRDF", "10Y")
    assert history is None


@pytest.mark.asyncio
async def test_get_history_second_call_within_ttl_is_cached():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=CRDF_HISTORY_RESPONSE)

    transport = RequestCountingTransport(handler)
    http_client = httpx.AsyncClient(
        base_url="https://query1.finance.yahoo.com", transport=transport
    )

    async with MarketDataClient(http_client=http_client, cache=InMemoryCacheStore()) as client:
        await client.get_history("CRDF", "1M")
        await client.get_history("CRDF", "1M")

    assert transport.request_count == 1


@pytest.mark.asyncio
async def test_network_error_falls_back_to_stale_cache_if_available():
    call_count = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        call_count["n"] += 1
        if call_count["n"] == 1:
            return httpx.Response(200, json=CRDF_CHART_RESPONSE)
        raise httpx.ConnectError("network is down", request=request)

    transport = RequestCountingTransport(handler)
    http_client = httpx.AsyncClient(
        base_url="https://query1.finance.yahoo.com", transport=transport
    )
    cache = InMemoryCacheStore()

    async with MarketDataClient(http_client=http_client, cache=cache) as client:
        first = await client.get_quote("CRDF")
        # Force the cache to look expired so the second call actually hits
        # the (now-failing) network instead of short-circuiting on TTL.
        entry = await cache.get("market:quote:CRDF")
        entry.fetched_at = 0.0
        second = await client.get_quote("CRDF")

    assert first is not None
    assert second == first
