"""
scan_company_for_new_filings() tests: a fake SecEdgarClient stands in for
real SEC EDGAR responses -- no network access.
"""

import pytest

from app.services.filing_monitor import scan_company_for_new_filings
from app.services.signal_store import SignalStore


class FakeSecEdgarClient:
    def __init__(self, cik: str | None, submissions: dict | None):
        self._cik = cik
        self._submissions = submissions

    async def get_cik(self, ticker):
        return self._cik

    async def get_submissions(self, cik):
        return self._submissions


def _submissions(forms, accessions, dates, primary_docs) -> dict:
    return {
        "filings": {
            "recent": {
                "form": forms,
                "accessionNumber": accessions,
                "filingDate": dates,
                "primaryDocument": primary_docs,
            }
        }
    }


def _company(ticker="TST", company_id="test-co") -> dict:
    return {"id": company_id, "ticker": ticker}


@pytest.fixture
def store(tmp_path):
    return SignalStore(db_path=str(tmp_path / "test_signals.sqlite3"))


@pytest.mark.asyncio
async def test_first_scan_establishes_baseline_without_reporting_anything(store):
    # SEC EDGAR's "recent" filings list is a large multi-year backlog, not
    # "since you last checked" -- a first scan with nothing to diff against
    # would otherwise report a company's entire significant-filing history
    # as "new" in one shot (the real bug this was caught by, live).
    submissions = _submissions(
        forms=["8-K", "10-Q", "4"],
        accessions=["acc-1", "acc-2", "acc-form4"],
        dates=["2020-01-01", "2020-06-01", "2020-07-01"],
        primary_docs=["a.htm", "b.htm", "c.xml"],
    )
    client = FakeSecEdgarClient(cik="0001213037", submissions=submissions)
    company = _company()

    signals = await scan_company_for_new_filings(company, client=client, store=store)

    assert signals == []
    # Only the significant forms are baselined -- Form 4 noise is never
    # tracked at all, so it can't accidentally "become new" later either.
    assert await store.get_seen_accessions("test-co") == {"acc-1", "acc-2"}


@pytest.mark.asyncio
async def test_filing_appearing_after_the_baseline_is_reported_and_marked_seen(store):
    company = _company()
    await store.mark_scanned("test-co", scanned_at="2026-08-01T00:00:00+00:00")

    submissions = _submissions(
        forms=["8-K"],
        accessions=["0001213900-26-000111"],
        dates=["2026-08-20"],
        primary_docs=["tst-8k.htm"],
    )
    client = FakeSecEdgarClient(cik="0001213037", submissions=submissions)

    signals = await scan_company_for_new_filings(company, client=client, store=store)

    assert len(signals) == 1
    assert signals[0].id == "filing:0001213900-26-000111"
    assert signals[0].title == "Material event (8-K)"
    assert signals[0].source == "SEC EDGAR"
    assert signals[0].sourceUrl == (
        "https://www.sec.gov/Archives/edgar/data/1213037/" "000121390026000111/tst-8k.htm"
    )

    signals_again = await scan_company_for_new_filings(company, client=client, store=store)
    assert signals_again == []


@pytest.mark.asyncio
async def test_insider_and_ownership_forms_are_filtered_out_as_noise(store):
    company = _company()
    await store.mark_scanned("test-co", scanned_at="2026-08-01T00:00:00+00:00")

    submissions = _submissions(
        forms=["4", "SCHEDULE 13G/A", "8-K"],
        accessions=["acc-form4", "acc-13g", "acc-8k"],
        dates=["2026-08-01", "2026-08-02", "2026-08-03"],
        primary_docs=["a.htm", "b.htm", "c.htm"],
    )
    client = FakeSecEdgarClient(cik="0001213037", submissions=submissions)

    signals = await scan_company_for_new_filings(company, client=client, store=store)

    assert [s.id for s in signals] == ["filing:acc-8k"]


@pytest.mark.asyncio
async def test_only_new_accessions_are_reported_on_a_later_scan(store):
    company = _company()
    await store.set_seen_accessions("test-co", {"acc-old"})
    await store.mark_scanned("test-co", scanned_at="2026-05-01T00:00:00+00:00")

    submissions = _submissions(
        forms=["10-Q", "10-Q"],
        accessions=["acc-old", "acc-new"],
        dates=["2026-05-01", "2026-08-01"],
        primary_docs=["old.htm", "new.htm"],
    )
    client = FakeSecEdgarClient(cik="0001213037", submissions=submissions)

    signals = await scan_company_for_new_filings(company, client=client, store=store)

    assert [s.id for s in signals] == ["filing:acc-new"]


@pytest.mark.asyncio
async def test_no_ticker_returns_empty_without_calling_sec(store):
    client = FakeSecEdgarClient(cik=None, submissions=None)
    company = {"id": "test-co", "ticker": None}

    signals = await scan_company_for_new_filings(company, client=client, store=store)

    assert signals == []


@pytest.mark.asyncio
async def test_unresolved_ticker_returns_empty(store):
    client = FakeSecEdgarClient(cik=None, submissions=None)
    company = _company(ticker="NOTAREALTICKER")

    signals = await scan_company_for_new_filings(company, client=client, store=store)

    assert signals == []


@pytest.mark.asyncio
async def test_no_submissions_available_returns_empty(store):
    client = FakeSecEdgarClient(cik="0001213037", submissions=None)
    company = _company()

    signals = await scan_company_for_new_filings(company, client=client, store=store)

    assert signals == []
