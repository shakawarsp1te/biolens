"""
LLMProvider abstraction (PLAN.md ​§2, §8): every LLM call in BioLens goes
through this interface. Feature code (readout ingestion, interpretation
layer, Ask BioLens) must depend on `LLMProvider`, never on a specific vendor
SDK, so the backend can swap providers without touching feature code.

Only a stub lives here today (Phase 0). Phases 5/7/10 implement real calls.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class LLMResponse:
    text: str
    raw: dict | None = None


class LLMProvider(ABC):
    @abstractmethod
    async def complete(self, *, system: str, prompt: str, json_mode: bool = False) -> LLMResponse:
        """Return a completion. Callers that need structured output should
        validate the result against a Pydantic model themselves and retry
        with a repair prompt on failure — this method does not do that."""
        raise NotImplementedError


class NotConfiguredProvider(LLMProvider):
    """Default provider until a real API key is set. Fails loudly instead of
    silently returning fabricated text — BioLens never invents content."""

    async def complete(self, *, system: str, prompt: str, json_mode: bool = False) -> LLMResponse:
        raise RuntimeError(
            "No LLM provider is configured yet. Set ANTHROPIC_API_KEY (or the "
            "relevant provider key) in .env and wire up a real provider "
            "implementation before calling complete()."
        )


def get_llm_provider() -> LLMProvider:
    # Phase 5+ will branch on settings.llm_provider here (anthropic/openai/etc).
    return NotConfiguredProvider()
