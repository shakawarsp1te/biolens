"""
PLAN.md Phase 7: interpretation layer.

Two distinct halves, deliberately kept separate per BUILD_BRIEF.txt §41
("deterministic statistics before LLM — the LLM should explain results, it
should not perform critical arithmetic if code can do it"):

1. classify_evidence() — fully deterministic (§39). Confirmatory Positive /
   Encouraging Signal / Inconclusive / Negative on Primary Endpoint is a
   rule-based classification given known facts (was the primary endpoint
   met, is it single-arm, sample size, follow-up), not an LLM judgment call.

2. generate_interpretation() — the one place an LLM call belongs here: only
   for INTERPRETATION (analytical conclusions) and SPECULATION (explicit
   hypotheticals), given FACT and CALCULATED values as fixed context. The
   model never generates FACT or CALCULATED claims itself — those come from
   Phase 5 extraction and Phase 6's deterministic parser and are passed
   through unchanged (§42's four categories "should never be blurred").

IMPORTANT — not live-verified: generate_interpretation depends on
AnthropicProvider (app/services/llm.py), which has no real API key
available in this environment. Its retry-with-repair orchestration is
tested against a FakeLLMProvider double (same pattern as Phase 5's
readout_extraction), which proves BioLens's own logic but not the real
Anthropic call. classify_evidence needs no LLM and is fully verified.
"""

from __future__ import annotations

from pydantic import BaseModel, Field, ValidationError, field_validator

from app.models.domain import AnalysisClaimType, ConfidenceLevel, EvidenceClassification
from app.services.llm import LLMProvider, get_llm_provider

# ---------------------------------------------------------------------------
# 1. Deterministic evidence classification (§39, §41)
# ---------------------------------------------------------------------------


def classify_evidence(
    *,
    primary_endpoint_met: bool | None,
    is_single_arm: bool,
    sample_size: int | None,
    follow_up_adequate: bool | None = None,
    small_sample_threshold: int = 40,
) -> EvidenceClassification:
    """BUILD_BRIEF.txt §39's four categories, applied as an explicit
    decision order rather than an LLM judgment call:

    1. A failed primary endpoint is definitive regardless of anything else
       — §39.4 lists only "primary endpoint not met" as its criterion.
    2. Missing the basic facts needed to classify confidently (whether the
       endpoint was even met, or the sample size) is Inconclusive — §39.3
       lists "endpoint unclear" and "missing statistical context".
    3. Follow-up known to be inadequate is Inconclusive — §39.3's
       "insufficient follow-up".
    4. From here the primary endpoint was met. A single-arm trial is
       Encouraging Signal even on a met endpoint — §39.2 lists "single-arm
       trial" as typical for that category, not Confirmatory Positive.
    5. A small cohort (below small_sample_threshold) in a controlled trial
       is still Inconclusive — §39.3's "small cohort".
    6. Otherwise: primary endpoint met, controlled, adequately sized —
       Confirmatory Positive.
    """
    if primary_endpoint_met is False:
        return EvidenceClassification.NEGATIVE_PRIMARY_ENDPOINT
    if primary_endpoint_met is None or sample_size is None:
        return EvidenceClassification.INCONCLUSIVE
    if follow_up_adequate is False:
        return EvidenceClassification.INCONCLUSIVE
    if is_single_arm:
        return EvidenceClassification.ENCOURAGING_SIGNAL
    if sample_size < small_sample_threshold:
        return EvidenceClassification.INCONCLUSIVE
    return EvidenceClassification.CONFIRMATORY_POSITIVE


# ---------------------------------------------------------------------------
# 2. LLM interpretation + speculation (§42)
# ---------------------------------------------------------------------------

_BANNED_INVESTMENT_PHRASES = [
    "buy",
    "sell",
    "price target",
    "should invest",
    "recommend buying",
    "recommend selling",
]

INTERPRETATION_SYSTEM_PROMPT = (
    "You write analytical interpretation and speculation for biotech clinical "
    "readouts. You are given verified FACTS and CALCULATED values as fixed "
    "context — never restate them as your own claims, never invent a new "
    "fact or number. Write INTERPRETATION as grounded analytical conclusions "
    "that follow from the given facts (example: 'Response appears "
    "encouraging for an early-stage cohort'). Write SPECULATION as "
    "explicitly hypothetical, forward-looking scenarios (example: 'Positive "
    "larger-cohort data could increase partnership interest') — never state "
    "a speculation as though it were established. Never use investment "
    "language: no buy/sell/price-target framing, and never a recommendation "
    "to invest. Every claim gets a categorical confidence — high, moderate, "
    "or low — never a numeric probability."
)


class InterpretationClaim(BaseModel):
    content: str
    confidence: ConfidenceLevel


