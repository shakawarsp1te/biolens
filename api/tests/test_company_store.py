import pytest

from app.services.company_store import CompanyStore


def _profile(company_id="test-co", name="Test Co", review_status="verified"):
    return {
        "id": company_id,
        "name": name,
        "ticker": "TST",
        "status": "Emerging clinical-stage biotech",
        "primaryFocus": "Oncology",
        "technology": "Test technology",
        "biolensSummary": "A test summary.",
        "whyItMatters": ["Reason one."],
        "pipeline": [],
        "thesisMap": {"whatHasToGoRight": ["Thing one."], "whatCouldGoWrong": ["Risk one."]},
        "confidence": "moderate",
        "frontierScore": 50,
        "whyItSurfaced": ["Reason."],
        "oneSentenceSummary": "One sentence.",
        "keyRisk": "A risk.",
        "therapeuticArea": "Oncology",
        "stage": "Phase I",
        "maturity": "emerging",
        "modalities": ["Test modality"],
        "targets": ["TEST"],
        "isMockData": True,
        "reviewStatus": review_status,
        "source": "manual_research",
        "createdAt": "2026-08-23T00:00:00+00:00",
        "updatedAt": "2026-08-23T00:00:00+00:00",
        "lastVerifiedAt": "2026-08-23T00:00:00+00:00",
    }


@pytest.fixture
def store(tmp_path):
    return CompanyStore(db_path=str(tmp_path / "test_companies.sqlite3"))


@pytest.mark.asyncio
async def test_upsert_then_get_roundtrips_exactly(store):
    profile = _profile()
    await store.upsert_company(profile)
    fetched = await store.get_company("test-co")
    assert fetched == profile


@pytest.mark.asyncio
async def test_get_unknown_company_returns_none(store):
    assert await store.get_company("does-not-exist") is None


@pytest.mark.asyncio
async def test_list_companies_returns_all_sorted_by_name(store):
    await store.upsert_company(_profile("co-b", "Beta Bio"))
    await store.upsert_company(_profile("co-a", "Alpha Therapeutics"))
    listed = await store.list_companies()
    assert [c["name"] for c in listed] == ["Alpha Therapeutics", "Beta Bio"]


@pytest.mark.asyncio
async def test_upsert_with_same_id_overwrites(store):
    await store.upsert_company(_profile("test-co", "Original Name"))
    updated = _profile("test-co", "Updated Name")
    await store.upsert_company(updated)
    fetched = await store.get_company("test-co")
    assert fetched["name"] == "Updated Name"
    assert await store.count() == 1


@pytest.mark.asyncio
async def test_known_names_is_case_insensitive_lookup_set(store):
    await store.upsert_company(_profile("co-1", "Janux Therapeutics"))
    names = await store.known_names()
    assert "janux therapeutics" in names


@pytest.mark.asyncio
async def test_count_reflects_number_of_distinct_companies(store):
    assert await store.count() == 0
    await store.upsert_company(_profile("co-1", "Company One"))
    await store.upsert_company(_profile("co-2", "Company Two"))
    assert await store.count() == 2
