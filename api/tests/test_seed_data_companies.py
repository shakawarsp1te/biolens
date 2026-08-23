"""
Guards the actual seed content in app/seed_data/companies.py -- not just
the store/router plumbing. Runs on every test invocation, so a future edit
to the seed data that breaks CompanyProfileModel's shape, introduces a
duplicate id, or reintroduces investment language fails CI immediately
instead of only being caught by manually re-running scripts/seed_companies.py.
"""

from app.models.company import CompanyProfileModel
from app.seed_data.companies import COMPANIES

_BANNED_PHRASES = ["buy rating", "price target", "strong buy", "sell rating", "we recommend"]


def test_every_seed_company_matches_the_profile_model():
    for raw in COMPANIES:
        CompanyProfileModel(**raw)  # raises on any shape mismatch


def test_seed_company_ids_are_unique():
    ids = [c["id"] for c in COMPANIES]
    assert len(ids) == len(set(ids))


def test_seed_has_at_least_ten_companies():
    assert len(COMPANIES) >= 10


def test_no_investment_language_in_any_narrative_field():
    for company in COMPANIES:
        text = " ".join(
            [
                company["biolensSummary"],
                company["oneSentenceSummary"],
                company["keyRisk"],
                *company["whyItMatters"],
                *company["whyItSurfaced"],
            ]
        ).lower()
        for phrase in _BANNED_PHRASES:
            assert phrase not in text, f"{company['name']!r} contains banned phrase {phrase!r}"


def test_every_pipeline_asset_has_a_well_formed_nct_id_or_none():
    import re

    nct_pattern = re.compile(r"^NCT\d{8}$")
    for company in COMPANIES:
        for asset in company["pipeline"]:
            for trial_id in asset["trialIds"]:
                assert nct_pattern.match(trial_id), (
                    f"{company['name']!r}'s {asset['drugName']!r} has a malformed trial id: "
                    f"{trial_id!r}"
                )