class InterpretationOutput(BaseModel):
    """What the LLM itself returns — interpretation and speculation only.
    FACT and CALCULATED claims are assembled separately by
    generate_interpretation from its own (non-LLM) inputs."""

    interpretation: list[InterpretationClaim] = Field(default_factory=list)
    speculation: list[InterpretationClaim] = Field(default_factory=list)

    @field_validator("interpretation", "speculation")
    @classmethod
    def no_investment_language(cls, claims: list[InterpretationClaim]) -> list[InterpretationClaim]:
        for claim in claims:
            lowered = claim.content.lower()
            for phrase in _BANNED_INVESTMENT_PHRASES:
                if phrase in lowered:
                    raise ValueError(
                        f"claim contains investment language ('{phrase}'): "
                        "BioLens is never a stock picker, see PLAN.md §3"
                    )
        return claims


class InterpretedClaim(BaseModel):
    """One row of generate_interpretation's output — not the DB `Analysis`
    row shape (that needs an id assigned at persistence time); this is the
    service-layer return type. source_ids is a list because an
    interpretation claim can be grounded in more than one fact/source."""

    claim_type: AnalysisClaimType
    content: str
    confidence: ConfidenceLevel | None = None
    source_ids: list[str] = Field(default_factory=list)


class InterpretationError(Exception):
    """Raised when the LLM's interpretation/speculation output still fails
    validation after every repair attempt is exhausted."""

    def __init__(self, message: str, *, attempts: int, last_error: str):
        super().__init__(message)
        self.attempts = attempts
        self.last_error = last_error


def _build_prompt(facts: list[str], calculated: list[str]) -> str:
    fact_lines = "\n".join(f"- {fact}" for fact in facts) or "(none provided)"
    calculated_lines = "\n".join(f"- {value}" for value in calculated) or "(none provided)"
    return (
        f"FACTS (directly from source, do not restate as your own claims):\n{fact_lines}\n\n"
        "CALCULATED (derived mathematically, do not restate as your own claims):\n"
        f"{calculated_lines}\n\n"
        "Write INTERPRETATION and SPECULATION claims grounded in the above."
    )


def _build_repair_prompt(
    facts: list[str], calculated: list[str], previous_error: ValidationError
) -> str:
    return (
        f"{_build_prompt(facts, calculated)}\n\n"
        "Your previous attempt failed validation with this error:\n"
        f"{previous_error}\n\n"
        "Fix it and try again. Only change what's wrong."
    )


async def generate_interpretation(
    *,
    facts: list[str],
    calculated: list[str],
    source_ids: list[str] | None = None,
    provider: LLMProvider | None = None,
    max_repair_attempts: int = 2,
) -> list[InterpretedClaim]:
    """Returns the full claim set: FACT and CALCULATED entries passed
    through unchanged from the inputs (claim_type assigned here, content
    untouched by any model), plus INTERPRETATION and SPECULATION claims
    from the LLM call, retrying with a repair prompt on validation failure
    exactly like Phase 5's extract_readout."""
    source_ids = source_ids or []
    provider = provider or get_llm_provider()

    last_error: ValidationError | None = None
    output: InterpretationOutput | None = None
    for _attempt in range(max_repair_attempts + 1):
        prompt = (
            _build_prompt(facts, calculated)
            if last_error is None
            else _build_repair_prompt(facts, calculated, last_error)
        )
        try:
            output = await provider.complete_structured(
                system=INTERPRETATION_SYSTEM_PROMPT,
                prompt=prompt,
                response_model=InterpretationOutput,
            )
            break
        except ValidationError as exc:
            last_error = exc
            continue

    if output is None:
        assert last_error is not None
        raise InterpretationError(
            f"Interpretation failed validation after {max_repair_attempts + 1} attempt(s)",
            attempts=max_repair_attempts + 1,
            last_error=str(last_error),
        )

    claims: list[InterpretedClaim] = []
    claims += [
        InterpretedClaim(claim_type=AnalysisClaimType.FACT, content=fact, source_ids=source_ids)
        for fact in facts
    ]
    claims += [
        InterpretedClaim(
            claim_type=AnalysisClaimType.CALCULATED, content=value, source_ids=source_ids
        )
        for value in calculated
    ]
    claims += [
        InterpretedClaim(
            claim_type=AnalysisClaimType.INTERPRETATION,
            content=claim.content,
            confidence=claim.confidence,
            source_ids=source_ids,
        )
        for claim in output.interpretation
    ]
    claims += [
        InterpretedClaim(
            claim_type=AnalysisClaimType.SPECULATION,
            content=claim.content,
            confidence=claim.confidence,
            source_ids=source_ids,
        )
        for claim in output.speculation
    ]
    return claims
