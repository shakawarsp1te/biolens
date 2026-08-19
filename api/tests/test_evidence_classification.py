"""Tests for classify_evidence — fully deterministic, no LLM involved."""

from app.models.domain import EvidenceClassification
from app.services.interpretation import classify_evidence


class TestNegativeOnPrimaryEndpoint:
    def test_failed_primary_endpoint_is_definitive(self):
        # BUILD_BRIEF.txt §39.4: the sole criterion is "primary endpoint not
        # met" — this should win regardless of anything else that's true.
        result = classify_evidence(
            primary_endpoint_met=False,
            is_single_arm=False,
            sample_size=500,
            follow_up_adequate=True,
        )
        assert result == EvidenceClassification.NEGATIVE_PRIMARY_ENDPOINT

    def test_failed_primary_endpoint_beats_single_arm_too(self):
        result = classify_evidence(primary_endpoint_met=False, is_single_arm=True, sample_size=10)
        assert result == EvidenceClassification.NEGATIVE_PRIMARY_ENDPOINT


class TestInconclusive:
    def test_unknown_whether_endpoint_was_met_is_inconclusive(self):
        result = classify_evidence(primary_endpoint_met=None, is_single_arm=False, sample_size=200)
        assert result == EvidenceClassification.INCONCLUSIVE

    def test_missing_sample_size_is_inconclusive(self):
        result = classify_evidence(primary_endpoint_met=True, is_single_arm=False, sample_size=None)
        assert result == EvidenceClassification.INCONCLUSIVE

    def test_inadequate_follow_up_is_inconclusive_even_with_met_endpoint(self):
        result = classify_evidence(
            primary_endpoint_met=True,
            is_single_arm=False,
            sample_size=500,
            follow_up_adequate=False,
        )
        assert result == EvidenceClassification.INCONCLUSIVE

    def test_small_controlled_trial_is_inconclusive_not_confirmatory(self):
        # Met endpoint, controlled (not single-arm), but small — §39.3's
        # "small cohort" beats an otherwise-clean result.
        result = classify_evidence(
            primary_endpoint_met=True,
            is_single_arm=False,
            sample_size=25,
            small_sample_threshold=40,
        )
        assert result == EvidenceClassification.INCONCLUSIVE


class TestEncouragingSignal:
    def test_single_arm_with_met_endpoint_is_encouraging_not_confirmatory(self):
        # BUILD_BRIEF.txt §39.2 explicitly lists single-arm as typical for
        # Encouraging Signal, not Confirmatory Positive, even when the
        # endpoint was "met."
        result = classify_evidence(
            primary_endpoint_met=True,
            is_single_arm=True,
            sample_size=500,
            follow_up_adequate=True,
        )
        assert result == EvidenceClassification.ENCOURAGING_SIGNAL

    def test_single_arm_small_sample_is_still_encouraging_not_inconclusive(self):
        # Single-arm status is checked before the sample-size cutoff — a
        # classic early-phase single-arm signal (small n) is exactly what
        # §39.2 describes as the typical Encouraging Signal case.
        result = classify_evidence(primary_endpoint_met=True, is_single_arm=True, sample_size=15)
        assert result == EvidenceClassification.ENCOURAGING_SIGNAL


class TestConfirmatoryPositive:
    def test_large_controlled_trial_with_met_endpoint(self):
        result = classify_evidence(
            primary_endpoint_met=True,
            is_single_arm=False,
            sample_size=500,
            follow_up_adequate=True,
        )
        assert result == EvidenceClassification.CONFIRMATORY_POSITIVE

    def test_follow_up_unknown_but_not_explicitly_inadequate_still_confirmatory(self):
        # follow_up_adequate=None ("not stated") is not the same as False
        # ("known inadequate") — only an explicit False should block
        # Confirmatory Positive.
        result = classify_evidence(
            primary_endpoint_met=True,
            is_single_arm=False,
            sample_size=500,
            follow_up_adequate=None,
        )
        assert result == EvidenceClassification.CONFIRMATORY_POSITIVE

    def test_exactly_at_sample_size_threshold_qualifies(self):
        result = classify_evidence(
            primary_endpoint_met=True,
            is_single_arm=False,
            sample_size=40,
            small_sample_threshold=40,
        )
        assert result == EvidenceClassification.CONFIRMATORY_POSITIVE

    def test_one_below_threshold_does_not_qualify(self):
        result = classify_evidence(
            primary_endpoint_met=True,
            is_single_arm=False,
            sample_size=39,
            small_sample_threshold=40,
        )
        assert result == EvidenceClassification.INCONCLUSIVE
