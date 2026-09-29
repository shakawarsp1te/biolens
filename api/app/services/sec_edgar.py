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

import html
import re
import time
from typing import Any

import httpx

from app.core.config import get_settings
from app.services.cache import CacheStore, get_cache_store

_TICKER_MAP_URL = "https://www.sec.gov/files/company_tickers.json"
_FACTS_URL_TEMPLATE = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json"
_SUBMISSIONS_URL_TEMPLATE = "https://data.sec.gov/submissions/CIK{cik:010d}.json"

_TICKER_MAP_CACHE_TTL_SECONDS = 24 * 3600.0
_FACTS_CACHE_TTL_SECONDS = 6 * 3600.0
# A new filing is exactly the kind of thing filing_monitor.py wants to
# notice same-day -- much shorter than the facts cache above, which only
# needs to reflect a new quarterly/annual report every few months.
_SUBMISSIONS_CACHE_TTL_SECONDS = 1800.0

_ARCHIVE_BASE = "https://www.sec.gov/Archives/edgar/data/{cik}/{accession}/"
# Press releases ride along as Exhibit 99.x; on an 8-K they usually carry
# the substance, while the primary document is a cover page naming the
# item. File names aren't reliable (Arvinas: "q22026earningsrelease.htm"),
# so exhibits are found by the document type the filing index declares.
_INDEX_EXHIBIT_99 = re.compile(
    r'<a href="[^"]*/([^"/]+)">[^<]*</a></td>\s*<td[^>]*>\s*EX-99[^<]*</td>', re.I
)
_MAX_EXHIBITS = 2


def html_to_text(markup: str) -> str:
    """Plain text from a filing's HTML: drops scripts/styles and the hidden
    inline-XBRL header, strips tags, unescapes entities, collapses space."""
    markup = re.sub(r"(?is)<(script|style|ix:header)\b.*?</\1>", " ", markup)
    markup = re.sub(r"(?s)<[^>]+>", " ", markup)
    return re.sub(r"\s+", " ", html.unescape(markup)).strip()


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

    async def get_submissions(self, cik: str) -> dict[str, Any] | None:
        """A company's real SEC filing history (form type, filing date,
        accession number per filing) for a 10-digit CIK -- backs
        filing_monitor.py's new-filing detection. Same graceful-degradation
        contract as get_company_facts."""
        cache_key = f"sec:submissions:{cik}"
        cached = await self._cache.get(cache_key)
        fresh = cached is not None and (
            time.time() - cached.fetched_at < _SUBMISSIONS_CACHE_TTL_SECONDS
        )
        if fresh:
            return cached.value

        assert self._http_client is not None, "use `async with SecEdgarClient() as client:`"
        try:
            response = await self._http_client.get(_SUBMISSIONS_URL_TEMPLATE.format(cik=int(cik)))
        except httpx.HTTPError:
            return cached.value if cached is not None else None

        if response.status_code != 200:
            return cached.value if cached is not None else None

        try:
            submissions = response.json()
        except ValueError:
            return cached.value if cached is not None else None

        await self._cache.set(cache_key, submissions)
        return submissions

    async def get_filing_text(
        self, cik: str, accession: str, primary_document: str, *, max_chars: int = 20_000
    ) -> str | None:
        """A filing's primary document plus up to two Exhibit 99 press
        releases, as plain text, capped at `max_chars`. Filings never change
        once filed, so a hit is cached indefinitely. None on any failure."""
        cache_key = f"sec:filing-text:{accession}:{max_chars}"
        cached = await self._cache.get(cache_key)
        if cached is not None:
            return cached.value["text"]

        assert self._http_client is not None, "use `async with SecEdgarClient() as client:`"
        base = _ARCHIVE_BASE.format(cik=int(cik), accession=accession.replace("-", ""))
        documents = [primary_document]
        try:
            index = await self._http_client.get(f"{base}{accession}-index.html")
            if index.status_code == 200:
                exhibits = [n for n in _INDEX_EXHIBIT_99.findall(index.text) if n not in documents]
                documents += exhibits[:_MAX_EXHIBITS]
        except httpx.HTTPError:
            pass

        parts = []
        for name in documents:
            try:
                response = await self._http_client.get(base + name)
            except httpx.HTTPError:
                continue
            if response.status_code == 200:
                parts.append(html_to_text(response.text))
        if not parts:
            return None
        # Exhibits (the press release) first when present: they carry the
        # news, and truncation should cut boilerplate, not the substance.
        ordered = parts[1:] + parts[:1] if len(parts) > 1 else parts
        text = "\n\n---\n\n".join(ordered)[:max_chars]
        await self._cache.set(cache_key, {"text": text})
        return text
