"""signal_outcomes tests: the pure scoring functions (baseline choice,
horizons, abnormal return vs benchmark, hit counting) plus update_outcomes
against a fake market client and a real temp SignalStore."""

import pytest

from app.services.signal_outcomes import compute_outcome, summarize_track_record, update_outcomes
from app.services.signal_store import SignalStore

DAYS = [f"2026-09-{d:02d}" for d in (1, 2, 3, 4, 7, 8, 9, 10, 11, 14)]


def _closes(values):
    return [{"date": d, "close": v} for d, v in zip(DAYS, values, strict=False)]


def test_baseline_is_first_trading_day_on_or_after_detection():
    stock = _closes([10, 10, 10, 11, 12, 12, 12, 12, 12, 12])
    bench = _closes([100] * 10)
    # Detected on Saturday the 5th -> baseline is Monday the 7th (close 12).
    outcome = compute_outcome(
        detected_at="2026-09-05T15:00:00+00:00",
        stock_closes=stock,
        benchmark_closes=bench,
        today="2026-09-30",
    )
    assert outcome["baselineDate"] == "2026-09-07"
    assert outcome["baselineClose"] == 12


def test_abnormal_return_subtracts_benchmark():
    stock = _closes([10, 11, 11, 11, 11, 11, 11, 11, 11, 11])
    bench = _closes([100, 105, 105, 105, 105, 105, 105, 105, 105, 105])
    outcome = compute_outcome(
        detected_at="2026-09-01T15:00:00+00:00",
        stock_closes=stock,
        benchmark_closes=bench,
        today="2026-09-30",
    )
    one_day = outcome["horizons"]["1d"]
    assert one_day["stockReturn"] == 0.1
    assert one_day["benchmarkReturn"] == 0.05
    assert one_day["abnormalReturn"] == 0.05
    assert "5d" in outcome["horizons"]
    assert "20d" not in outcome["horizons"]  # not enough days yet


def test_todays_intraday_price_is_never_used():
    stock = _closes([10, 20])
    bench = _closes([100, 100])
    outcome = compute_outcome(
        detected_at="2026-09-01T15:00:00+00:00",
        stock_closes=stock,
        benchmark_closes=bench,
        today="2026-09-02",
    )
    assert outcome["horizons"] == {}


def test_no_baseline_yet_returns_none():
    assert (
        compute_outcome(
            detected_at="2026-09-20T15:00:00+00:00",
            stock_closes=_closes([10] * 10),
            benchmark_closes=_closes([100] * 10),
            today="2026-09-30",
        )
        is None
    )


def _call(direction, abnormal):
    return {
        "impact": {"direction": direction},
        "outcome": {"horizons": {"5d": {"abnormalReturn": abnormal}}},
    }


def test_track_record_counts_hits_and_misses_and_excludes_non_directional():
    record = summarize_track_record(
        [
            _call("likely_positive", 0.03),  # hit
            _call("likely_positive", -0.02),  # miss
            _call("likely_negative", -0.05),  # hit
            _call("unlikely_to_matter", 0.01),  # not scored
        ]
    )
    five = record["horizons"]["5d"]
    assert five["directionalCallsScored"] == 3
    assert five["hits"] == 2
    assert five["hitRate"] == pytest.approx(0.667, abs=0.001)
    assert five["avgAbsAbnormalReturnByDirection"]["unlikely_to_matter"] == 0.01
    assert five["scoredCountByDirection"] == {
        "likely_positive": 2,
        "likely_negative": 1,
        "unlikely_to_matter": 1,
    }
    assert record["horizons"]["1d"]["hitRate"] is None
    assert record["totalCalls"] == 4
    assert len(record["calls"]) == 4  # every call, misses included


class FakeMarket:
    def __init__(self, by_ticker):
        self._by_ticker = by_ticker

    async def get_daily_closes(self, ticker, *, start_epoch, end_epoch):
        return self._by_ticker.get(ticker)


@pytest.mark.asyncio
async def test_update_outcomes_scores_assessed_signals_with_tickers(tmp_path):
    store = SignalStore(db_path=str(tmp_path / "s.sqlite3"))
    base = {
        "signalType": "new_paper",
        "title": "t",
        "occurredAt": "",
        "detectedAt": "2026-09-01T15:00:00+00:00",
        "source": "PubMed",
        "sourceUrl": "",
        "impact": {"direction": "likely_positive"},
    }
    await store.add_signals(
        [
            {**base, "id": "paper:1", "companyId": "listed"},
            {**base, "id": "paper:2", "companyId": "private"},
        ]
    )
    market = FakeMarket(
        {"XBI": _closes([100] * 10), "LST": _closes([10, 11, 11, 11, 11, 11, 11, 11, 11, 11])}
    )
    updated = await update_outcomes(
        store=store,
        market_client=market,
        companies=[{"id": "listed", "ticker": "LST"}, {"id": "private", "ticker": None}],
    )
    assert updated == 1
    stored = {s["id"]: s for s in await store.list_assessed_signals()}
    assert stored["paper:1"]["outcome"]["horizons"]["1d"]["abnormalReturn"] == 0.1
    assert "outcome" not in stored["paper:2"]


def test_detection_after_us_close_uses_next_trading_day():
    outcome = compute_outcome(
        detected_at="2026-09-03T20:50:00+00:00",
        stock_closes=_closes([10, 10, 10, 11, 12, 12, 12, 12, 12, 12]),
        benchmark_closes=_closes([100] * 10),
        today="2026-09-30",
    )
    assert outcome["baselineDate"] == "2026-09-04"
