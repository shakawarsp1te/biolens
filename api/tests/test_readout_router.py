"""
Router-level tests for POST /analyze/readout.

All provider-dependent behavior is monkeypatched, deliberately never
dependent on whether a real ANTHROPIC_API_KEY happens to be configured in
this environment — a test suite that behaves differently (or makes real,
billed API calls) depending on ambient .env state is a bug, not a feature.
See tests/test_readout_extraction.py and test_llm_provider.py for that
boundary: this file only checks router-level wiring and status-code mapping.
"""

from fastapi.testclient import TestClient

import app.routers.readout as readout_router_module
from app.main import app
from app.models.domain import ReadoutExtraction

client = TestClient(app)


def test_rejects_empty_text():
    response = client.post("/analyze/readout", json={"text": ""})
    assert response.status_code == 422


def test_rejects_whitespace_only_text():
    response = client.post("/analyze/readout", json={"text": "   "})
    assert response.status_code == 422


def test_returns_503_when_no_provider_configured(monkeypatch):
    # Forces the RuntimeError NotConfiguredProvider raises, rather than
    # relying on ANTHROPIC_API_KEY actually being unset — see this file's
    # module docstring for why that would be fragile.
    async def fake_extract_readout(text, *, provider=None, max_repair_attempts=2):
        raise RuntimeError("No LLM provider is configured yet.")

    monkeypatch.setattr(readout_router_module, "extract_readout", fake_extract_readout)

    response = client.post("/analyze/readout", json={"text": "Some readout text."})
    assert response.status_code == 503


def test_returns_parsed_extraction_on_success(monkeypatch):
    async def fake_extract_readout(text, *, provider=None, max_repair_attempts=2):
        assert text == "Company X announced Phase II results."
        return ReadoutExtraction(company_name="Company X", phase="Phase II")

    monkeypatch.setattr(readout_router_module, "extract_readout", fake_extract_readout)

    response = client.post(
        "/analyze/readout", json={"text": "Company X announced Phase II results."}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["company_name"] == "Company X"
    assert body["phase"] == "Phase II"


def test_returns_422_when_extraction_fails_after_retries(monkeypatch):
    from app.services.readout_extraction import ReadoutExtractionError

    async def fake_extract_readout(text, *, provider=None, max_repair_attempts=2):
        raise ReadoutExtractionError("gave up", attempts=3, last_error="bad nct_id")

    monkeypatch.setattr(readout_router_module, "extract_readout", fake_extract_readout)

    response = client.post("/analyze/readout", json={"text": "Some readout text."})
    assert response.status_code == 422


def test_readout_extraction_error_carries_diagnostic_fields():
    # Not a router test — confirms the exception's own fields, since the
    # router test above only checks the HTTP-level behavior.
    from app.services.readout_extraction import ReadoutExtractionError

    wrapped = ReadoutExtractionError("gave up", attempts=3, last_error="bad nct_id format")
    assert wrapped.attempts == 3
    assert wrapped.last_error == "bad nct_id format"
    assert str(wrapped) == "gave up"
