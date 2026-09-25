"""
Paper impact calls: for each new paper the continuous scan finds
(paper_monitor.py), a plain-language read on whether its findings are
likely good or bad news for the company -- direction, a categorical
confidence, the reasoning, and what the paper does NOT tell you.

Where the line sits, and why (see docs/PLAN.md §3):

- A call is about the COMPANY's prospects given the evidence, never a price
  prediction and never an instruction. "Likely positive for Arvinas" is in
  scope; "buy ARVN" or "ARVN will rise 10%" is not, and output containing
  that language is rejected and repaired, same as interpretation.py.
- Every call is the same for every user (impersonal, published on the scan's
  regular schedule) -- the conditions the investment-adviser "publisher's
  exclusion" rests on. Nothing here is ever tailored to a user's holdings.
- Every call is grounded only in the paper's own abstract plus the company's
  own profile; the reasoning has to show its work so a reader can disagree.
- Every call is later scored against what the stock actually did
  (signal_outcomes.py), and the track record reports every call, misses
  included -- a claimed "correlation" is something BioLens measures, not
  something it asserts.
"""

from __future__ import annotations

import logging
import re
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, ValidationError, field_validator

from app.models.domain import ConfidenceLevel
from app.services.llm import LLMProvider, NotConfiguredProvider, get_llm_provider
from app.services.pubmed import PubMedClient

logger = logging.getLogger("biolens.paper_impact")


class ImpactDirection(str, Enum):
    LIKELY_POSITIVE = "likely_positive"
    LIKELY_NEGATIVE = "likely_negative"
    MIXED = "mixed"
    # Most papers -- reviews, preclinical work on a well-known mechanism, a
    # drug named only in passing -- genuinely don't change a company's
    # prospects. Saying so plainly is a real, useful call, not a cop-out.
    UNLIKELY_TO_MATTER = "unlikely_to_matter"


# Whole-word patterns, so "buyout" or "wholesale" don't trip them.
_BANNED_PATTERNS = [
    r"\bbuy\b",
    r"\bbuying\b",
    r"\bsell\b",
    r"\bselling\b",
    r"\bprice target\b",
    r"\bshould invest\b",
    r"\bstrong buy\b",
    r"\boutperform rating\b",
    r"\bstock will\b",
    r"\bshares will\b",
    r"\bprice will\b",
]

PAPER_IMPACT_SYSTEM_PROMPT = (
    "You are BioLens's research analyst. Given ONE new scientific paper (title, journal, "
    "abstract) and the profile of the company whose pipeline it concerns, judge whether the "
    "paper's findings are likely good news, bad news, mixed, or unlikely to matter for that "
    "company's prospects -- the kind of read-through a careful biotech analyst gives a "
    "non-scientist investor.\n\n"
    "Rules:\n"
    "- Use ONLY the paper and company profile given. Never bring in outside facts, and never "
    "invent a number; any figure you cite must appear in the abstract.\n"
    "- First decide whether the paper is actually about this company's drug. A paper that "
    "only mentions the drug in passing, a general review, or work on a different drug with a "
    "similar name is 'unlikely_to_matter'.\n"
    "- Weigh evidence quality: preclinical/cell/animal work, small single-arm studies, and "
    "retrospective analyses move the needle far less than controlled clinical data. Say so.\n"
    "- Independent academic work that raises a safety signal or undercuts the mechanism can "
    "be negative even when it isn't about the company's own trial.\n"
    "- Confidence (high/moderate/low) reflects how clearly the evidence points one way, not "
    "how big the effect on the company would be. Default to low for preclinical work.\n"
    "- `headline` is one plain sentence (max ~25 words) a non-scientist understands.\n"
    "- `reasoning` is 2-4 sentences explaining why, in plain language.\n"
    "- `key_findings`: 1-4 specific findings from the abstract that drove the call.\n"
    "- `caveats`: 1-3 things the paper does NOT tell you (e.g. no control arm, mice only).\n"
    "- Never tell anyone to buy, sell, or hold; never predict a price, a price move, or a "
    "percentage change; never use rating language. Describe what the evidence means for the "
    "company, not what anyone should do about it."
)


class PaperImpactOutput(BaseModel):
    """Raw shape the LLM returns."""

    direction: ImpactDirection
    confidence: ConfidenceLevel
    headline: str
    reasoning: str
    key_findings: list[str] = Field(default_factory=list)
    caveats: list[str] = Field(default_factory=list)

    @field_validator("headline", "reasoning")
    @classmethod
    def no_investment_language_text(cls, value: str) -> str:
        _reject_investment_language(value)
        return value

    @field_validator("key_findings", "caveats")
    @classmethod
    def no_investment_language_list(cls, values: list[str]) -> list[str]:
        for value in values:
            _reject_investment_language(value)
        return values


