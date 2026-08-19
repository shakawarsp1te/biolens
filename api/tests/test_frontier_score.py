"""Tests for the Phase 8 Frontier Score calculator and maturity classifier."""

import pytest

from app.services.frontier_score import (
    FRONTIER_SCORE_EXPLANATION,
    CompanyMaturity,
    FrontierScoreComponents,
    calculate_frontier_score,
    classify_maturity,
)


class TestFrontierScoreComponents:
    def test_rejects_value_above_100(self):
        with pytest.raises(ValueError, match="between 0 and 100"):
            FrontierScoreComponents(
                clinical_momentum=101,
                scientific_novelty=50,
                evidence_maturity=50,
                catalyst_activity=50,
                strategic_validation=50,
            )

    def test_rejects_negative_value(self):
        with pytest.raises(ValueError, match="between 0 and 100"):
            FrontierScoreComponents(
                clinical_momentum=-1,
                scientific_novelty=50,
                evidence_maturity=50,
                catalyst_activity=50,
                strategic_validation=50,
            )

    def test_accepts_boundary_values(self):
        FrontierScoreComponents(
            clinical_momentum=0,
            scientific_novelty=100,
            evidence_maturity=0,
            catalyst_activity=100,
            strategic_validation=0,
        )


class TestCalculateFrontierScore:
    def test_all_components_equal_returns_that_value(self):
        # Weights sum to 100%, so uniform inputs should pass straight
        # through regardless of the weighting split.
        components = FrontierScoreComponents(
            clinical_momentum=70,
            scientific_novelty=70,
            evidence_maturity=70,
            catalyst_activity=70,
            strategic_validation=70,
        )
        assert calculate_frontier_score(components) == 70

    def test_all_zero_is_zero(self):
        components = FrontierScoreComponents(0, 0, 0, 0, 0)
        assert calculate_frontier_score(components) == 0

    def test_all_hundred_is_hundred(self):
        components = FrontierScoreComponents(100, 100, 100, 100, 100)
        assert calculate_frontier_score(components) == 100

    def test_matches_build_brief_weights_exactly(self):
        # BUILD_BRIEF.txt §53: 30/20/20/15/15. Isolate each component at
        # 100 with everything else at 0 to confirm the actual weight used.
        assert calculate_frontier_score(FrontierScoreComponents(100, 0, 0, 0, 0)) == 30
        assert calculate_frontier_score(FrontierScoreComponents(0, 100, 0, 0, 0)) == 20
        assert calculate_frontier_score(FrontierScoreComponents(0, 0, 100, 0, 0)) == 20
        assert calculate_frontier_score(FrontierScoreComponents(0, 0, 0, 100, 0)) == 15
        assert calculate_frontier_score(FrontierScoreComponents(0, 0, 0, 0, 100)) == 15

    def test_realistic_mixed_scores(self):
        # Janux-shaped profile: strong clinical momentum and novelty,
        # moderate evidence maturity (Phase I), modest catalyst/strategic.
        components = FrontierScoreComponents(
            clinical_momentum=80,
            scientific_novelty=75,
            evidence_maturity=40,
            catalyst_activity=60,
            strategic_validation=30,
        )
        # 80*.3 + 75*.2 + 40*.2 + 60*.15 + 30*.15 = 24+15+8+9+4.5 = 60.5 -> 60 or 61 by rounding
        assert calculate_frontier_score(components) == round(60.5)

    def test_result_always_an_int(self):
        components = FrontierScoreComponents(33, 33, 33, 33, 33)
        result = calculate_frontier_score(components)
        assert isinstance(result, int)

    def test_explanation_copy_never_implies_investment_return(self):
        # BUILD_BRIEF.txt §53: never imply "higher score = higher future
        # return", and must say what it actually ranks.
        lowered = FRONTIER_SCORE_EXPLANATION.lower()
        assert "return" not in lowered
        assert "invest" not in lowered or "not investment" in lowered
        assert "research activity" in lowered


class TestClassifyMaturity:
    def test_typical_clinical_stage_biotech_is_emerging(self):
        result = classify_maturity(
            is_publicly_traded=True,
            is_primarily_biotech_focused=True,
            has_clinical_stage_program=True,
            has_diversified_commercial_portfolio=False,
            value_depends_significantly_on_pipeline=True,
        )
        assert result == CompanyMaturity.EMERGING

    def test_one_approved_drug_but_still_pipeline_dependent_stays_emerging(self):
        # Real case from Phase 2 seed data: Nuvation Bio and Kura Oncology
        # each have exactly one approved product but no diversified
        # portfolio, and most of their value still rests on pipeline
        # execution -- the brief's criteria say Emerging, not Scaling.
        result = classify_maturity(
            is_publicly_traded=True,
            is_primarily_biotech_focused=True,
            has_clinical_stage_program=True,
            has_diversified_commercial_portfolio=False,
            value_depends_significantly_on_pipeline=True,
        )
        assert result == CompanyMaturity.EMERGING

    def test_diversified_commercial_portfolio_is_established(self):
        result = classify_maturity(
            is_publicly_traded=True,
            is_primarily_biotech_focused=False,
            has_clinical_stage_program=True,
            has_diversified_commercial_portfolio=True,
            value_depends_significantly_on_pipeline=False,
        )
        assert result == CompanyMaturity.ESTABLISHED

    def test_established_wins_even_if_still_biotech_focused(self):
        # A diversified portfolio is Established regardless of the biotech
        # framing -- it's the strongest signal in the brief's ordering.
        result = classify_maturity(
            is_publicly_traded=True,
            is_primarily_biotech_focused=True,
            has_clinical_stage_program=True,
            has_diversified_commercial_portfolio=True,
            value_depends_significantly_on_pipeline=True,
        )
        assert result == CompanyMaturity.ESTABLISHED

    def test_no_longer_pipeline_dependent_but_not_diversified_is_scaling(self):
        result = classify_maturity(
            is_publicly_traded=True,
            is_primarily_biotech_focused=True,
            has_clinical_stage_program=True,
            has_diversified_commercial_portfolio=False,
            value_depends_significantly_on_pipeline=False,
        )
        assert result == CompanyMaturity.SCALING

    def test_not_publicly_traded_qualifies_for_no_tier(self):
        # §12's Emerging criteria explicitly require public trading; a
        # private company doesn't cleanly fit any of the three tiers from
        # these inputs.
        result = classify_maturity(
            is_publicly_traded=False,
            is_primarily_biotech_focused=True,
            has_clinical_stage_program=True,
            has_diversified_commercial_portfolio=False,
            value_depends_significantly_on_pipeline=True,
        )
        assert result is None

    def test_no_clinical_stage_program_is_not_emerging(self):
        result = classify_maturity(
            is_publicly_traded=True,
            is_primarily_biotech_focused=True,
            has_clinical_stage_program=False,
            has_diversified_commercial_portfolio=False,
            value_depends_significantly_on_pipeline=True,
        )
        assert result != CompanyMaturity.EMERGING
