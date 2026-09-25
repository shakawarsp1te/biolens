"""Suite-wide safety: api/.env holds a real ANTHROPIC_API_KEY for local
runs, and Settings reads it automatically. Blank it for every test so no
code path can make a real (billed) LLM call during `pytest` -- tests that
need a model inject a FakeLLMProvider explicitly."""

import pytest

from app.core.config import get_settings


@pytest.fixture(autouse=True)
def _no_real_llm_key(monkeypatch):
    monkeypatch.setattr(get_settings(), "anthropic_api_key", "")
