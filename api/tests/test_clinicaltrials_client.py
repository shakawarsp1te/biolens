"""
ClinicalTrialsClient tests: caching behavior and request shape, using
httpx.MockTransport (no dependency on network access, no new package
required — httpx is already a direct dependency). Response bodies are the
same real captured fixtures used in test_clinicaltrials_parsing.py.
"""

import json
from pathlib import Path

import httpx
import pytest

from app.services.cache import InMemoryCacheStore
from app.services.clinicaltrials import ClinicalTrialsClient, InvalidNctIdError

FIXTURES = Path(__file__).parent / "fixtures"


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


class RequestCountingTransport(httpx.MockTransport):
    """Wraps MockTransport to also count how many requests actually went
    out, so cache-hit tests can assert the network wasn't hit twice."""

    def __init__(self, handler):
        self.request_count = 0
        self._handler = handler
        super().__init__(self._counting_handler)

    def _counting_handler(self, request: httpx.Request) -> httpx.Response:
        self.request_count += 1
        return self._handler(request)


@pytest.fixture
def janx007_transport():
    # Response codes here match what the live API actually returns (verified
    # by hand): a well-formed but unassigned NCT ID 404s; a malformed one
    # 400s. These are genuinely different failure modes, not the same thing
    # with different status codes.
    fixture = load_fixture("ctgov_study_NCT05519449.json")

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/v2/studies/NCT05519449":
            return httpx.Response(200, json=fixture)
        if request.url.path == "/api/v2/studies/NCT99999999":
            return httpx.Response(404, json={"error": "NCT number NCT99999999 not found"})
        if request.url.path == "/api/v2/studies/not-a-real-id":
            return httpx.Response(400, json={"error": "Parameter `nctId` has incorrect format"})
        raise AssertionError(f"unexpected request: {request.url}")

    return RequestCountingTransport(handler)


@pytest.fixture
def http_client(janx007_transport):
    return httpx.AsyncClient(
        base_url="https://clinicaltrials.gov/api/v2", transport=janx007_transport
    )


@pytest.mark.asyncio
async def test_get_study_returns_parsed_data(http_client, janx007_transport):
    cache = InMemoryCacheStore()
    async with ClinicalTrialsClient(http_client=http_client, cache=cache) as client:
        result = await client.get_study("NCT05519449")
    assert result is not None
    assert result["protocolSection"]["identificationModule"]["nctId"] == "NCT05519449"
    assert janx007_transport.request_count == 1


@pytest.mark.asyncio
async def test_get_study_returns_none_for_well_formed_unassigned_id(http_client, janx007_transport):
    cache = InMemoryCacheStore()
    async with ClinicalTrialsClient(http_client=http_client, cache=cache) as client:
        result = await client.get_study("NCT99999999")
    assert result is None


@pytest.mark.asyncio
async def test_get_study_raises_for_malformed_id(http_client, janx007_transport):
    cache = InMemoryCacheStore()
    async with ClinicalTrialsClient(http_client=http_client, cache=cache) as client:
        with pytest.raises(InvalidNctIdError):
            await client.get_study("not-a-real-id")


@pytest.mark.asyncio
async def test_second_lookup_hits_cache_not_network(http_client, janx007_transport):
    cache = InMemoryCacheStore()
    async with ClinicalTrialsClient(http_client=http_client, cache=cache) as client:
        await client.get_study("NCT05519449")
        await client.get_study("NCT05519449")
    assert janx007_transport.request_count == 1


@pytest.mark.asyncio
async def test_cache_is_keyed_per_nct_id(http_client, janx007_transport):
    cache = InMemoryCacheStore()
    async with ClinicalTrialsClient(http_client=http_client, cache=cache) as client:
        await client.get_study("NCT05519449")
        # A 404 for a different ID must not be served from NCT05519449's
        # cache entry.
        result = await client.get_study("NCT99999999")
    assert result is None
    assert janx007_transport.request_count == 2


@pytest.fixture
def search_transport():
    fixture = load_fixture("ctgov_search_sponsor_janux.json")

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v2/studies"
        assert request.url.params["query.spons"] == "Janux Therapeutics"
        return httpx.Response(200, json=fixture)

    return RequestCountingTransport(handler)


@pytest.mark.asyncio
async def test_search_by_sponsor_sends_correct_query_param(search_transport):
    http_client = httpx.AsyncClient(
        base_url="https://clinicaltrials.gov/api/v2", transport=search_transport
    )
    cache = InMemoryCacheStore()
    async with ClinicalTrialsClient(http_client=http_client, cache=cache) as client:
        results = await client.search_by_sponsor("Janux Therapeutics")
    assert len(results) == 3
    assert all(
        s["protocolSection"]["identificationModule"]["nctId"].startswith("NCT") for s in results
    )


@pytest.mark.asyncio
async def test_repeated_search_hits_cache_not_network(search_transport):
    http_client = httpx.AsyncClient(
        base_url="https://clinicaltrials.gov/api/v2", transport=search_transport
    )
    cache = InMemoryCacheStore()
    async with ClinicalTrialsClient(http_client=http_client, cache=cache) as client:
        await client.search_by_sponsor("Janux Therapeutics")
        await client.search_by_sponsor("Janux Therapeutics")
    assert search_transport.request_count == 1
