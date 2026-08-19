"""
Tests for the Phase 5 retry-with-repair orchestration in
app/services/readout_extraction.py.

IMPORTANT — what this file does and doesn't prove: AnthropicProvider itself
(app/services/llm.py) is untested here and unverified against the real API —
no ANTHROPIC_API_KEY is available in this environment. FakeLLMProvider below
is a hand-written test double implementing the same LLMProvider interface,
used to drive extract_readout's retry loop through controlled scenarios
(succeeds first try, fails then succeeds, fails every time) without a real
LLM call. That thoroughly tests the *orchestration logic BioLens owns*; it
proves nothing about whether AnthropicProvider's actual Anthropic SDK calls
are correct. That needs a real key.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.models.domain import ReadoutExtraction, TrialPhase
from app.services.llm import LLMProvider, LLMResponse
from app.services.readout_extraction import ReadoutExtractionError, extract_readout


class FakeLLMProvider(LLMProvider):
    """Returns a pre-programmed sequence of results (either a raw dict to
    validate against response_model, or an exception to raise) — one per
    call to complete_structured, in order. Records every prompt it was
    called with so tests can assert the repair prompt actually carries the
    previous error forward."""

    def __init__(self, results: list):
        self._results = list(results)
        self.calls: list[dict] = []

    async def complete(self, *, system: str, prompt: str, json_mode: bool = False) -> LLMResponse:
        raise NotImplementedError("not used by extract_readout")

    async def complete_structured(self, *, system, prompt, response_model):
        self.calls.append({"system": system, "prompt": prompt})
        if not self._results:
            raise AssertionError("FakeLLMProvider ran out of programmed results")
        result = self._results.pop(0)
        if isinstance(result, Exception):
            raise result
        return response_model(**result)


def _validation_error_for_bad_nct_id() -> ValidationError:
    try:
        ReadoutExtraction(nct_id="NCT 12345678")
    except ValidationError as exc:
        return exc
    raise AssertionError("expected ReadoutExtraction to reject this NCT ID")


@pytest.mark.asyncio
async def test_succeeds_on_first_attempt_without_retrying():
    provider = FakeLLMProvider([{"company_name": "Janux Therapeutics", "nct_id": "NCT05519449"}])
    result = await extract_readout("some readout text", provider=provider)
    assert result.company_name == "Janux Therapeutics"
    assert result.nct_id == "NCT05519449"
    assert len(provider.calls) == 1


@pytest.mark.asyncio
async def test_retries_after_validation_error_and_succeeds():
    provider = FakeLLMProvider(
        [
            _validation_error_for_bad_nct_id(),
            {"company_name": "Janux Therapeutics", "nct_id": "NCT05519449"},
        ]
    )
    result = await extract_readout("some readout text", provider=provider)
    assert result.nct_id == "NCT05519449"
    assert len(provider.calls) == 2


@pytest.mark.asyncio
async def test_repair_prompt_includes_the_previous_error():
    provider = FakeLLMProvider(
        [
            _validation_error_for_bad_nct_id(),
            {"nct_id": "NCT05519449"},
        ]
    )
    await extract_readout("some readout text", provider=provider)
    repair_prompt = provider.calls[1]["prompt"]
    assert "previous extraction attempt failed validation" in repair_prompt
    assert "NCT 12345678" in repair_prompt  # the actual bad value, not a generic message


@pytest.mark.asyncio
async def test_original_readout_text_carried_into_repair_prompt():
    provider = FakeLLMProvider([_validation_error_for_bad_nct_id(), {"nct_id": "NCT05519449"}])
    await extract_readout("Company X announced Phase II results today.", provider=provider)
    assert "Company X announced Phase II results today." in provider.calls[1]["prompt"]


@pytest.mark.asyncio
async def test_gives_up_after_max_repair_attempts_and_raises():
    provider = FakeLLMProvider(
        [
            _validation_error_for_bad_nct_id(),
            _validation_error_for_bad_nct_id(),
            _validation_error_for_bad_nct_id(),
        ]
    )
    with pytest.raises(ReadoutExtractionError) as exc_info:
        await extract_readout("some readout text", provider=provider, max_repair_attempts=2)

    assert exc_info.value.attempts == 3  # original attempt + 2 repairs
    assert len(provider.calls) == 3


@pytest.mark.asyncio
async def test_max_repair_attempts_zero_means_only_one_try():
    provider = FakeLLMProvider([_validation_error_for_bad_nct_id()])
    with pytest.raises(ReadoutExtractionError) as exc_info:
        await extract_readout("some readout text", provider=provider, max_repair_attempts=0)
    assert exc_info.value.attempts == 1
    assert len(provider.calls) == 1


@pytest.mark.asyncio
async def test_extracts_full_entity_set_when_all_present():
    provider = FakeLLMProvider(
        [
            {
                "company_name": "Cardiff Oncology",
                "drug_name": "Onvansertib",
                "target": "PLK1",
                "nct_id": "NCT06106308",
                "phase": TrialPhase.PHASE_II.value,
                "indication": "metastatic colorectal cancer",
            }
        ]
    )
    result = await extract_readout("readout text", provider=provider)
    assert result.company_name == "Cardiff Oncology"
    assert result.drug_name == "Onvansertib"
    assert result.target == "PLK1"
    assert result.phase == TrialPhase.PHASE_II
    assert result.indication == "metastatic colorectal cancer"


@pytest.mark.asyncio
async def test_extraction_with_no_entities_found_is_not_an_error():
    # An extraction where the model correctly found nothing (e.g. the text
    # isn't actually a trial readout) is a valid result, not a failure.
    provider = FakeLLMProvider([{}])
    result = await extract_readout("This is just a general news article.", provider=provider)
    assert result.company_name is None
    assert result.nct_id is None
