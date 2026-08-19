from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.models.domain import EndpointRole, ReadoutExtraction, TrialMetricKind, TrialResult


def _base_kwargs(**overrides):
    kwargs = dict(id=uuid4(), trial_id=uuid4(), kind=TrialMetricKind.GENERIC, label="Test metric")
    kwargs.update(overrides)
    return kwargs


def test_orr_requires_both_responders_and_evaluable():
    # Both present: fine.
    TrialResult(**_base_kwargs(kind=TrialMetricKind.ORR, responders=12, evaluable=20))


def test_orr_rejects_responders_without_evaluable():
    with pytest.raises(ValidationError):
        TrialResult(**_base_kwargs(kind=TrialMetricKind.ORR, responders=12))


def test_orr_rejects_evaluable_without_responders():
    with pytest.raises(ValidationError):
        TrialResult(**_base_kwargs(kind=TrialMetricKind.ORR, evaluable=20))


def test_generic_metric_allows_neither_responders_nor_evaluable():
    TrialResult(**_base_kwargs(kind=TrialMetricKind.GENERIC, value_text="8.4 months"))


def test_hazard_ratio_requires_caption():
    with pytest.raises(ValidationError):
        TrialResult(
            **_base_kwargs(
                kind=TrialMetricKind.HAZARD_RATIO,
                hazard_ratio=0.7,
                endpoint_role=EndpointRole.PRIMARY,
            )
        )


def test_hazard_ratio_with_caption_is_valid():
    TrialResult(
        **_base_kwargs(
            kind=TrialMetricKind.HAZARD_RATIO,
            hazard_ratio=0.7,
            endpoint_role=EndpointRole.PRIMARY,
            caption=(
                "The treatment group experienced an estimated 30% lower "
                "instantaneous hazard of progression or death over the analyzed period."
            ),
        )
    )


class TestReadoutExtractionNctIdValidation:
    def test_none_is_allowed(self):
        ReadoutExtraction(nct_id=None)

    def test_well_formed_id_is_normalized_uppercase(self):
        extraction = ReadoutExtraction(nct_id="nct05519449")
        assert extraction.nct_id == "NCT05519449"

    def test_already_correct_id_passes_through(self):
        extraction = ReadoutExtraction(nct_id="NCT05519449")
        assert extraction.nct_id == "NCT05519449"

    def test_space_before_digits_is_rejected(self):
        # The exact malformation LLMs commonly produce.
        with pytest.raises(ValidationError):
            ReadoutExtraction(nct_id="NCT 05519449")

    def test_hyphen_is_rejected(self):
        with pytest.raises(ValidationError):
            ReadoutExtraction(nct_id="NCT-05519449")

    def test_wrong_digit_count_is_rejected(self):
        with pytest.raises(ValidationError):
            ReadoutExtraction(nct_id="NCT123")

    def test_missing_prefix_is_rejected(self):
        with pytest.raises(ValidationError):
            ReadoutExtraction(nct_id="05519449")

    def test_all_fields_optional(self):
        # Every field null is valid — "nothing was stated in the text" is a
        # legitimate extraction result, not a failure.
        extraction = ReadoutExtraction()
        assert extraction.company_name is None
        assert extraction.phase is None
