"""
Tests for app/services/llm.py's provider-selection logic and
NotConfiguredProvider's fail-loudly behavior.

AnthropicProvider itself is NOT tested here — it would require a real
ANTHROPIC_API_KEY, which isn't available in this environment. See that
class's docstring and app/services/llm.py's module docstring.
"""

from __future__ import annotations

import pytest

from app.core.config import Settings
from app.models.domain import ReadoutExtraction
from app.services.llm import AnthropicProvider, NotConfiguredProvider, get_llm_provider


@pytest.mark.asyncio
async def test_not_configured_provider_complete_raises_runtime_error():
    provider = NotConfiguredProvider()
    with pytest.raises(RuntimeError, match="ANTHROPIC_API_KEY"):
        await provider.complete(system="sys", prompt="prompt")


@pytest.mark.asyncio
async def test_not_configured_provider_complete_structured_raises_runtime_error():
    provider = NotConfiguredProvider()
    with pytest.raises(RuntimeError, match="ANTHROPIC_API_KEY"):
        await provider.complete_structured(
            system="sys", prompt="prompt", response_model=ReadoutExtraction
        )


def test_get_llm_provider_returns_not_configured_when_no_key(monkeypatch):
    monkeypatch.setattr(
        "app.core.config.get_settings",
        lambda: Settings(llm_provider="anthropic", anthropic_api_key=""),
    )
    assert isinstance(get_llm_provider(), NotConfiguredProvider)


def test_get_llm_provider_returns_anthropic_provider_when_key_present(monkeypatch):
    monkeypatch.setattr(
        "app.core.config.get_settings",
        lambda: Settings(llm_provider="anthropic", anthropic_api_key="sk-ant-fake-key-for-test"),
    )
    provider = get_llm_provider()
    assert isinstance(provider, AnthropicProvider)


def test_get_llm_provider_returns_not_configured_for_unknown_provider(monkeypatch):
    # llm_provider set to something other than "anthropic" with no matching
    # implementation should fail safe, not silently fall through to a
    # provider it didn't ask for.
    monkeypatch.setattr(
        "app.core.config.get_settings",
        lambda: Settings(llm_provider="some-future-provider", anthropic_api_key="sk-ant-fake"),
    )
    assert isinstance(get_llm_provider(), NotConfiguredProvider)
