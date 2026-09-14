import pytest

from app.services.signal_store import SignalStore


@pytest.fixture
def store(tmp_path):
    return SignalStore(db_path=str(tmp_path / "test_signals.sqlite3"))


def _signal(signal_id="paper:111", company_id="test-co", detected_at="2026-08-25T00:00:00+00:00"):
    return {
        "id": signal_id,
        "companyId": company_id,
        "signalType": "new_paper",
        "title": "A real paper title",
        "detail": "Nature Medicine",
        "occurredAt": "2026 Aug",
        "detectedAt": detected_at,
        "source": "PubMed",
        "sourceUrl": "https://pubmed.ncbi.nlm.nih.gov/111/",
    }


@pytest.mark.asyncio
class TestSeenPmids:
    async def test_unseen_company_has_empty_set(self, store):
        assert await store.get_seen_pmids("nobody") == set()

    async def test_round_trips(self, store):
        await store.set_seen_pmids("test-co", {"1", "2", "3"})
        assert await store.get_seen_pmids("test-co") == {"1", "2", "3"}

    async def test_does_not_clobber_seen_accessions_for_the_same_company(self, store):
        await store.set_seen_accessions("test-co", {"acc-1"})
        await store.set_seen_pmids("test-co", {"1"})
        assert await store.get_seen_accessions("test-co") == {"acc-1"}
        assert await store.get_seen_pmids("test-co") == {"1"}


@pytest.mark.asyncio
class TestSeenAccessions:
    async def test_unseen_company_has_empty_set(self, store):
        assert await store.get_seen_accessions("nobody") == set()

    async def test_round_trips(self, store):
        await store.set_seen_accessions("test-co", {"0001-26-000001"})
        assert await store.get_seen_accessions("test-co") == {"0001-26-000001"}


@pytest.mark.asyncio
class TestSignals:
    async def test_add_and_list_for_company(self, store):
        await store.add_signals([_signal()])
        results = await store.list_signals_for_company("test-co")
        assert len(results) == 1
        assert results[0]["id"] == "paper:111"

    async def test_duplicate_id_is_not_inserted_twice(self, store):
        await store.add_signals([_signal()])
        await store.add_signals([_signal()])  # same id again
        results = await store.list_signals_for_company("test-co")
        assert len(results) == 1

    async def test_list_for_company_only_returns_that_company(self, store):
        await store.add_signals([_signal(signal_id="paper:1", company_id="co-a")])
        await store.add_signals([_signal(signal_id="paper:2", company_id="co-b")])
        assert len(await store.list_signals_for_company("co-a")) == 1
        assert len(await store.list_signals_for_company("co-b")) == 1

    async def test_list_for_company_orders_most_recent_first(self, store):
        await store.add_signals(
            [
                _signal(signal_id="paper:1", detected_at="2026-08-01T00:00:00+00:00"),
                _signal(signal_id="paper:2", detected_at="2026-08-25T00:00:00+00:00"),
            ]
        )
        results = await store.list_signals_for_company("test-co")
        assert [r["id"] for r in results] == ["paper:2", "paper:1"]

    async def test_list_for_company_respects_limit(self, store):
        await store.add_signals([_signal(signal_id=f"paper:{i}") for i in range(5)])
        results = await store.list_signals_for_company("test-co", limit=2)
        assert len(results) == 2

    async def test_list_recent_spans_companies(self, store):
        await store.add_signals(
            [
                _signal(signal_id="paper:1", company_id="co-a"),
                _signal(signal_id="paper:2", company_id="co-b"),
            ]
        )
        results = await store.list_recent_signals()
        assert {r["id"] for r in results} == {"paper:1", "paper:2"}

    async def test_empty_list_is_a_no_op(self, store):
        await store.add_signals([])
        assert await store.list_recent_signals() == []


@pytest.mark.asyncio
async def test_mark_scanned_does_not_raise(store):
    await store.mark_scanned("test-co", scanned_at="2026-08-25T00:00:00+00:00")


@pytest.mark.asyncio
class TestHasBeenScanned:
    async def test_false_for_a_company_never_scanned(self, store):
        assert await store.has_been_scanned("nobody") is False

    async def test_true_after_mark_scanned(self, store):
        await store.mark_scanned("test-co", scanned_at="2026-08-25T00:00:00+00:00")
        assert await store.has_been_scanned("test-co") is True

    async def test_not_conflated_with_an_empty_seen_set(self, store):
        # Setting an empty seen-set alone (distinct from never having
        # scanned at all) must not read as "has been scanned" -- that
        # ambiguity is exactly the bug this method exists to avoid.
        await store.set_seen_pmids("test-co", set())
        assert await store.has_been_scanned("test-co") is False
