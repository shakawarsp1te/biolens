"""
Tests for the Phase 6 deterministic statistics parser. Several tests use
the real captured abstract for Cardiff Oncology's CRDF-004 trial (fetched
live from PubMed in Phase 4 — see tests/fixtures/) as a real-world fixture,
not just synthetic strings.
"""

import pytest

from app.models.domain import EndpointRole
from app.services.stats_parser import (
    CROSS_TRIAL_COMPARISON_WARNING,
    INTERIM_THRESHOLD_UNAVAILABLE_WARNING,
    SINGLE_ARM_WARNING,
    ConfidenceInterval,
    EndpointType,
    PValueResult,
    classify_endpoint_role,
    classify_endpoint_type,
    detect_single_arm,
    extract_sample_size,
    format_orr_display,
    frame_hazard_ratio,
    parse_confidence_interval,
    parse_orr,
    single_arm_warning,
)

# Real abstract text (Cardiff Oncology CRDF-004, PMID 39475591, JCO 2025) —
# fetched live via /pubmed/nct/NCT06106308 during Phase 4 verification.
REAL_CRDF004_ABSTRACT = (
    "This phase II study evaluated the efficacy and tolerability of onvansertib, a "
    "polo-like kinase 1 (PLK1) inhibitor, in combination with fluorouracil, leucovorin, "
    "and irinotecan (FOLFIRI) + bevacizumab for the second-line treatment of KRAS-mutant "
    "metastatic colorectal cancer. This multicenter, open-label, single-arm study "
    "enrolled patients. Among the 53 patients treated, the confirmed ORR was 26.4% "
    "(95% CI, 15.3 to 40.3). The median DOR was 11.7 months (95% CI, 9.4 to not reached). "
    "Grade 3/4 adverse events were reported in 62% of patients. A post hoc analysis "
    "revealed that patients with no prior bevacizumab treatment had a significantly "
    "higher ORR."
)


class TestClassifyEndpointType:
    @pytest.mark.parametrize(
        "label,expected",
        [
            ("Overall Survival", EndpointType.TIME_TO_EVENT),
            ("Progression-Free Survival", EndpointType.TIME_TO_EVENT),
            ("progression-free survival", EndpointType.TIME_TO_EVENT),
            ("Duration of Response", EndpointType.TIME_TO_EVENT),
            ("Objective Response Rate", EndpointType.BINARY),
            ("Overall Response Rate", EndpointType.BINARY),
            ("Complete Response Rate", EndpointType.BINARY),
            ("Change in tumor biomarker level", EndpointType.CONTINUOUS),
            ("Symptom Score", EndpointType.CONTINUOUS),
        ],
    )
    def test_known_labels(self, label, expected):
        assert classify_endpoint_type(label) == expected

    def test_unrecognized_label_returns_none_not_a_guess(self):
        assert classify_endpoint_type("Some Unrelated Nonsense Metric") is None


class TestExtractSampleSize:
    def test_finds_n_equals_pattern(self):
        assert extract_sample_size("The trial enrolled n=110 patients.") == 110

    def test_finds_among_the_n_patients_pattern(self):
        assert extract_sample_size(REAL_CRDF004_ABSTRACT) == 53

    def test_finds_n_patients_treated_pattern(self):
        assert extract_sample_size("A total of 42 patients were treated across all cohorts.") == 42

    def test_no_match_returns_none(self):
        assert extract_sample_size("This text has no sample size mentioned at all.") is None


class TestParseOrr:
    def test_requires_explicit_fraction_not_percentage_alone(self):
        # BUILD_BRIEF.txt §34's whole point — this real abstract states a
        # percentage (26.4%) and separately a sample size (53), but never an
        # explicit responder count. Reconstructing "14 of 53" from those two
        # numbers would be fabrication; the parser must refuse instead.
        assert parse_orr(REAL_CRDF004_ABSTRACT) is None

    def test_slash_format(self):
        result = parse_orr("12/20 patients responded to treatment.")
        assert result.responders == 12
        assert result.evaluable == 20

    def test_of_format(self):
        result = parse_orr("The confirmed ORR was 14 of 53 evaluable patients.")
        assert result.responders == 14
        assert result.evaluable == 53

    def test_display_never_shows_bare_percentage(self):
        result = parse_orr("12 of 20 patients responded.")
        assert result.display == "12 of 20 evaluable patients (ORR 60.0%)"
        assert result.display.index("12 of 20") < result.display.index("60.0%")

    def test_responders_exceeding_evaluable_is_rejected(self):
        assert parse_orr("25 of 20 patients responded.") is None

    def test_zero_evaluable_is_rejected(self):
        assert parse_orr("0 of 0 patients responded.") is None


class TestFormatOrrDisplay:
    def test_denominator_always_shown_before_percentage(self):
        display = format_orr_display(12, 20)
        assert display == "12 of 20 evaluable patients (ORR 60.0%)"

    def test_rejects_zero_evaluable(self):
        with pytest.raises(ValueError, match="positive"):
            format_orr_display(0, 0)

    def test_rejects_responders_greater_than_evaluable(self):
        with pytest.raises(ValueError, match="between 0 and evaluable"):
            format_orr_display(25, 20)

    def test_rejects_negative_responders(self):
        with pytest.raises(ValueError):
            format_orr_display(-1, 20)


