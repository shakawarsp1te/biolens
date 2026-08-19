"""Tests for Phase 8 Discover filtering."""

from app.services.discover import DiscoverFilters, DiscoverListing, apply_discover_filters
from app.services.frontier_score import CompanyMaturity

JANUX = DiscoverListing(
    company_id="janux",
    name="Janux Therapeutics",
    therapeutic_area="Oncology",
    stage="Phase I",
    maturity=CompanyMaturity.EMERGING,
    frontier_score=74,
    modalities=["Tumor-activated bispecific antibody (TRACTr)"],
    targets=["PSMA"],
)
CARDIFF = DiscoverListing(
    company_id="cardiff",
    name="Cardiff Oncology",
    therapeutic_area="Oncology",
    stage="Phase II",
    maturity=CompanyMaturity.EMERGING,
    frontier_score=58,
    modalities=["PLK1 inhibitor (small molecule)"],
    targets=["PLK1"],
)
ARVINAS = DiscoverListing(
    company_id="arvinas",
    name="Arvinas",
    therapeutic_area="Oncology",
    stage="Phase I/II",
    maturity=CompanyMaturity.SCALING,
    frontier_score=65,
    modalities=["PROTAC protein degrader"],
    targets=["KRAS"],
)
ALL_LISTINGS = [JANUX, CARDIFF, ARVINAS]


class TestApplyDiscoverFilters:
    def test_no_filters_returns_everything(self):
        result = apply_discover_filters(ALL_LISTINGS, DiscoverFilters())
        assert result == ALL_LISTINGS

    def test_filters_by_stage_exact_match(self):
        result = apply_discover_filters(ALL_LISTINGS, DiscoverFilters(stage="Phase II"))
        assert result == [CARDIFF]

    def test_stage_filter_is_case_insensitive(self):
        result = apply_discover_filters(ALL_LISTINGS, DiscoverFilters(stage="phase ii"))
        assert result == [CARDIFF]

    def test_filters_by_therapeutic_area(self):
        result = apply_discover_filters(ALL_LISTINGS, DiscoverFilters(therapeutic_area="Oncology"))
        assert result == ALL_LISTINGS

    def test_therapeutic_area_filter_excludes_non_matches(self):
        result = apply_discover_filters(
            ALL_LISTINGS, DiscoverFilters(therapeutic_area="Immunology")
        )
        assert result == []

    def test_filters_by_modality_substring(self):
        result = apply_discover_filters(ALL_LISTINGS, DiscoverFilters(modality="PROTAC"))
        assert result == [ARVINAS]

    def test_filters_by_target_substring_matches_partial_names(self):
        # "KRAS" should match a drug targeting "KRAS G12D", not just an
        # exact "KRAS" target name.
        listings = [
            DiscoverListing(
                company_id="x",
                name="X",
                therapeutic_area="Oncology",
                stage="Phase I",
                maturity=CompanyMaturity.EMERGING,
                frontier_score=50,
                targets=["KRAS G12D"],
            )
        ]
        result = apply_discover_filters(listings, DiscoverFilters(target="KRAS"))
        assert len(result) == 1

    def test_filters_by_maturity(self):
        result = apply_discover_filters(
            ALL_LISTINGS, DiscoverFilters(maturity=CompanyMaturity.SCALING)
        )
        assert result == [ARVINAS]

    def test_combining_filters_is_an_and(self):
        result = apply_discover_filters(
            ALL_LISTINGS, DiscoverFilters(therapeutic_area="Oncology", stage="Phase I")
        )
        assert result == [JANUX]

    def test_no_matches_returns_empty_list(self):
        result = apply_discover_filters(ALL_LISTINGS, DiscoverFilters(stage="Phase III"))
        assert result == []

    def test_target_filter_with_no_matching_drugs_excludes_company(self):
        result = apply_discover_filters(ALL_LISTINGS, DiscoverFilters(target="EGFR"))
        assert result == []
