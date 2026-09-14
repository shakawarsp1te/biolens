"""
scan_company_for_new_papers() tests: a fake PubMedClient (same duck-typed
test-double pattern as test_catalysts.py's FakeClinicalTrialsClient) stands
in for real PubMed responses -- no network access.
"""

import pytest

from app.services.paper_monitor import scan_company_for_new_papers
from app.services.signal_store import SignalStore


class FakePubMedClient:
    def __init__(self, pmids_by_drug: dict[str, list[str]], summaries_by_pmid: dict[str, dict]):
        self._pmids_by_drug = pmids_by_drug
        self._summaries_by_pmid = summaries_by_pmid
        self.esummary_calls: list[list[str]] = []

    async def search_by_drug_name(self, drug_name, *, retmax=15):
        return self._pmids_by_drug.get(drug_name, [])

    async def esummary(self, pmids):
        self.esummary_calls.append(list(pmids))
        return [self._summaries_by_pmid[pmid] for pmid in pmids if pmid in self._summaries_by_pmid]


def _company(pipeline_drug_names: list[str], company_id="test-co") -> dict:
    return {
        "id": company_id,
        "pipeline": [{"drugName": name} for name in pipeline_drug_names],
    }


@pytest.fixture
def store(tmp_path):
    return SignalStore(db_path=str(tmp_path / "test_signals.sqlite3"))


@pytest.mark.asyncio
async def test_first_scan_establishes_baseline_without_reporting_anything(store):
    # A company's first-ever scan has nothing to diff against -- every
    # paper PubMed already has indexed would otherwise be reported as
    # "new" in one shot. Same first-visit convention as
    # watchlistFreshness.ts on mobile.
    client = FakePubMedClient(
        pmids_by_drug={"Onvansertib": ["111", "222", "333"]}, summaries_by_pmid={}
    )
    company = _company(["Onvansertib"])

    signals = await scan_company_for_new_papers(company, client=client, store=store)

    assert signals == []
    assert await store.get_seen_pmids("test-co") == {"111", "222", "333"}


@pytest.mark.asyncio
async def test_paper_appearing_after_the_baseline_is_reported_and_marked_seen(store):
    # A completed scan pass (what scan.py's orchestrator does after every
    # company, real or not) is what makes has_been_scanned true -- an
    # empty seen-set alone is ambiguous with "never scanned" and
    # deliberately not used as that signal (see signal_store.py).
    company = _company(["Onvansertib"])
    await store.mark_scanned("test-co", scanned_at="2026-08-01T00:00:00+00:00")

    client = FakePubMedClient(
        pmids_by_drug={"Onvansertib": ["111"]},
        summaries_by_pmid={
            "111": {
                "uid": "111",
                "title": "A new phase 2 readout",
                "fulljournalname": "Nature Medicine",
                "pubdate": "2026 Aug",
            }
        },
    )

    signals = await scan_company_for_new_papers(company, client=client, store=store)

    assert len(signals) == 1
    assert signals[0].id == "paper:111"
    assert signals[0].title == "A new phase 2 readout"
    assert signals[0].detail == "Nature Medicine"
    assert signals[0].source == "PubMed"
    assert signals[0].sourceUrl == "https://pubmed.ncbi.nlm.nih.gov/111/"

    # A repeat scan with the same result should report nothing new.
    signals_again = await scan_company_for_new_papers(company, client=client, store=store)
    assert signals_again == []


@pytest.mark.asyncio
async def test_only_the_new_pmid_is_summarized_not_the_whole_set(store):
    await store.set_seen_pmids("test-co", {"111"})
    await store.mark_scanned("test-co", scanned_at="2026-08-01T00:00:00+00:00")
    client = FakePubMedClient(
        pmids_by_drug={"Onvansertib": ["111", "222"]},
        summaries_by_pmid={
            "111": {"uid": "111", "title": "Old paper"},
            "222": {"uid": "222", "title": "New paper"},
        },
    )
    company = _company(["Onvansertib"])

    signals = await scan_company_for_new_papers(company, client=client, store=store)

    assert [s.id for s in signals] == ["paper:222"]
    assert client.esummary_calls == [["222"]]


@pytest.mark.asyncio
async def test_searches_every_drug_in_the_pipeline(store):
    await store.mark_scanned("test-co", scanned_at="2026-08-01T00:00:00+00:00")
    client = FakePubMedClient(
        pmids_by_drug={"DrugA": ["1"], "DrugB": ["2"]},
        summaries_by_pmid={
            "1": {"uid": "1", "title": "Paper about Drug A"},
            "2": {"uid": "2", "title": "Paper about Drug B"},
        },
    )
    company = _company(["DrugA", "DrugB"])

    signals = await scan_company_for_new_papers(company, client=client, store=store)

    assert {s.id for s in signals} == {"paper:1", "paper:2"}


@pytest.mark.asyncio
async def test_no_pipeline_drugs_returns_empty_without_calling_pubmed(store):
    client = FakePubMedClient(pmids_by_drug={}, summaries_by_pmid={})
    company = _company([])

    signals = await scan_company_for_new_papers(company, client=client, store=store)

    assert signals == []
