"""
run_scan_pass() tests: the monitor functions and company store are
monkeypatched (same style as test_companies_router.py's run_discovery_pass
monkeypatching) so this exercises the orchestration logic -- summing
counts, persisting signals, never letting one company's failure sink the
whole pass -- without any real network access.
"""

import pytest

import app.services.scan as scan_module
from app.models.signal import SignalEventModel
from app.services.signal_store import SignalStore


class FakeCompanyStore:
    def __init__(self, companies):
        self._companies = companies

    async def list_companies(self):
        return self._companies


def _company(company_id: str) -> dict:
    return {"id": company_id, "pipeline": [], "ticker": None}


def _paper_signal(company_id: str, n: int = 1) -> SignalEventModel:
    return SignalEventModel(
        id=f"paper:{company_id}:{n}",
        companyId=company_id,
        signalType="new_paper",
        title="A paper",
        occurredAt="2026 Aug",
        detectedAt="2026-08-25T00:00:00+00:00",
        source="PubMed",
        sourceUrl="https://pubmed.ncbi.nlm.nih.gov/1/",
    )


@pytest.fixture
def store(tmp_path):
    return SignalStore(db_path=str(tmp_path / "test_signals.sqlite3"))


@pytest.mark.asyncio
async def test_sums_new_papers_and_filings_across_companies(monkeypatch, store):
    companies = [_company("co-a"), _company("co-b")]
    monkeypatch.setattr(scan_module, "get_company_store", lambda: FakeCompanyStore(companies))

    async def fake_papers(company, *, client, store):
        return [_paper_signal(company["id"])]

    async def fake_filings(company, *, client, store):
        return []

    monkeypatch.setattr(scan_module, "scan_company_for_new_papers", fake_papers)
    monkeypatch.setattr(scan_module, "scan_company_for_new_filings", fake_filings)

    summary = await scan_module.run_scan_pass(store=store)

    assert summary["companiesScanned"] == 2
    assert summary["newPapers"] == 2
    assert summary["newFilings"] == 0
    assert summary["newCompaniesDiscovered"] == 0

    persisted = await store.list_recent_signals()
    assert len(persisted) == 2


@pytest.mark.asyncio
async def test_one_companys_paper_scan_failure_does_not_sink_the_pass(monkeypatch, store):
    companies = [_company("co-a"), _company("co-b")]
    monkeypatch.setattr(scan_module, "get_company_store", lambda: FakeCompanyStore(companies))

    async def flaky_papers(company, *, client, store):
        if company["id"] == "co-a":
            raise RuntimeError("upstream is down")
        return [_paper_signal(company["id"])]

    async def fake_filings(company, *, client, store):
        return []

    monkeypatch.setattr(scan_module, "scan_company_for_new_papers", flaky_papers)
    monkeypatch.setattr(scan_module, "scan_company_for_new_filings", fake_filings)

    summary = await scan_module.run_scan_pass(store=store)

    assert summary["companiesScanned"] == 2  # co-a still counted as scanned
    assert summary["newPapers"] == 1  # only co-b's paper made it through


@pytest.mark.asyncio
async def test_discovery_is_off_by_default(monkeypatch, store):
    monkeypatch.setattr(scan_module, "get_company_store", lambda: FakeCompanyStore([]))

    async def fail_if_called(*, max_new):
        raise AssertionError("run_discovery_pass should not be called by default")

    monkeypatch.setattr(scan_module, "run_discovery_pass", fail_if_called)

    summary = await scan_module.run_scan_pass(store=store)

    assert summary["newCompaniesDiscovered"] == 0


@pytest.mark.asyncio
async def test_discovery_runs_when_explicitly_requested(monkeypatch, store):
    monkeypatch.setattr(scan_module, "get_company_store", lambda: FakeCompanyStore([]))

    async def fake_discovery(*, max_new):
        assert max_new == 2
        return [{"id": "new-co"}]

    monkeypatch.setattr(scan_module, "run_discovery_pass", fake_discovery)

    summary = await scan_module.run_scan_pass(run_discovery=True, store=store)

    assert summary["newCompaniesDiscovered"] == 1


@pytest.mark.asyncio
async def test_a_failed_discovery_pass_does_not_raise(monkeypatch, store):
    monkeypatch.setattr(scan_module, "get_company_store", lambda: FakeCompanyStore([]))

    async def flaky_discovery(*, max_new):
        raise RuntimeError("LLM provider unavailable")

    monkeypatch.setattr(scan_module, "run_discovery_pass", flaky_discovery)

    summary = await scan_module.run_scan_pass(run_discovery=True, store=store)

    assert summary["newCompaniesDiscovered"] == 0