def _reject_investment_language(text: str) -> None:
    lowered = text.lower()
    for pattern in _BANNED_PATTERNS:
        if re.search(pattern, lowered):
            raise ValueError(
                f"contains investment-instruction language ({pattern!r}): a call describes "
                "what the evidence means for the company, never what to do about the stock"
            )


class PaperImpactError(Exception):
    def __init__(self, message: str, *, attempts: int, last_error: str):
        super().__init__(message)
        self.attempts = attempts
        self.last_error = last_error


def _company_context(company: dict[str, Any]) -> str:
    pipeline_lines = "\n".join(
        f"- {asset.get('drugName')}: {asset.get('modality')} targeting {asset.get('target')} "
        f"in {asset.get('disease')} ({asset.get('stage')})"
        for asset in company.get("pipeline", [])
    )
    return (
        f"COMPANY: {company.get('name')}"
        f"{' (' + company['ticker'] + ')' if company.get('ticker') else ''}\n"
        f"Summary: {company.get('oneSentenceSummary') or company.get('biolensSummary') or ''}\n"
        f"Pipeline:\n{pipeline_lines or '(none listed)'}"
    )


def _build_prompt(company: dict[str, Any], paper: dict[str, Any]) -> str:
    return (
        f"{_company_context(company)}\n\n"
        f"PAPER\nTitle: {paper.get('title')}\n"
        f"Journal: {paper.get('journal') or 'unknown'}\n"
        f"Published: {paper.get('pubdate') or 'unknown'}\n"
        f"Abstract: {paper.get('abstract') or '(no abstract available)'}"
    )


async def assess_paper(
    *,
    company: dict[str, Any],
    paper: dict[str, Any],
    provider: LLMProvider,
    max_repair_attempts: int = 2,
) -> PaperImpactOutput:
    """One call for one paper, retrying with a repair prompt on validation
    failure (same orchestration as interpretation.generate_interpretation)."""
    last_error: ValidationError | None = None
    for _attempt in range(max_repair_attempts + 1):
        prompt = _build_prompt(company, paper)
        if last_error is not None:
            prompt += (
                "\n\nYour previous attempt failed validation with this error:\n"
                f"{last_error}\n\nFix it and try again. Only change what's wrong."
            )
        try:
            return await provider.complete_structured(
                system=PAPER_IMPACT_SYSTEM_PROMPT, prompt=prompt, response_model=PaperImpactOutput
            )
        except ValidationError as error:
            last_error = error
    raise PaperImpactError(
        "paper impact call failed validation after every repair attempt",
        attempts=max_repair_attempts + 1,
        last_error=str(last_error),
    )


def _pmid_from_signal(signal: dict[str, Any]) -> str | None:
    signal_id = signal.get("id", "")
    return signal_id.split(":", 1)[1] if signal_id.startswith("paper:") else None


async def assess_paper_signals(
    company: dict[str, Any],
    signals: list[dict[str, Any]],
    *,
    pubmed_client: PubMedClient,
    provider: LLMProvider | None = None,
) -> list[dict[str, Any]]:
    """Attaches an `impact` dict to each new-paper signal it can assess and
    returns the signals. Never raises: no LLM configured, a missing
    abstract, or a call that never validates all just leave that signal
    without an impact -- it still shows as a plain, sourced fact."""
    provider = provider or get_llm_provider()
    if isinstance(provider, NotConfiguredProvider):
        return signals

    paper_signals = [
        s for s in signals if s.get("signalType") == "new_paper" and s.get("impact") is None
    ]
    pmids = [pmid for s in paper_signals if (pmid := _pmid_from_signal(s))]
    if not pmids:
        return signals

    try:
        abstracts = {a["pmid"]: a for a in await pubmed_client.efetch_abstracts(pmids)}
    except Exception:
        logger.exception("abstract fetch failed for company %s", company.get("id"))
        return signals

    for signal in paper_signals:
        pmid = _pmid_from_signal(signal)
        article = abstracts.get(pmid or "")
        # A title alone is too thin to call direction on honestly.
        if article is None or not article.get("abstract"):
            continue
        paper = {
            "title": article.get("title") or signal.get("title"),
            "abstract": article.get("abstract"),
            "journal": signal.get("detail"),
            "pubdate": signal.get("occurredAt"),
        }
        try:
            output = await assess_paper(company=company, paper=paper, provider=provider)
        except Exception:
            logger.exception("impact call failed for paper %s", pmid)
            continue
        signal["impact"] = {
            "direction": output.direction.value,
            "confidence": output.confidence.value,
            "headline": output.headline,
            "reasoning": output.reasoning,
            "keyFindings": output.key_findings,
            "caveats": output.caveats,
        }
    return signals
