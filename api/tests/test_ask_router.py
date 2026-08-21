"""
Router-level tests for POST /analyze/ask. All provider-dependent behavior
monkeypatched -- never dependent on whether a real ANTHROPIC_API_KEY happens
to be configured (see test_readout_router.py's module docstring for why).
"""

from fastapi.testclient import TestClient

import app.routers.ask as ask_router_module
from app.main import app
from app.services.ask_biolens import AskBioLensError, AskBioLensResult

client = TestClient(app)


def test_rejects_empty_question():
    response = client.post("/analyze/ask", json={"question": "", "facts": ["A fact."]})
    assert response.status_code == 422


def test_rejects_whitespace_only_question():
    response = client.post("/analyze/ask", json={"question": "   ", "facts": ["A fact."]})
    assert response.status_code == 422


def test_returns_503_when_no_provider_configured(monkeypatch):
    async def fake_ask_biolens(
        *, question, facts, calculated, source_ids=None, provider=None, max_repair_attempts=2
    ):
        raise RuntimeError("No LLM provider is configured yet.")

    monkeypatch.setattr(ask_router_module, "ask_biolens", fake_ask_biolens)

    response = client.post(
        "/analyze/ask", json={"question": "Why does this matter?", "facts": ["f"]}
    )
    assert response.status_code == 503


def test_returns_answer_on_success(monkeypatch):
    async def fake_ask_biolens(
        *, question, facts, calculated, source_ids=None, provider=None, max_repair_attempts=2
    ):
        assert question == "Why is PLK1 important?"
        return AskBioLensResult(
            answer="PLK1 is a mitotic kinase.",
            has_sufficient_evidence=True,
            source_ids_used=["src-1"],
        )

    monkeypatch.setattr(ask_router_module, "ask_biolens", fake_ask_biolens)

    response = client.post(
        "/analyze/ask",
        json={
            "question": "Why is PLK1 important?",
            "facts": ["PLK1 is a kinase."],
            "source_ids": ["src-1"],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["has_sufficient_evidence"] is True
    assert body["answer"] == "PLK1 is a mitotic kinase."


def test_returns_422_when_ask_fails_after_retries(monkeypatch):
    async def fake_ask_biolens(
        *, question, facts, calculated, source_ids=None, provider=None, max_repair_attempts=2
    ):
        raise AskBioLensError("gave up", attempts=3, last_error="fabricated citation")

    monkeypatch.setattr(ask_router_module, "ask_biolens", fake_ask_biolens)

    response = client.post("/analyze/ask", json={"question": "q", "facts": ["f"]})
    assert response.status_code == 422


def test_defaults_to_empty_facts_and_calculated(monkeypatch):
    async def fake_ask_biolens(
        *, question, facts, calculated, source_ids=None, provider=None, max_repair_attempts=2
    ):
        assert facts == []
        assert calculated == []
        return AskBioLensResult(answer="insufficient", has_sufficient_evidence=False)

    monkeypatch.setattr(ask_router_module, "ask_biolens", fake_ask_biolens)

    response = client.post("/analyze/ask", json={"question": "q"})
    assert response.status_code == 200
