"""
Tests for generate_interpretation's retry-with-repair orchestration and
claim assembly, using the same FakeLLMProvider pattern as
test_readout_extraction.py.

Same caveat as that file: this proves BioLens's own orchestration logic
(claim assembly, retry-with-repair, the investment-language guard) — it
does not exercise AnthropicProvider's real API call, which is unverified
in this environment (no ANTHROPIC_API_KEY).
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.models.domain import AnalysisClaimType, ConfidenceLevel
from app.services.interpretation import (
    InterpretationError,
    InterpretationOutput,
    generate_interpretation,
)
from app.services.llm import LLMProvider, LLMResponse


class FakeLLMProvider(LLMProvider):
    def __init__(self, results: list):
        self._results = list(results)
        self.calls: list[dict] = []

    async def complete(self, *, system: str, prompt: str, json_mode: bool = False) -> LLMResponse:
        raise NotImplementedError("not used by generate_interpretation")

    async def complete_structured(self, *, system, prompt, response_model):
        self.calls.append({"system": system, "prompt": prompt})
        if not self._results:
            raise AssertionError("FakeLLMProvider ran out of programmed results")
        result = self._results.pop(0)
        if isinstance(result, Exception):
            raise result
        return response_model(**result)


def _investment_language_error() -> ValidationError:
    try:
        InterpretationOutput(
            interpretation=[
                {"content": "Investors should buy this stock now.", "confidence": "high"}
            ]
        )
    except ValidationError as exc:
        return exc
    raise AssertionError("expected InterpretationOutput to reject investment language")


@pytest.mark.asyncio
async def test_assembles_fact_and_calculated_claims_without_calling_llm_for_them():
    provider = FakeLLMProvider([{}])
    claims = await generate_interpretation(
        facts=["Trial enrolled 142 participants."],
        calculated=["18/30 = 60% response rate."],
        provider=provider,
    )
    fact_claims = [c for c in claims if c.claim_type == AnalysisClaimType.FACT]
    calculated_claims = [c for c in claims if c.claim_type == AnalysisClaimType.CALCULATED]
    assert len(fact_claims) == 1
    assert fact_claims[0].content == "Trial enrolled 142 participants."
    assert len(calculated_claims) == 1
    assert calculated_claims[0].content == "18/30 = 60% response rate."


@pytest.mark.asyncio
async def test_fact_and_calculated_claims_have_no_confidence_from_llm():
    # FACT/CALCULATED are given, not judged — they shouldn't carry an
    # LLM-assigned confidence the way INTERPRETATION/SPECULATION do.
    provider = FakeLLMProvider([{}])
    claims = await generate_interpretation(
        facts=["Trial enrolled 142 participants."], calculated=[], provider=provider
    )
    assert claims[0].confidence is None


@pytest.mark.asyncio
async def test_interpretation_and_speculation_claims_come_from_the_llm():
    provider = FakeLLMProvider(
        [
            {
                "interpretation": [
                    {
                        "content": "Response appears encouraging for an early-stage cohort.",
                        "confidence": "moderate",
                    }
                ],
                "speculation": [
                    {
                        "content": (
                            "Positive larger-cohort data could increase partnership interest."
                        ),
                        "confidence": "low",
                    }
                ],
            }
        ]
    )
    claims = await generate_interpretation(facts=[], calculated=[], provider=provider)

    interpretation = [c for c in claims if c.claim_type == AnalysisClaimType.INTERPRETATION]
    speculation = [c for c in claims if c.claim_type == AnalysisClaimType.SPECULATION]
    assert len(interpretation) == 1
    assert interpretation[0].confidence == ConfidenceLevel.MODERATE
    assert len(speculation) == 1
    assert speculation[0].confidence == ConfidenceLevel.LOW


@pytest.mark.asyncio
async def test_source_ids_propagate_to_every_claim():
    provider = FakeLLMProvider(
        [{"interpretation": [{"content": "Some conclusion.", "confidence": "high"}]}]
    )
    claims = await generate_interpretation(
        facts=["A fact."],
        calculated=[],
        source_ids=["source-1", "source-2"],
        provider=provider,
    )
    assert all(c.source_ids == ["source-1", "source-2"] for c in claims)


@pytest.mark.asyncio
async def test_retries_on_validation_error_and_succeeds():
    provider = FakeLLMProvider([_investment_language_error(), {}])
    claims = await generate_interpretation(facts=[], calculated=[], provider=provider)
    assert (
        claims == []
    )  # no facts/calculated given, and the retry returned empty interpretation/speculation
    assert len(provider.calls) == 2


@pytest.mark.asyncio
async def test_repair_prompt_includes_previous_error():
    provider = FakeLLMProvider([_investment_language_error(), {}])
    await generate_interpretation(facts=[], calculated=[], provider=provider)
    assert "previous attempt failed validation" in provider.calls[1]["prompt"]
    assert "investment language" in provider.calls[1]["prompt"]


@pytest.mark.asyncio
async def test_gives_up_after_max_repair_attempts():
    provider = FakeLLMProvider(
        [_investment_language_error(), _investment_language_error(), _investment_language_error()]
    )
    with pytest.raises(InterpretationError) as exc_info:
        await generate_interpretation(
            facts=[], calculated=[], provider=provider, max_repair_attempts=2
        )
    assert exc_info.value.attempts == 3


@pytest.mark.asyncio
async def test_system_prompt_forbids_restating_facts_as_new_claims():
    provider = FakeLLMProvider([{}])
    await generate_interpretation(facts=["x"], calculated=[], provider=provider)
    assert "never restate" in provider.calls[0]["system"].lower()


class TestInterpretationOutputValidation:
    def test_rejects_buy_language(self):
        with pytest.raises(ValidationError):
            InterpretationOutput(
                interpretation=[
                    {"content": "Investors should buy this stock.", "confidence": "high"}
                ]
            )

    def test_rejects_sell_language(self):
        with pytest.raises(ValidationError):
            InterpretationOutput(
                speculation=[
                    {"content": "Analysts may recommend selling shares.", "confidence": "low"}
                ]
            )

    def test_rejects_price_target_language(self):
        with pytest.raises(ValidationError):
            InterpretationOutput(
                interpretation=[
                    {"content": "This supports a higher price target.", "confidence": "moderate"}
                ]
            )

    def test_accepts_clean_interpretation(self):
        InterpretationOutput(
            interpretation=[
                {
                    "content": "Response appears encouraging for an early-stage cohort.",
                    "confidence": "moderate",
                }
            ]
        )

    def test_defaults_to_empty_lists(self):
        output = InterpretationOutput()
        assert output.interpretation == []
        assert output.speculation == []
