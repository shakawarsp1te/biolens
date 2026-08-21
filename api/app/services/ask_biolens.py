"""
PLAN.md Phase 10: Ask BioLens (BUILD_BRIEF.txt §57).

Three hard rules from the brief, each enforced by a specific piece of this
module rather than left to prompting alone:

1. "Questions must be answered from the current research package" (no
   open-web fallback) -- the system prompt instructs this, and
   _validate_citations below catches the one failure mode that's actually
   checkable: the model citing a source_id that was never in the package
   handed to it, which is a concrete sign it strayed outside the given
   context.
2. The exact fallback sentence when evidence is insufficient -- never
   trusted to the model's own wording. If has_sufficient_evidence is False,
   the router always substitutes INSUFFICIENT_EVIDENCE_MESSAGE verbatim,
   and an empty research package short-circuits to that message before an
   LLM call is even made (deterministic first, per §41's established
   pattern in Phases 6/7).
3. "Never fill gaps by hallucinating" -- same investment-language-style
   validator pattern as Phase 7's InterpretationOutput, applied here to
   catch fabricated citations instead.

IMPORTANT -- not live-verified when first written: see this repo's Phase 5/7
commits for why AnthropicProvider itself needed a real key to confirm. As of
Aug 20, 2026 a real key exists and this *is* live-verified — see the
"Verified live" note in docs/CHECKLIST.md's Phase 10 entry.
"""

from __future__ import annotations

from pydantic import BaseModel, Field, ValidationError

from app.services.llm import LLMProvider, get_llm_provider

INSUFFICIENT_EVIDENCE_MESSAGE = (
    "BioLens does not have enough verified information to answer this reliably."
)

ASK_BIOLENS_SYSTEM_PROMPT = (
    "You are Ask BioLens. You answer a question using ONLY the FACTS and CALCULATED values "
    "given to you as the current research package — never your own general knowledge, and "
    "never anything from outside this package. If the package doesn't contain enough "
    "information to answer reliably, set has_sufficient_evidence to false and leave answer "
    "empty — do not guess or fill the gap. Every claim you do make must be traceable to one "
    "of the given source_ids; list exactly which ones you drew on in source_ids_used. Never "
    "cite a source_id that wasn't given to you. Never use investment language: no buy/sell/"
    "price-target framing, no recommendation to invest. Keep answers plain-language and "
    "concise — this is a mobile app, not a research report."
)


class AskBioLensOutput(BaseModel):
    """Raw shape the LLM returns."""

    has_sufficient_evidence: bool
    answer: str
    source_ids_used: list[str] = Field(default_factory=list)


class AskBioLensResult(BaseModel):
    """What the service returns — has_sufficient_evidence's implication on
    `answer` is enforced here, not trusted from the model."""

    answer: str
    has_sufficient_evidence: bool
    source_ids_used: list[str] = Field(default_factory=list)


class AskBioLensError(Exception):
    """Raised when the model's answer still fails validation (most likely:
    citing a source_id outside the given package) after every repair
    attempt is exhausted."""

    def __init__(self, message: str, *, attempts: int, last_error: str):
        super().__init__(message)
        self.attempts = attempts
        self.last_error = last_error


def _build_prompt(
    question: str, facts: list[str], calculated: list[str], source_ids: list[str]
) -> str:
    fact_lines = "\n".join(f"- {fact}" for fact in facts) or "(none provided)"
    calculated_lines = "\n".join(f"- {value}" for value in calculated) or "(none provided)"
    source_lines = "\n".join(f"- {source_id}" for source_id in source_ids) or "(none provided)"
    return (
        f"FACTS:\n{fact_lines}\n\n"
        f"CALCULATED:\n{calculated_lines}\n\n"
        f"AVAILABLE source_ids (cite only from this list):\n{source_lines}\n\n"
        f"QUESTION: {question}"
    )


def _build_repair_prompt(
    question: str,
    facts: list[str],
    calculated: list[str],
    source_ids: list[str],
    previous_error: str,
) -> str:
    return (
        f"{_build_prompt(question, facts, calculated, source_ids)}\n\n"
        f"Your previous attempt failed validation: {previous_error}\n\n"
        "Fix it and try again — in particular, only cite source_ids from the AVAILABLE list above."
    )


def _validate_citations(output: AskBioLensOutput, source_ids: list[str]) -> None:
    unknown = [sid for sid in output.source_ids_used if sid not in source_ids]
    if unknown:
        raise ValueError(
            f"cited source_id(s) not in the provided research package: {unknown} "
            f"(available: {source_ids})"
        )


async def ask_biolens(
    *,
    question: str,
    facts: list[str],
    calculated: list[str],
    source_ids: list[str] | None = None,
    provider: LLMProvider | None = None,
    max_repair_attempts: int = 2,
) -> AskBioLensResult:
    source_ids = source_ids or []

    # Deterministic fast path (§41): an empty research package can never
    # support an answer, so don't spend an LLM call finding that out.
    if not facts and not calculated:
        return AskBioLensResult(answer=INSUFFICIENT_EVIDENCE_MESSAGE, has_sufficient_evidence=False)

    provider = provider or get_llm_provider()
    last_error: str | None = None
    output: AskBioLensOutput | None = None

    for _attempt in range(max_repair_attempts + 1):
        prompt = (
            _build_prompt(question, facts, calculated, source_ids)
            if last_error is None
            else _build_repair_prompt(question, facts, calculated, source_ids, last_error)
        )
        try:
            candidate = await provider.complete_structured(
                system=ASK_BIOLENS_SYSTEM_PROMPT,
                prompt=prompt,
                response_model=AskBioLensOutput,
            )
            _validate_citations(candidate, source_ids)
            output = candidate
            break
        except (ValidationError, ValueError) as exc:
            last_error = str(exc)
            continue

    if output is None:
        assert last_error is not None
        raise AskBioLensError(
            f"Ask BioLens failed validation after {max_repair_attempts + 1} attempt(s)",
            attempts=max_repair_attempts + 1,
            last_error=last_error,
        )

    if not output.has_sufficient_evidence:
        # Never trust the model's own wording for this — always the exact
        # brief-mandated sentence.
        return AskBioLensResult(answer=INSUFFICIENT_EVIDENCE_MESSAGE, has_sufficient_evidence=False)

    return AskBioLensResult(
        answer=output.answer,
        has_sufficient_evidence=True,
        source_ids_used=output.source_ids_used,
    )
