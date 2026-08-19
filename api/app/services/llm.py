"""
LLMProvider abstraction (PLAN.md §2, §8): every LLM call in BioLens goes
through this interface. Feature code (readout ingestion, interpretation
layer, Ask BioLens) must depend on `LLMProvider`, never on a specific vendor
SDK, so the backend can swap providers without touching feature code.

Phase 5 implements the first real call (AnthropicProvider.complete_structured,
used by app/services/readout_extraction.py). Phases 7/10 will add more uses
of this same interface, not new ones.

IMPORTANT — not live-verified: this was written against the documented
Anthropic Python SDK (client.messages.parse, output_format=<PydanticModel>)
with no ANTHROPIC_API_KEY available in this environment, so it has not been
exercised against the real API. app/services/readout_extraction.py's own
retry-with-repair orchestration *is* thoroughly tested, but only against a
FakeLLMProvider test double — see tests/test_readout_extraction.py's module
docstring. Treat AnthropicProvider itself as unverified until it's actually
run with a real key.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import TypeVar

from pydantic import BaseModel

ResponseModel = TypeVar("ResponseModel", bound=BaseModel)


@dataclass
class LLMResponse:
    text: str
    raw: dict | None = None


class LLMProvider(ABC):
    @abstractmethod
    async def complete(self, *, system: str, prompt: str, json_mode: bool = False) -> LLMResponse:
        """Return a free-text completion. Callers that need structured,
        validated output should use complete_structured instead — this
        method does not parse or validate anything."""
        raise NotImplementedError

    @abstractmethod
    async def complete_structured(
        self, *, system: str, prompt: str, response_model: type[ResponseModel]
    ) -> ResponseModel:
        """Return a completion validated against response_model. Vendor
        implementations should use native structured-output support where
        available (e.g. Anthropic's client.messages.parse) rather than
        hand-parsing JSON, since schema-constrained decoding catches most
        malformed-output failures before they ever reach the caller.

        Still raises pydantic.ValidationError for failures the schema alone
        can't catch (e.g. a cross-field validator on response_model) —
        callers that want retry-with-repair (PLAN.md Phase 5) implement that
        retry loop themselves around this method; it does not retry on its
        own. See app/services/readout_extraction.py for that loop."""
        raise NotImplementedError


class NotConfiguredProvider(LLMProvider):
    """Default provider until a real API key is set. Fails loudly instead of
    silently returning fabricated text — BioLens never invents content."""

    async def complete(self, *, system: str, prompt: str, json_mode: bool = False) -> LLMResponse:
        raise RuntimeError(
            "No LLM provider is configured yet. Set ANTHROPIC_API_KEY in .env "
            "before calling complete()."
        )

    async def complete_structured(
        self, *, system: str, prompt: str, response_model: type[ResponseModel]
    ) -> ResponseModel:
        raise RuntimeError(
            "No LLM provider is configured yet. Set ANTHROPIC_API_KEY in .env "
            "before calling complete_structured()."
        )


class AnthropicProvider(LLMProvider):
    """Not live-verified — see this module's docstring."""

    def __init__(self, *, api_key: str, model: str = "claude-opus-5"):
        import anthropic

        self._client = anthropic.AsyncAnthropic(api_key=api_key)
        self._model = model

    async def complete(self, *, system: str, prompt: str, json_mode: bool = False) -> LLMResponse:
        kwargs: dict = {}
        if json_mode:
            # No specific schema at this generic layer — just ask for bare
            # JSON. Callers that know their schema should use
            # complete_structured instead, which gets real schema-constrained
            # decoding via output_format.
            system = f"{system}\n\nRespond with valid JSON only. No prose, no markdown fences."
        response = await self._client.messages.create(
            model=self._model,
            max_tokens=4096,
            system=system,
            messages=[{"role": "user", "content": prompt}],
            **kwargs,
        )
        text = next((block.text for block in response.content if block.type == "text"), "")
        return LLMResponse(text=text, raw=response.model_dump())

    async def complete_structured(
        self, *, system: str, prompt: str, response_model: type[ResponseModel]
    ) -> ResponseModel:
        response = await self._client.messages.parse(
            model=self._model,
            max_tokens=4096,
            system=system,
            messages=[{"role": "user", "content": prompt}],
            output_format=response_model,
        )
        return response.parsed_output


def get_llm_provider() -> LLMProvider:
    from app.core.config import get_settings

    settings = get_settings()
    if settings.llm_provider == "anthropic" and settings.anthropic_api_key:
        return AnthropicProvider(api_key=settings.anthropic_api_key)
    return NotConfiguredProvider()
