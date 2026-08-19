"""
PLAN.md Phase 5: plain-text readout -> structured entity extraction, with
retry-with-repair on malformed model output.

The LLMProvider.complete_structured contract already gets schema-constrained
decoding from Anthropic (client.messages.parse), so most "malformed JSON"
failures never reach here. What retry-with-repair actually exists for is
ReadoutExtraction's own domain-specific validators (currently: nct_id's
strict format check) — cases that are valid JSON matching the schema's
*types* but fail BioLens's own rules. See that model's docstring.
"""

from __future__ import annotations

from pydantic import ValidationError

from app.models.domain import ReadoutExtraction
from app.services.llm import LLMProvider, get_llm_provider

SYSTEM_PROMPT = (
    "You extract structured facts from biotech clinical trial readouts. "
    "Extract only what the text explicitly states — leave a field null "
    "rather than guessing or inferring it. Never invent a company, drug, "
    "target, NCT ID, phase, or indication that isn't actually present in "
    "the text. If an NCT ID is present, format it exactly as 'NCT' followed "
    "by 8 digits, with no space or hyphen."
)


class ReadoutExtractionError(Exception):
    """Raised when extraction still fails validation after every repair
    attempt is exhausted."""

    def __init__(self, message: str, *, attempts: int, last_error: str):
        super().__init__(message)
        self.attempts = attempts
        self.last_error = last_error


def _build_repair_prompt(original_text: str, previous_error: ValidationError) -> str:
    return (
        f"Clinical trial readout:\n\n{original_text}\n\n"
        "Your previous extraction attempt failed validation with this error:\n"
        f"{previous_error}\n\n"
        "Fix the extraction and try again. Only change what's wrong — leave "
        "fields that were already correct as they were."
    )


async def extract_readout(
    text: str,
    *,
    provider: LLMProvider | None = None,
    max_repair_attempts: int = 2,
) -> ReadoutExtraction:
    """Extracts entities from a plain-text readout.

    On a ValidationError from complete_structured, retries with a repair
    prompt that includes the previous attempt's actual error message, up to
    max_repair_attempts times, before raising ReadoutExtractionError.
    """
    provider = provider or get_llm_provider()
    prompt = f"Clinical trial readout:\n\n{text}"
    last_error: ValidationError | None = None

    for _attempt in range(max_repair_attempts + 1):
        current_prompt = prompt if last_error is None else _build_repair_prompt(text, last_error)
        try:
            return await provider.complete_structured(
                system=SYSTEM_PROMPT,
                prompt=current_prompt,
                response_model=ReadoutExtraction,
            )
        except ValidationError as exc:
            last_error = exc
            continue

    assert last_error is not None  # loop always sets this before falling through
    raise ReadoutExtractionError(
        f"Extraction failed validation after {max_repair_attempts + 1} attempt(s)",
        attempts=max_repair_attempts + 1,
        last_error=str(last_error),
    )
