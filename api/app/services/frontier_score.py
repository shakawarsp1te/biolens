"""
PLAN.md Phase 8: Frontier Score and company-maturity classification.

Both fully deterministic, no LLM — a weighted formula and a rule-based
classifier respectively, consistent with BUILD_BRIEF.txt §41's
"deterministic before LLM" philosophy already applied in Phases 6/7.

BUILD_BRIEF.txt §53's two hard rules, enforced by what this module does and
does not do: never a stock-price target, never framed as "higher score =
higher future return." FRONTIER_SCORE_EXPLANATION is the copy the app must
show alongside every score.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

FRONTIER_SCORE_EXPLANATION = (
    "Frontier Score ranks biotechnology research activity, not investment attractiveness."
)

# BUILD_BRIEF.txt §53.
_WEIGHTS = {
    "clinical_momentum": 0.30,
    "scientific_novelty": 0.20,
    "evidence_maturity": 0.20,
    "catalyst_activity": 0.15,
    "strategic_validation": 0.15,
}


@dataclass(frozen=True)
class FrontierScoreComponents:
    """Each component is a 0-100 sub-score (BUILD_BRIEF.txt §53):
    - clinical_momentum: recent advancement or data
    - scientific_novelty: novel target/modality
    - evidence_maturity: strength/maturity of available human evidence
    - catalyst_activity: upcoming meaningful events
    - strategic_validation: partnerships/licensing/large-pharma involvement
    """

    clinical_momentum: int
    scientific_novelty: int
    evidence_maturity: int
    catalyst_activity: int
    strategic_validation: int

    def __post_init__(self) -> None:
        for name in _WEIGHTS:
            value = getattr(self, name)
            if not 0 <= value <= 100:
                raise ValueError(f"{name} must be between 0 and 100, got {value}")


def calculate_frontier_score(components: FrontierScoreComponents) -> int:
    """Weighted sum, rounded to the nearest integer — matches the
    `frontier_score smallint` column in db/migrations/0001_init_schema.sql
    and the mobile app's `frontierScore?: number` field."""
    weighted = sum(getattr(components, name) * weight for name, weight in _WEIGHTS.items())
    return round(weighted)


# ---------------------------------------------------------------------------
# §12: company maturity — transparent inclusion logic, not an editorial label
# ---------------------------------------------------------------------------


class CompanyMaturity(str, Enum):
    EMERGING = "emerging"
    SCALING = "scaling"
    ESTABLISHED = "established"


def classify_maturity(
    *,
    is_publicly_traded: bool,
    is_primarily_biotech_focused: bool,
    has_clinical_stage_program: bool,
    has_diversified_commercial_portfolio: bool,
    value_depends_significantly_on_pipeline: bool,
) -> CompanyMaturity | None:
    """BUILD_BRIEF.txt §12's exact Emerging-feed criteria (all five must
    hold), plus the Scaling/Established distinction it names but doesn't
    fully specify — filled in here as the natural complement: a diversified
    commercial portfolio means Established; a publicly-traded biotech that
    no longer depends significantly on pipeline execution (e.g. durable
    non-pipeline revenue) but also isn't yet diversified is Scaling.

    Returns None when a company doesn't cleanly fit any tier from the given
    inputs — e.g. not publicly traded, or not biotech-focused at all. None
    means "don't show in the Emerging feed," not a fourth maturity tier.
    """
    qualifies_as_emerging = (
        is_publicly_traded
        and is_primarily_biotech_focused
        and has_clinical_stage_program
        and not has_diversified_commercial_portfolio
        and value_depends_significantly_on_pipeline
    )
    if qualifies_as_emerging:
        return CompanyMaturity.EMERGING
    if has_diversified_commercial_portfolio:
        return CompanyMaturity.ESTABLISHED
    if (
        is_publicly_traded
        and is_primarily_biotech_focused
        and not value_depends_significantly_on_pipeline
    ):
        return CompanyMaturity.SCALING
    return None
