"""paper_impact tests: validation of investment-instruction language, the
repair loop, and assess_paper_signals' never-raise contract -- all against a
FakeLLMProvider and a fake PubMed client, no network."""

import pytest
from pydantic import ValidationError

from app.services.llm import LLMProvider, LLMResponse, NotConfiguredProvider
from app.services.paper_impact import (
    PaperImpactError,
    PaperImpactOutput,
    assess_paper,
    assess_paper_signals,
)

GOOD = {
    "direction": "likely_positive",
    "confidence": "moderate",
    "headline": "Early human data suggest the drug is working as designed.",
    "reasoning": "The abstract reports target degradation in patients. It is single-arm.",
    "key_findings": ["Target protein fell in tumor biopsies"],
    "caveats": ["No control arm"],
}

COMPANY = {
    "id": "acme",
    "name": "Acme Bio",
    "ticker": "ACME",
    "pipeline": [{"drugName": "AC-1", "modality": "Degrader", "target": "ER", "disease": "BC"}],
}


class FakeLLMProvider(LLMProvider):
    def __init__(self, results):
        self._results = list(results)
        self.calls = []

    async def complete(self, *, system, prompt, json_mode=False) -> LLMResponse:
        raise NotImplementedError

    async def complete_structured(self, *, system, prompt, response_model):
        self.calls.append(prompt)
        result = self._results.pop(0)
        if isinstance(result, Exception):
            raise result
        return response_model(**result)


class FakePubMed:
    def __init__(self, abstracts):
        self._abstracts = abstracts

    async def efetch_abstracts(self, pmids):
        return [a for a in self._abstracts if a["pmid"] in pmids]


def _paper_signal(pmid: str) -> dict:
    return {
        "id": f"paper:{pmid}",
        "companyId": "acme",
        "signalType": "new_paper",
        "title": "A paper",
        "detail": "Journal",
        "occurredAt": "2026 Sep",
        "detectedAt": "2026-09-25T15:00:00+00:00",
        "impact": None,
    }


@pytest.mark.parametrize(
    "text",
    [
        "Investors should buy ACME.",
        "A good time to sell.",
        "Our price target is $20.",
        "The stock will rise.",
    ],
)
def test_investment_instruction_language_is_rejected(text):
    with pytest.raises(ValidationError):
        PaperImpactOutput(**{**GOOD, "reasoning": text})


def test_words_containing_banned_substrings_are_fine():
    output = PaperImpactOutput(**{**GOOD, "reasoning": "A buyout is not implied by this data."})
    assert output.direction.value == "likely_positive"


@pytest.mark.asyncio
async def test_repair_loop_recovers_from_one_bad_attempt():
    bad = {**GOOD, "headline": "Time to buy."}
    provider = FakeLLMProvider([_validation_error(bad), GOOD])
    output = await assess_paper(company=COMPANY, paper={"title": "t"}, provider=provider)
    assert output.headline == GOOD["headline"]
    assert "failed validation" in provider.calls[1]


@pytest.mark.asyncio
async def test_repair_loop_gives_up_after_max_attempts():
    bad = {**GOOD, "headline": "Time to buy."}
    provider = FakeLLMProvider([_validation_error(bad)] * 3)
    with pytest.raises(PaperImpactError):
        await assess_paper(company=COMPANY, paper={"title": "t"}, provider=provider)


@pytest.mark.asyncio
async def test_assess_attaches_impact_and_skips_papers_without_abstract():
    pubmed = FakePubMed(
        [
            {"pmid": "1", "title": "T1", "abstract": "Real abstract."},
            {"pmid": "2", "title": "T2", "abstract": None},
        ]
    )
    provider = FakeLLMProvider([GOOD])
    signals = await assess_paper_signals(
        COMPANY, [_paper_signal("1"), _paper_signal("2")], pubmed_client=pubmed, provider=provider
    )
    assert signals[0]["impact"]["direction"] == "likely_positive"
    assert signals[0]["impact"]["keyFindings"] == GOOD["key_findings"]
    assert signals[1]["impact"] is None
    assert len(provider.calls) == 1


@pytest.mark.asyncio
async def test_no_llm_configured_is_a_silent_no_op():
    signals = [_paper_signal("1")]
    result = await assess_paper_signals(
        COMPANY, signals, pubmed_client=FakePubMed([]), provider=NotConfiguredProvider()
    )
    assert result[0]["impact"] is None


@pytest.mark.asyncio
async def test_one_failed_call_does_not_block_the_others():
    pubmed = FakePubMed(
        [
            {"pmid": "1", "title": "T1", "abstract": "A."},
            {"pmid": "2", "title": "T2", "abstract": "B."},
        ]
    )
    provider = FakeLLMProvider([RuntimeError("API down"), GOOD])
    signals = await assess_paper_signals(
        COMPANY, [_paper_signal("1"), _paper_signal("2")], pubmed_client=pubmed, provider=provider
    )
    assert signals[0]["impact"] is None
    assert signals[1]["impact"]["direction"] == "likely_positive"


def _validation_error(payload: dict) -> ValidationError:
    try:
        PaperImpactOutput(**payload)
    except ValidationError as error:
        return error
    raise AssertionError("payload was expected to fail validation")
