"""
Router-level tests for POST /analyze/interpretation.

All provider-dependent behavior is monkeypatched — never dependent on
whether a real ANTHROPIC_API_KEY happens to be configured in this
environment. See test_readout_router.py's module docstring for why.
"""

from fastapi.testclient import TestClient

import app.routers.interpretation as interpretation_router_module
from app.main import app
from app.models.domain import AnalysisClaimType
from app.services.interpretation import InterpretationError, InterpretedClaim

client = TestClient(app)


def test_returns_503_when_no_provider_configured(monkeypatch):
    async def fake_generate_interpretation(
        *, facts, calculated, source_ids=None, provider=None, max_repair_attempts=2
    ):
        raise RuntimeError("No LLM provider is configured yet.")

    monkeypatch.setattr(
        interpretation_router_module, "generate_interpretation", fake_generate_interpretation
    )

    response = client.post("/analyze/interpretation", json={"facts": ["A fact."]})
    assert response.status_code == 503


def test_returns_claims_and_evidence_classification_on_success(monkeypatch):
    async def fake_generate_interpretation(
        *, facts, calculated, source_ids=None, provider=None, max_repair_attempts=2
    ):
        return [InterpretedClaim(claim_type=AnalysisClaimType.FACT, content="A fact.")]

    monkeypatch.setattr(
        interpretation_router_module, "generate_interpretation", fake_generate_interpretation
    )

    response = client.post(
        "/analyze/interpretation",
        json={
            "facts": ["A fact."],
            "primary_endpoint_met": True,
            "is_single_arm": False,
            "sample_size": 200,
            "follow_up_adequate": True,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["evidence_classification"] == "confirmatory_positive"
    assert body["claims"][0]["content"] == "A fact."


def test_evidence_classification_computed_even_with_no_facts(monkeypatch):
    async def fake_generate_interpretation(
        *, facts, calculated, source_ids=None, provider=None, max_repair_attempts=2
    ):
        return []

    monkeypatch.setattr(
        interpretation_router_module, "generate_interpretation", fake_generate_interpretation
    )

    response = client.post("/analyze/interpretation", json={"primary_endpoint_met": False})
    assert response.status_code == 200
    assert response.json()["evidence_classification"] == "negative_primary_endpoint"


def test_returns_422_when_interpretation_fails_after_retries(monkeypatch):
    async def fake_generate_interpretation(
        *, facts, calculated, source_ids=None, provider=None, max_repair_attempts=2
    ):
        raise InterpretationError("gave up", attempts=3, last_error="investment language")

    monkeypatch.setattr(
        interpretation_router_module, "generate_interpretation", fake_generate_interpretation
    )

    response = client.post("/analyze/interpretation", json={"facts": ["A fact."]})
    assert response.status_code == 422


def test_defaults_to_empty_facts_and_calculated(monkeypatch):
    # Should not 422 on a completely empty body — confirms the request
    # model's defaults (facts=[], calculated=[]) work, independent of
    # whatever the provider does with them.
    async def fake_generate_interpretation(
        *, facts, calculated, source_ids=None, provider=None, max_repair_attempts=2
    ):
        assert facts == []
        assert calculated == []
        return []

    monkeypatch.setattr(
        interpretation_router_module, "generate_interpretation", fake_generate_interpretation
    )

    response = client.post("/analyze/interpretation", json={})
    assert response.status_code == 200
