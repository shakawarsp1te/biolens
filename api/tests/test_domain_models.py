from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.models.domain import EndpointRole, TrialMetricKind, TrialResult


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
