"""filing_impact tests: which filings get a call, how a filing's CIK and
accession are read back from its signal, and the never-raise contract --
against a fake SEC client and FakeLLMProvider, no network."""

import pytest

from app.services.filing_impact import (
    _parse_source_url,
    assess_filing_signals,
    build_filing_prompt,
    should_assess,
)
from app.services.llm import LLMProvider, LLMResponse, NotConfiguredProvider
from app.services.sec_edgar import html_to_text

GOOD = {
    "direction": "likely_negative",
    "confidence": "moderate",
    "headline": "The company is raising money by selling new shares, diluting current holders.",
    "reasoning": "The filing prices an offering. It extends runway into 2028.",
    "key_findings": ["Offering of 10 million shares"],
    "caveats": ["Final use of proceeds may change"],
}
COMPANY = {"id": "acme", "name": "Acme Bio", "ticker": "ACME", "pipeline": []}
URL = "https://www.sec.gov/Archives/edgar/data/1234/000123456726000001/acme8k.htm"


class FakeLLMProvider(LLMProvider):
    def __init__(self, results):
        self._results = list(results)
        self.prompts = []

    async def complete(self, *, system, prompt, json_mode=False) -> LLMResponse:
        raise NotImplementedError

    async def complete_structured(self, *, system, prompt, response_model):
        self.prompts.append(prompt)
        result = self._results.pop(0)
        if isinstance(result, Exception):
            raise result
        return response_model(**result)


class FakeSec:
    def __init__(self, filings, text="Exhibit 99.1 Acme prices offering."):
        self._filings = filings
        self._text = text

    async def get_cik(self, ticker):
        return "0000001234"

    async def get_submissions(self, cik):
        return {
            "filings": {
                "recent": {
                    "accessionNumber": [f[0] for f in self._filings],
                    "form": [f[1] for f in self._filings],
                    "items": [f[2] for f in self._filings],
                }
            }
        }

    async def get_filing_text(self, cik, accession, document):
        return self._text


def _signal(accession_digits: str) -> dict:
    return {
        "id": f"filing:{accession_digits}",
        "companyId": "acme",
        "signalType": "new_filing",
        "occurredAt": "2026-09-09",
        "sourceUrl": f"https://www.sec.gov/Archives/edgar/data/1234/{accession_digits}/doc.htm",
        "impact": None,
    }


def test_should_assess_material_forms_only():
    assert should_assess("8-K", ["8.01"])
    assert should_assess("S-3", [])
    assert not should_assess("10-Q", [])
    assert not should_assess("8-K", ["5.07", "9.01"])  # vote results + exhibits only
    assert should_assess("8-K", ["2.02", "9.01"])


def test_source_url_round_trips_to_cik_accession_document():
    assert _parse_source_url(URL) == ("1234", "0001234567-26-000001", "acme8k.htm")
    assert _parse_source_url("https://example.com/nope") is None


def test_prompt_explains_8k_items():
    prompt = build_filing_prompt(COMPANY, form="8-K", items=["1.01"], filed="2026-09-09", text="t")
    assert "material agreement" in prompt
    assert "Acme Bio" in prompt


def test_html_to_text_drops_markup_and_hidden_xbrl_header():
    markup = "<ix:header><x>hidden</x></ix:header><p>Acme&nbsp;reports <b>data</b></p>"
    assert html_to_text(markup) == "Acme reports data"


@pytest.mark.asyncio
async def test_assesses_material_filing_and_marks_routine_one():
    sec = FakeSec(
        [
            ("0001234567-26-000001", "8-K", "8.01"),
            ("0001234567-26-000002", "10-Q", ""),
        ]
    )
    provider = FakeLLMProvider([GOOD])
    signals = await assess_filing_signals(
        COMPANY,
        [_signal("000123456726000001"), _signal("000123456726000002")],
        sec_client=sec,
        provider=provider,
    )
    assert signals[0]["impact"]["direction"] == "likely_negative"
    assert signals[1]["impact"] is None
    assert signals[1]["notAssessed"] == "routine_or_report_form"
    assert len(provider.prompts) == 1
    assert "other events" in provider.prompts[0]


@pytest.mark.asyncio
async def test_no_llm_configured_is_a_silent_no_op():
    signals = [_signal("000123456726000001")]
    result = await assess_filing_signals(
        COMPANY, signals, sec_client=FakeSec([]), provider=NotConfiguredProvider()
    )
    assert result[0]["impact"] is None


@pytest.mark.asyncio
async def test_failed_call_leaves_signal_unassessed_for_retry():
    sec = FakeSec([("0001234567-26-000001", "8-K", "8.01")])
    signals = await assess_filing_signals(
        COMPANY,
        [_signal("000123456726000001")],
        sec_client=sec,
        provider=FakeLLMProvider([RuntimeError("API down")]),
    )
    assert signals[0]["impact"] is None
    assert "notAssessed" not in signals[0]
