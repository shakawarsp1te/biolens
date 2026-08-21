"""
Tests for ask_biolens's retry-with-repair, citation validation, and the
deterministic empty-package fast path.

Same caveat as test_readout_extraction.py / test_interpretation_service.py:
this proves BioLens's own orchestration logic against a FakeLLMProvider
double. As of Aug 20, 2026 a real ANTHROPIC_API_KEY exists in this
environment and AnthropicProvider itself has been separately verified live
(see docs/CHECKLIST.md's Phase 10 entry) — this file doesn't re-exercise
that real call, it exercises the logic around it.
"""

from __future__ import annotations

import pytest

from app.services.ask_biolens import (
    INSUFFICIENT_EVIDENCE_MESSAGE,
    AskBioLensError,
    ask_biolens,
)
from app.services.llm import LLMProvider, LLMResponse


class FakeLLMProvider(LLMProvider):
    def __init__(self, results: list):
        self._results = list(results)
        self.calls: list[dict] = []

    async def complete(self, *, system: str, prompt: str, json_mode: bool = False) -> LLMResponse:
        raise NotImplementedError("not used by ask_biolens")

    async def complete_structured(self, *, system, prompt, response_model):
        self.calls.append({"system": system, "prompt": prompt})
        if not self._results:
            raise AssertionError("FakeLLMProvider ran out of programmed results")
        result = self._results.pop(0)
        if isinstance(result, Exception):
            raise result
        return response_model(**result)


@pytest.mark.asyncio
async def test_empty_package_short_circuits_without_calling_llm():
    provider = FakeLLMProvider([])  # would raise AssertionError if called
    result = await ask_biolens(
        question="Why does this matter?", facts=[], calculated=[], provider=provider
    )
    assert result.has_sufficient_evidence is False
    assert result.answer == INSUFFICIENT_EVIDENCE_MESSAGE
    assert provider.calls == []


@pytest.mark.asyncio
async def test_sufficient_evidence_returns_the_models_answer():
    provider = FakeLLMProvider(
        [
            {
                "has_sufficient_evidence": True,
                "answer": "PLK1 is a mitotic kinase overexpressed in RAS-mutated cancers.",
                "source_ids_used": ["src-1"],
            }
        ]
    )
    result = await ask_biolens(
        question="Why is PLK1 important?",
        facts=["PLK1 is a mitotic kinase."],
        calculated=[],
        source_ids=["src-1"],
        provider=provider,
    )
    assert result.has_sufficient_evidence is True
    assert "mitotic kinase" in result.answer
    assert result.source_ids_used == ["src-1"]


@pytest.mark.asyncio
async def test_insufficient_evidence_from_model_always_uses_exact_message():
    # Even if the model's own `answer` field says something else, the
    # service must substitute the exact brief-mandated sentence -- never
    # trust the model's own wording for this.
    provider = FakeLLMProvider(
        [
            {
                "has_sufficient_evidence": False,
                "answer": "I'm not totally sure, but maybe...",
                "source_ids_used": [],
            }
        ]
    )
    result = await ask_biolens(
        question="What will Phase III need to show?",
        facts=["Some fact."],
        calculated=[],
        provider=provider,
    )
    assert result.has_sufficient_evidence is False
    assert result.answer == INSUFFICIENT_EVIDENCE_MESSAGE


@pytest.mark.asyncio
async def test_fabricated_citation_triggers_a_retry():
    provider = FakeLLMProvider(
        [
            {
                "has_sufficient_evidence": True,
                "answer": "Some answer.",
                "source_ids_used": ["src-999"],  # not in the provided package
            },
            {
                "has_sufficient_evidence": True,
                "answer": "Corrected answer.",
                "source_ids_used": ["src-1"],
            },
        ]
    )
    result = await ask_biolens(
        question="Who competes with this drug?",
        facts=["A fact."],
        calculated=[],
        source_ids=["src-1"],
        provider=provider,
    )
    assert result.answer == "Corrected answer."
    assert len(provider.calls) == 2


@pytest.mark.asyncio
async def test_repair_prompt_names_the_fabricated_citation():
    provider = FakeLLMProvider(
        [
            {"has_sufficient_evidence": True, "answer": "x", "source_ids_used": ["src-999"]},
            {"has_sufficient_evidence": True, "answer": "y", "source_ids_used": []},
        ]
    )
    await ask_biolens(
        question="q", facts=["f"], calculated=[], source_ids=["src-1"], provider=provider
    )
    repair_prompt = provider.calls[1]["prompt"]
    assert "src-999" in repair_prompt
    assert "not in the provided research package" in repair_prompt


@pytest.mark.asyncio
async def test_gives_up_after_max_repair_attempts_if_still_fabricating_citations():
    provider = FakeLLMProvider(
        [
            {"has_sufficient_evidence": True, "answer": "x", "source_ids_used": ["src-999"]},
            {"has_sufficient_evidence": True, "answer": "y", "source_ids_used": ["src-999"]},
            {"has_sufficient_evidence": True, "answer": "z", "source_ids_used": ["src-999"]},
        ]
    )
    with pytest.raises(AskBioLensError) as exc_info:
        await ask_biolens(
            question="q",
            facts=["f"],
            calculated=[],
            source_ids=["src-1"],
            provider=provider,
            max_repair_attempts=2,
        )
    assert exc_info.value.attempts == 3


@pytest.mark.asyncio
async def test_system_prompt_forbids_outside_knowledge():
    provider = FakeLLMProvider(
        [{"has_sufficient_evidence": True, "answer": "x", "source_ids_used": []}]
    )
    await ask_biolens(question="q", facts=["f"], calculated=[], provider=provider)
    system_prompt = provider.calls[0]["system"].lower()
    assert "only" in system_prompt
    assert "general knowledge" in system_prompt


@pytest.mark.asyncio
async def test_calculated_alone_without_facts_is_still_a_non_empty_package():
    provider = FakeLLMProvider(
        [{"has_sufficient_evidence": True, "answer": "x", "source_ids_used": []}]
    )
    result = await ask_biolens(
        question="q", facts=[], calculated=["18/30 = 60%"], provider=provider
    )
    assert len(provider.calls) == 1
    assert result.has_sufficient_evidence is True