class TestParseConfidenceInterval:
    def test_numeric_ci_from_real_abstract(self):
        ci = parse_confidence_interval(REAL_CRDF004_ABSTRACT)
        assert ci == ConfidenceInterval(level=95, low=15.3, high=40.3)

    def test_not_reached_upper_bound_from_real_abstract(self):
        dor_sentence = "The median DOR was 11.7 months (95% CI, 9.4 to not reached)."
        ci = parse_confidence_interval(dor_sentence)
        assert ci.level == 95
        assert ci.low == 9.4
        assert ci.high is None

    def test_display_shows_not_reached_not_none(self):
        ci = ConfidenceInterval(level=95, low=9.4, high=None)
        assert ci.display == "95% CI: 9.4 to not reached"

    def test_no_ci_in_text_returns_none(self):
        assert parse_confidence_interval("No interval mentioned here.") is None

    def test_inverted_bounds_raise_rather_than_silently_accept(self):
        with pytest.raises(ValueError, match="less than lower bound"):
            parse_confidence_interval("95% CI, 40.3 to 15.3")


class TestFrameHazardRatio:
    def test_hr_below_one_is_framed_as_lower_hazard(self):
        text = frame_hazard_ratio(0.7)
        assert "30.0% lower instantaneous hazard" in text

    def test_hr_above_one_is_framed_as_higher_hazard(self):
        text = frame_hazard_ratio(1.3)
        assert "30.0% higher instantaneous hazard" in text

    def test_hr_of_exactly_one_is_framed_as_equivalent(self):
        text = frame_hazard_ratio(1.0)
        assert "statistically equivalent" in text

    def test_never_says_percent_of_patients_saved(self):
        # The brief's two specific banned phrasings.
        for hr in [0.3, 0.7, 1.0, 1.5, 2.0]:
            text = frame_hazard_ratio(hr).lower()
            assert "% of patients" not in text
            assert "lived" not in text
            assert "saved" not in text

    def test_custom_event_description(self):
        text = frame_hazard_ratio(0.5, event_description="disease recurrence")
        assert "disease recurrence" in text

    def test_rejects_non_positive_hr(self):
        with pytest.raises(ValueError):
            frame_hazard_ratio(0)
        with pytest.raises(ValueError):
            frame_hazard_ratio(-0.5)


class TestPValueResult:
    def test_display_shows_raw_value_only(self):
        result = PValueResult(value=0.02)
        assert result.display() == "p = 0.02"

    def test_never_labels_significant_or_not_significant(self):
        for value in [0.001, 0.049, 0.05, 0.051, 0.5]:
            display = PValueResult(value=value).display().lower()
            assert "significant" not in display
            assert "success" not in display

    def test_interim_without_prespecified_boundary_shows_warning(self):
        result = PValueResult(value=0.03, is_interim_analysis=True, has_prespecified_boundary=False)
        assert INTERIM_THRESHOLD_UNAVAILABLE_WARNING in result.display()

    def test_interim_with_prespecified_boundary_does_not_show_warning(self):
        result = PValueResult(value=0.03, is_interim_analysis=True, has_prespecified_boundary=True)
        assert INTERIM_THRESHOLD_UNAVAILABLE_WARNING not in result.display()

    def test_non_interim_never_shows_interim_warning(self):
        result = PValueResult(value=0.03, is_interim_analysis=False)
        assert INTERIM_THRESHOLD_UNAVAILABLE_WARNING not in result.display()


class TestClassifyEndpointRole:
    def test_primary_endpoint(self):
        assert classify_endpoint_role("The primary endpoint was met.") == EndpointRole.PRIMARY

    def test_secondary_endpoint(self):
        assert (
            classify_endpoint_role("A key secondary endpoint showed improvement.")
            == EndpointRole.SECONDARY
        )

    def test_exploratory_endpoint(self):
        assert (
            classify_endpoint_role("This was an exploratory endpoint.") == EndpointRole.EXPLORATORY
        )

    def test_post_hoc_counts_as_exploratory(self):
        assert (
            classify_endpoint_role("A post hoc analysis revealed a subgroup effect.")
            == EndpointRole.EXPLORATORY
        )

    def test_real_abstract_post_hoc_sentence_is_exploratory(self):
        # Real text: mentions both "post hoc" and (implicitly via ORR)
        # secondary-feeling content — post hoc must still win, since §28
        # says primary/secondary/exploratory must not be treated equally,
        # and post hoc analyses carry the least inferential weight.
        sentence = (
            "A post hoc analysis revealed that patients with no prior bevacizumab "
            "treatment had a significantly higher ORR."
        )
        assert classify_endpoint_role(sentence) == EndpointRole.EXPLORATORY

    def test_no_marker_returns_none(self):
        assert classify_endpoint_role("The drug was well tolerated.") is None


class TestSingleArmDetection:
    def test_detects_single_arm_from_real_abstract(self):
        assert detect_single_arm(REAL_CRDF004_ABSTRACT) is True

    def test_detects_single_arm_hyphen_variant(self):
        assert detect_single_arm("This was a single arm study.") is True

    def test_randomized_controlled_trial_is_not_single_arm(self):
        assert (
            detect_single_arm("This randomized, placebo-controlled trial enrolled 200 patients.")
            is False
        )

    def test_single_arm_warning_present_when_true(self):
        assert single_arm_warning(True) == SINGLE_ARM_WARNING

    def test_single_arm_warning_absent_when_false(self):
        assert single_arm_warning(False) is None

    def test_warning_never_implies_beat_a_control(self):
        # BUILD_BRIEF.txt §36: never word this as though a control was beaten.
        warning = single_arm_warning(True).lower()
        assert "beat" not in warning
        assert "outperform" not in warning
        assert "control group" in warning


class TestCrossTrialComparisonWarning:
    def test_warning_text_exists_and_is_nonempty(self):
        # This is a constant used by feature code elsewhere (§37) — just
        # confirm it says what it needs to say.
        assert "approximate" in CROSS_TRIAL_COMPARISON_WARNING
        assert "differ" in CROSS_TRIAL_COMPARISON_WARNING
