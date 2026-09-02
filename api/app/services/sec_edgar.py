"""
SEC EDGAR client -- real, official, free, no-key financial disclosure data
(Tier 1 per PLAN.md §3.5's source hierarchy, same tier as ClinicalTrials.gov
and the FDA, since it's the regulator's own filed data). Backs
app/services/financial_health.py's cash-runway calculation: this module only
fetches and caches the raw XBRL facts a company already disclosed in its
10-Q/10-K; it never computes or interprets anything itself.

SEC's fair-access policy (sec.gov/os/webmaster-faq#developers) asks every
automated caller to identify itself with a descriptive User-Agent and to
keep request rates reasonable -- mirrors PubMedClient's tool/email params
(app/services/pubmed.py) and this codebase's existing "cache aggressively,
never bulk-ingest" rule (PLAN.md §3.8). Both endpoints used here are cached
far longer than market_data.py's 60s quote cache, since neither a company's
listed ticker nor its quarterly filings change on that timescale.
"""

from __future__ import annotations

import time
from typing import Any

import httpx

from app.core.config import get_settings
from app.services.cache import CacheStore, get_cache_store

_TICKER_MAP_URL = "https://www.sec.gov/files/company_tickers.json"
_FACTS_URL_TEMPLATE = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json"

_TICKER_MAP_CACHE_TTL_SECONDS = 24 * 3600.0
_FACTS_CACHE_TTL_SECONDS = 6 * 3600.0


class SecEdgarClient:
    def __init__(
        self, *, http_client: httpx.AsyncClient | None = None, cache: CacheStore | None = None
    ):
        settings = get_settings()
        self._contact_email = settings.sec_edgar_contact_email
        self._http_client = http_client
        self._cache = cache or get_cache_store()
        self._owns_client = http_client is None

    def _user_agent(self) -> str:
        contact = self._contact_email or "contact-email-not-configured@example.com"
        return f"BioLens/1.0 ({contact})"

    async def __aenter__(self) -> "SecEdgarClient":
        if self._http_client is None:
            self._http_client = httpx.AsyncClient(
                timeout=10.0, headers={"User-Agent": self._user_agent()}
            )
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        if self._owns_client and self._http_client is not None:
            await self._http_client.aclose()

    async def get_cik(self, ticker: str) -> str | None:
        """10-digit zero-padded CIK for `ticker`, or None if it isn't a SEC
        filer (private company) or the lookup failed. The whole ticker->CIK
        map is cached as a single entry -- it's one file covering every
        listed ticker, not something to look up per-symbol."""
        table = await self._get_ticker_map()
        if table is None:
            return None
        return table.get(ticker.upper())

    async def _get_ticker_map(self) -> dict[str, str] | None:
        cache_key = "sec:ticker_map"
        cached = await self._cache.get(cache_key)
        fresh = cached is not None and (
            time.time() - cached.fetched_at < _TICKER_MAP_CACHE_TTL_SECONDS
        )
        if fresh:
            return cached.value  # type: ignore[return-value]

        assert self._http_client is not None, "use `async with SecEdgarClient() as client:`"
        try:
            response = await self._http_client.get(_TICKER_MAP_URL)
        except httpx.HTTPError:
            return cached.value if cached is not None else None  # type: ignore[return-value]

        if response.status_code != 200:
            return cached.value if cached is not None else None  # type: ignore[return-value]

        try:
            raw = response.json()
            table = {
                str(entry["ticker"]).upper(): f"{int(entry['cik_str']):010d}"
                for entry in raw.values()
            }
        except (KeyError, TypeError, ValueError):
            return cached.value if cached is not None else None  # type: ignore[return-value]

        await self._cache.set(cache_key, table)  # type: ignore[arg-type]
        return table

    async def get_company_facts(self, cik: str) -> dict[str, Any] | None:
        """Raw XBRL company-facts payload for a 10-digit CIK, or None on any
        failure -- same graceful-degradation contract as
        MarketDataClient.get_quote (bad CIK, network error, and an
        unexpected response shape are all "no data available right now",
        never an app-breaking error)."""
        cache_key = f"sec:facts:{cik}"
        cached = await self._cache.get(cache_key)
        fresh = cached is not None and (time.time() - cached.fetched_at < _FACTS_CACHE_TTL_SECONDS)
        if fresh:
            return cached.value

        assert self._http_client is not None, "use `async with SecEdgarClient() as client:`"
        try:
            response = await self._http_client.get(_FACTS_URL_TEMPLATE.format(cik=int(cik)))
        except httpx.HTTPError:
            return cached.value if cached is not None else None

        if response.status_code != 200:
            return cached.value if cached is not None else None

        try:
            facts = response.json()
        except ValueError:
            return cached.value if cached is not None else None

        await self._cache.set(cache_key, facts)
        return facts
