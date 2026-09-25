"""
Scores paper impact calls (paper_impact.py) against what the stock actually
did afterward, and summarizes the result as BioLens's track record.

Method, kept simple enough to explain in one breath:

- Baseline: the first daily close BioLens's reader could actually have acted
  on -- the close of the day BioLens found the paper, or the next trading
  day's if it was found after the US close. Any move before that isn't
  credited to BioLens.
- Horizons: 1, 5 and 20 trading days after the baseline.
- Each horizon records the stock's return, the biotech benchmark's (XBI)
  return over the same days, and the difference ("abnormal return") -- so a
  sector-wide selloff isn't mistaken for the paper being bad news.
- A directional call (likely positive / likely negative) is a hit when the
  abnormal return has the same sign. "Mixed" and "unlikely to matter" calls
  aren't scored as hits or misses, but their average absolute move is
  reported so you can see whether they really did move the stock less.

The track record always includes every scored call, misses included, and
reports the sample size next to every rate: with a few dozen calls, a hit
rate is noise, and the page says so rather than implying otherwise.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any

from app.services.company_store import get_company_store
from app.services.market_data import MarketDataClient
from app.services.signal_store import SignalStore, get_signal_store

logger = logging.getLogger("biolens.signal_outcomes")

BENCHMARK_TICKER = "XBI"
HORIZONS: dict[str, int] = {"1d": 1, "5d": 5, "20d": 20}
DIRECTIONAL = {"likely_positive": 1, "likely_negative": -1}

_US_CLOSE_UTC_HOUR = 20

# 20 trading days is ~28 calendar days; pad for holidays.
_LOOKAHEAD_DAYS = 40


def _utc_today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def compute_outcome(
    *,
    detected_at: str,
    stock_closes: list[dict[str, Any]],
    benchmark_closes: list[dict[str, Any]],
    today: str | None = None,
) -> dict[str, Any] | None:
    """Pure function: the outcome dict for one call, or None when there's
    no baseline yet. Only completed trading days (strictly before `today`)
    count -- a live intraday price isn't a close."""
    today = today or _utc_today()
    detected = datetime.fromisoformat(detected_at).astimezone(timezone.utc)
    detected_date = detected.date().isoformat()
    bench_by_date = {p["date"]: p["close"] for p in benchmark_closes}
    # Only days where both the stock and the benchmark traded, so every
    # return below compares the same window.
    days = [
        p for p in stock_closes if p["date"] < today and p["date"] in bench_by_date and p["close"]
    ]
    # Found after the US close (4pm ET = 20:00 UTC; 21:00 in winter, so this
    # errs early by an hour then): that day's close was already set, so the
    # first price a reader could act on is the next trading day's.
    after_close = detected.hour >= _US_CLOSE_UTC_HOUR
    baseline_index = next(
        (
            i
            for i, p in enumerate(days)
            if p["date"] > detected_date or (p["date"] == detected_date and not after_close)
        ),
        None,
    )
    if baseline_index is None:
        return None
    baseline = days[baseline_index]

    horizons: dict[str, Any] = {}
    for label, offset in HORIZONS.items():
        index = baseline_index + offset
        if index >= len(days):
            continue
        point = days[index]
        stock_return = point["close"] / baseline["close"] - 1
        bench_return = bench_by_date[point["date"]] / bench_by_date[baseline["date"]] - 1
        horizons[label] = {
            "date": point["date"],
            "stockReturn": round(stock_return, 4),
            "benchmarkReturn": round(bench_return, 4),
            "abnormalReturn": round(stock_return - bench_return, 4),
        }
    return {
        "benchmark": BENCHMARK_TICKER,
        "baselineDate": baseline["date"],
        "baselineClose": baseline["close"],
        "horizons": horizons,
    }


def _is_complete(signal: dict[str, Any]) -> bool:
    outcome = signal.get("outcome") or {}
    return set(outcome.get("horizons", {})) == set(HORIZONS)


async def update_outcomes(
    *,
    store: SignalStore | None = None,
    market_client: MarketDataClient | None = None,
    companies: list[dict[str, Any]] | None = None,
) -> int:
    """Fills in / extends outcomes for every assessed paper signal whose
    company has a ticker. Returns how many signals were updated. Never
    raises on one company's missing price data -- that call just stays
    unscored until data is available."""
    store = store or get_signal_store()
    if companies is None:
        companies = await get_company_store().list_companies()
    tickers = {c["id"]: c["ticker"] for c in companies if c.get("ticker")}
    pending = [
        s
        for s in await store.list_assessed_signals()
        if s["companyId"] in tickers and not _is_complete(s)
    ]
    if not pending:
        return 0

    updated = 0
    now = int(time.time())
    owns_client = market_client is None
    client = market_client or MarketDataClient()
    if owns_client:
        await client.__aenter__()
    try:
        earliest = (
            min(datetime.fromisoformat(s["detectedAt"]).timestamp() for s in pending) - 5 * 86400
        )
        benchmark = await client.get_daily_closes(
            BENCHMARK_TICKER, start_epoch=int(earliest), end_epoch=now
        )
        if not benchmark:
            logger.warning("no benchmark (%s) prices; outcomes not updated", BENCHMARK_TICKER)
            return 0

        for signal in pending:
            start = int(datetime.fromisoformat(signal["detectedAt"]).timestamp()) - 5 * 86400
            end = min(now, start + (_LOOKAHEAD_DAYS + 5) * 86400)
            stock = await client.get_daily_closes(
                tickers[signal["companyId"]], start_epoch=start, end_epoch=end
            )
            if not stock:
                continue
            outcome = compute_outcome(
                detected_at=signal["detectedAt"], stock_closes=stock, benchmark_closes=benchmark
            )
            if outcome is None or outcome == signal.get("outcome"):
                continue
            signal["outcome"] = outcome
            await store.update_signal(signal)
            updated += 1
    finally:
        if owns_client:
            await client.__aexit__(None, None, None)
    return updated


def summarize_track_record(signals: list[dict[str, Any]]) -> dict[str, Any]:
    """Pure function over assessed signals -> the track-record payload."""
    by_horizon: dict[str, Any] = {}
    for label in HORIZONS:
        hits = 0
        scored = 0
        abs_moves: dict[str, list[float]] = {}
        for signal in signals:
            horizon = (signal.get("outcome") or {}).get("horizons", {}).get(label)
            if horizon is None:
                continue
            direction = signal["impact"]["direction"]
            abnormal = horizon["abnormalReturn"]
            abs_moves.setdefault(direction, []).append(abs(abnormal))
            if direction in DIRECTIONAL:
                scored += 1
                if abnormal * DIRECTIONAL[direction] > 0:
                    hits += 1
        by_horizon[label] = {
            "directionalCallsScored": scored,
            "hits": hits,
            "hitRate": round(hits / scored, 3) if scored else None,
            "avgAbsAbnormalReturnByDirection": {
                d: round(sum(v) / len(v), 4) for d, v in abs_moves.items()
            },
            "scoredCountByDirection": {d: len(v) for d, v in abs_moves.items()},
        }

    direction_counts: dict[str, int] = {}
    for signal in signals:
        d = signal["impact"]["direction"]
        direction_counts[d] = direction_counts.get(d, 0) + 1

    return {
        "benchmark": BENCHMARK_TICKER,
        "totalCalls": len(signals),
        "callsByDirection": direction_counts,
        "horizons": by_horizon,
        "calls": signals,
    }
