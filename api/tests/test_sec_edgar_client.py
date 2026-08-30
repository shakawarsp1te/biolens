"""
SecEdgarClient tests: ticker->CIK resolution, company-facts fetching, and
caching/graceful-degradation behavior, using httpx.MockTransport -- same
pattern as test_market_data_client.py.
"""

import httpx
import pytest

from app.services.cache import InMemoryCacheStore
from app.services.sec_edgar import SecEdgarClient

TICKER_MAP_RESPONSE = {
    "0": {"cik_str": 1837929, "ticker": "CRDF", "title": "Cardiff Oncology, Inc."},
    "1": {"cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc."},
}

FACTS_RESPONSE = {
    "cik": 1837929,
    "entityName": "Cardiff Oncology, Inc.",
    "facts": {"us-gaap": {}},
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
async def test_get_cik_resolves_ticker_and_zero_pads():
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == "https://www.sec.gov/files/company_tickers.json"
        return httpx.Response(200, json=TICKER_MAP_RESPONSE)

    transport = RequestCountingTransport(handler)
    http_client = httpx.AsyncClient(transport=transport)

    async with SecEdgarClient(http_client=http_client, cache=InMemoryCacheStore()) as client:
        cik = await client.get_cik("crdf")  # lowercase on purpose

    assert cik == "0001837929"


@pytest.mark.asyncio
async def test_get_cik_returns_none_for_unlisted_ticker():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=TICKER_MAP_RESPONSE)

    transport = RequestCountingTransport(handler)
    http_client = httpx.AsyncClient(transport=transport)

    async with SecEdgarClient(http_client=http_client, cache=InMemoryCacheStore()) as client:
        cik = await client.get_cik("NOTATICKER")

    assert cik is None


@pytest.mark.asyncio
async def test_ticker_map_second_lookup_within_ttl_is_cached():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=TICKER_MAP_RESPONSE)

    transport = RequestCountingTransport(handler)
    http_client = httpx.AsyncClient(transport=transport)
    cache = InMemoryCacheStore()

    async with SecEdgarClient(http_client=http_client, cache=cache) as client:
        await client.get_cik("CRDF")
        await client.get_cik("AAPL")

    assert transport.request_count == 1


@pytest.mark.asyncio
async def test_get_company_facts_parses_and_caches():
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == "https://data.sec.gov/api/xbrl/companyfacts/CIK0001837929.json"
        return httpx.Response(200, json=FACTS_RESPONSE)

    transport = RequestCountingTransport(handler)
    http_client = httpx.AsyncClient(transport=transport)
    cache = InMemoryCacheStore()

    async with SecEdgarClient(http_client=http_client, cache=cache) as client:
        first = await client.get_company_facts("0001837929")
        second = await client.get_company_facts("0001837929")

    assert first is not None
    assert first["entityName"] == "Cardiff Oncology, Inc."
    assert second == first
    assert transport.request_count == 1


@pytest.mark.asyncio
async def test_get_company_facts_returns_none_on_404():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"error": "not found"})

    transport = RequestCountingTransport(handler)
    http_client = httpx.AsyncClient(transport=transport)

    async with SecEdgarClient(http_client=http_client, cache=InMemoryCacheStore()) as client:
        facts = await client.get_company_facts("0000000000")

    assert facts is None


@pytest.mark.asyncio
async def test_company_facts_network_error_falls_back_to_stale_cache():
    call_count = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        call_count["n"] += 1
        if call_count["n"] == 1:
            return httpx.Response(200, json=FACTS_RESPONSE)
        raise httpx.ConnectError("network is down", request=request)

    transport = RequestCountingTransport(handler)
    http_client = httpx.AsyncClient(transport=transport)
    cache = InMemoryCacheStore()

    async with SecEdgarClient(http_client=http_client, cache=cache) as client:
        first = await client.get_company_facts("0001837929")
        entry = await cache.get("sec:facts:0001837929")
        entry.fetched_at = 0.0  # force past the TTL so the retry hits the network
        second = await client.get_company_facts("0001837929")

    assert first is not None
    assert second == first


@pytest.mark.asyncio
async def test_user_agent_falls_back_to_placeholder_when_no_contact_configured():
    client = SecEdgarClient()
    assert "@" in client._user_agent()
