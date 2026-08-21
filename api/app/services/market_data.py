"""
Live market data (stock price) for a publicly traded company, shown on its
profile as plain fact — never paired with buy/sell/price-target language.
BUILD_BRIEF.txt's "no investment advice" rule governs *interpretation* (this
codebase never tells anyone what to do about a number); a real, publicly
traded company's real, current share price is not an interpretation, so it's
in scope here in a way a price target or a "buy" call never would be.

Source: Yahoo Finance's undocumented `v8/finance/chart` endpoint. Same shape
as ClinicalTrials.gov/PubMed elsewhere in this codebase — a public data
source, no API key, no account to create — but unlike those two, this one is
unofficial and unsupported by Yahoo: it can change shape or disappear without
notice. Every caller must treat a failure (bad/private ticker, network error,
unexpected response shape) as "no quote available right now", never as an
app-breaking error — the same "insufficient evidence is a normal state, not a
failure" posture as Ask BioLens.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any

import httpx

from app.services.cache import CacheStore, get_cache_store

# Prices move constantly; unlike CT.gov/PubMed's effectively-unbounded cache
# (those change slowly), an unbounded cache here would go stale within
# minutes. 60s keeps repeated views of the same profile cheap without
# showing a meaningfully out-of-date number.
_QUOTE_CACHE_TTL_SECONDS = 60.0


def _epoch_to_iso(epoch_seconds: int | None) -> str | None:
    if epoch_seconds is None:
        return None
    return datetime.fromtimestamp(epoch_seconds, tz=timezone.utc).isoformat()


class MarketDataClient:
    def __init__(
        self, *, http_client: httpx.AsyncClient | None = None, cache: CacheStore | None = None
    ):
        self._http_client = http_client
        self._cache = cache or get_cache_store()
        self._owns_client = http_client is None

    async def __aenter__(self) -> "MarketDataClient":
        if self._http_client is None:
            self._http_client = httpx.AsyncClient(
                base_url="https://query1.finance.yahoo.com",
                timeout=10.0,
                # An unauthenticated User-Agent gets rejected by this
                # endpoint in practice — verified by hand before writing
                # this client.
                headers={"User-Agent": "Mozilla/5.0 (compatible; BioLensApp/1.0)"},
            )
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        if self._owns_client and self._http_client is not None:
            await self._http_client.aclose()

    async def get_quote(self, ticker: str) -> dict[str, Any] | None:
        """Current quote for `ticker`, or None if no reliable quote could be
        obtained (bad ticker, network failure, or a response shape this
        client doesn't recognize) — callers must render that as "no market
        data available", not surface it as an error."""
        cache_key = f"market:quote:{ticker.upper()}"
        cached = await self._cache.get(cache_key)
        fresh_cache_hit = cached is not None and (
            time.time() - cached.fetched_at < _QUOTE_CACHE_TTL_SECONDS
        )
        if fresh_cache_hit:
            return cached.value

        assert self._http_client is not None, "use `async with MarketDataClient() as client:`"
        try:
            response = await self._http_client.get(
                f"/v8/finance/chart/{ticker}", params={"interval": "1d", "range": "1d"}
            )
        except httpx.HTTPError:
            # Serve a stale cached quote over nothing at all if we have one.
            return cached.value if cached is not None else None

        if response.status_code != 200:
            return cached.value if cached is not None else None

        quote = _parse_chart_response(response, fallback_ticker=ticker)
        if quote is None:
            return cached.value if cached is not None else None

        await self._cache.set(cache_key, quote)
        return quote


def _parse_chart_response(
    response: httpx.Response, *, fallback_ticker: str
) -> dict[str, Any] | None:
    try:
        payload = response.json()
        result = payload["chart"]["result"][0]
        meta = result["meta"]
        price = meta["regularMarketPrice"]
        previous_close = meta.get("chartPreviousClose")
        if previous_close is None:
            previous_close = meta.get("previousClose")
    except (KeyError, IndexError, TypeError, ValueError):
        return None

    if price is None or previous_close is None:
        return None

    change = price - previous_close
    change_percent = (change / previous_close * 100) if previous_close else None

    return {
        "ticker": meta.get("symbol") or fallback_ticker.upper(),
        "company_name": meta.get("longName") or meta.get("shortName"),
        "price": round(price, 4),
        "currency": meta.get("currency"),
        "change": round(change, 4),
        "change_percent": round(change_percent, 2) if change_percent is not None else None,
        "previous_close": round(previous_close, 4),
        "day_high": meta.get("regularMarketDayHigh"),
        "day_low": meta.get("regularMarketDayLow"),
        "fifty_two_week_high": meta.get("fiftyTwoWeekHigh"),
        "fifty_two_week_low": meta.get("fiftyTwoWeekLow"),
        "volume": meta.get("regularMarketVolume"),
        "exchange": meta.get("fullExchangeName") or meta.get("exchangeName"),
        "market_time": _epoch_to_iso(meta.get("regularMarketTime")),
    }
