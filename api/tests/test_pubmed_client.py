"""
PubMedClient tests: caching behavior, rate limiting, and research-package
assembly, using httpx.MockTransport against the real captured fixtures.
"""

import json
from pathlib import Path

import httpx
import pytest

from app.services.cache import InMemoryCacheStore
from app.services.pubmed import PubMedClient, RateLimiter

FIXTURES = Path(__file__).parent / "fixtures"


def load_json(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


def load_text(name: str) -> str:
    return (FIXTURES / name).read_text()


class RequestCountingTransport(httpx.MockTransport):
    def __init__(self, handler):
        self.request_count = 0
        self._handler = handler
        super().__init__(self._counting_handler)

    def _counting_handler(self, request: httpx.Request) -> httpx.Response:
        self.request_count += 1
        return self._handler(request)


@pytest.fixture
def transport():
    esearch_nct = load_json("pubmed_esearch_nct.json")
    esearch_drug = load_json("pubmed_esearch_drug.json")
    esummary = load_json("pubmed_esummary.json")
    efetch_xml = load_text("pubmed_efetch_abstract.xml")

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path.endswith("/esearch.fcgi"):
            term = request.url.params["term"]
            if "[si]" in term:
                return httpx.Response(200, json=esearch_nct)
            return httpx.Response(200, json=esearch_drug)
        if path.endswith("/esummary.fcgi"):
            return httpx.Response(200, json=esummary)
        if path.endswith("/efetch.fcgi"):
            return httpx.Response(200, text=efetch_xml, headers={"content-type": "application/xml"})
        raise AssertionError(f"unexpected request: {request.url}")

    return RequestCountingTransport(handler)


@pytest.fixture
def no_wait_limiter():
    """A rate limiter that never actually sleeps — these tests care about
    caching behavior, not timing, and shouldn't be slow."""
    return RateLimiter(requests_per_second=1_000_000)


@pytest.fixture
def http_client(transport):
    return httpx.AsyncClient(
        base_url="https://eutils.ncbi.nlm.nih.gov/entrez/eutils", transport=transport
    )


@pytest.mark.asyncio
async def test_esearch_by_nct_id_uses_secondary_source_id_syntax(http_client, no_wait_limiter):
    cache = InMemoryCacheStore()
    async with PubMedClient(
        http_client=http_client, cache=cache, rate_limiter=no_wait_limiter
    ) as client:
        pmids = await client.search_by_nct_id("NCT06106308")
    assert pmids == load_json("pubmed_esearch_nct.json")["esearchresult"]["idlist"]


@pytest.mark.asyncio
async def test_repeated_esearch_hits_cache_not_network(http_client, transport, no_wait_limiter):
    cache = InMemoryCacheStore()
    async with PubMedClient(
        http_client=http_client, cache=cache, rate_limiter=no_wait_limiter
    ) as client:
        await client.search_by_drug_name("onvansertib")
        await client.search_by_drug_name("onvansertib")
    assert transport.request_count == 1


@pytest.mark.asyncio
async def test_build_research_package_merges_summary_and_abstract(http_client, no_wait_limiter):
    cache = InMemoryCacheStore()
    async with PubMedClient(
        http_client=http_client, cache=cache, rate_limiter=no_wait_limiter
    ) as client:
        package = await client.build_research_package(["42155785", "42036120"], query="test-query")

    assert package["paper_count"] == 2
    first = next(p for p in package["papers"] if p["pmid"] == "42155785")
    expected_title = (
        "All screens lead to polo-like kinase 1: A central node in cancer "
        "therapeutics and resistance."
    )
    assert first["title"] == expected_title
    assert first["journal"] == "Pharmacological research"
    assert first["doi"] == "10.1016/j.phrs.2026.108252"
    # This PMID's abstract came from the efetch fixture, merged in by PMID.
    assert first["abstract"] is not None
    assert "PLK1" in first["abstract"]


@pytest.mark.asyncio
async def test_build_research_package_is_cached_as_a_whole(http_client, transport, no_wait_limiter):
    cache = InMemoryCacheStore()
    async with PubMedClient(
        http_client=http_client, cache=cache, rate_limiter=no_wait_limiter
    ) as client:
        await client.build_research_package(["42155785"], query="cached-query")
        count_after_first = transport.request_count
        await client.build_research_package(["42155785"], query="cached-query")
    # Second call should hit the package-level cache directly, not even
    # re-issue the underlying esummary/efetch calls (which are separately
    # cached too, but the package cache should short-circuit before that).
    assert transport.request_count == count_after_first


@pytest.mark.asyncio
async def test_empty_pmid_list_returns_empty_package_without_network_calls(no_wait_limiter):
    def fail_handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("should not make a network request for an empty PMID list")

    http_client = httpx.AsyncClient(
        base_url="https://eutils.ncbi.nlm.nih.gov/entrez/eutils",
        transport=httpx.MockTransport(fail_handler),
    )
    cache = InMemoryCacheStore()
    async with PubMedClient(
        http_client=http_client, cache=cache, rate_limiter=no_wait_limiter
    ) as client:
        package = await client.build_research_package([], query="empty")
    assert package == {"query": "empty", "paper_count": 0, "papers": []}


class TestRateLimiter:
    """Deterministic — controls time.monotonic and asyncio.sleep directly
    rather than actually waiting, so these stay fast."""

    @pytest.mark.asyncio
    async def test_first_call_never_sleeps(self, monkeypatch):
        sleep_calls = []

        async def fake_sleep(seconds):
            sleep_calls.append(seconds)

        monkeypatch.setattr("app.services.pubmed.asyncio.sleep", fake_sleep)
        monkeypatch.setattr("app.services.pubmed.time.monotonic", lambda: 100.0)

        limiter = RateLimiter(requests_per_second=3)
        await limiter.wait()
        assert sleep_calls == []

    @pytest.mark.asyncio
    async def test_second_call_too_soon_sleeps_the_remaining_interval(self, monkeypatch):
        sleep_calls = []

        async def fake_sleep(seconds):
            sleep_calls.append(seconds)

        clock = {"t": 100.0}
        monkeypatch.setattr("app.services.pubmed.asyncio.sleep", fake_sleep)
        monkeypatch.setattr("app.services.pubmed.time.monotonic", lambda: clock["t"])

        limiter = RateLimiter(requests_per_second=3)  # min interval = 1/3s
        await limiter.wait()
        clock["t"] += 0.1  # only 100ms later — too soon for a 3 req/sec limit
        await limiter.wait()

        assert len(sleep_calls) == 1
        assert sleep_calls[0] == pytest.approx(1 / 3 - 0.1, abs=1e-9)

    @pytest.mark.asyncio
    async def test_call_after_interval_has_elapsed_does_not_sleep(self, monkeypatch):
        sleep_calls = []

        async def fake_sleep(seconds):
            sleep_calls.append(seconds)

        clock = {"t": 100.0}
        monkeypatch.setattr("app.services.pubmed.asyncio.sleep", fake_sleep)
        monkeypatch.setattr("app.services.pubmed.time.monotonic", lambda: clock["t"])

        limiter = RateLimiter(requests_per_second=3)
        await limiter.wait()
        clock["t"] += 1.0  # a full second later — plenty of headroom
        await limiter.wait()

        assert sleep_calls == []

    def test_higher_rate_with_api_key(self):
        from app.services.pubmed import _rate_for

        assert _rate_for("") == 3.0
        assert _rate_for("some-key") == 10.0
