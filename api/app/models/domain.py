"""
Domain models mirroring db/migrations/0001_init_schema.sql and the mobile
app's app/types/domain.ts. Kept as the single source of truth for the shape
of API responses — routers should return these, not raw dict/row data.

Validation here intentionally duplicates a few DB check constraints (e.g. the
ORR responders/evaluable pairing) as defense in depth: bad data should be
rejected at the API boundary, not just at insert time.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class ConfidenceLevel(str, Enum):
    """Categorical only — see BUILD_BRIEF.txt §63. Never a fabricated
    numerical probability."""

    HIGH = "high"
    MODERATE = "moderate"
    LOW = "low"


class EvidenceClassification(str, Enum):
    CONFIRMATORY_POSITIVE = "confirmatory_positive"
    ENCOURAGING_SIGNAL = "encouraging_signal"
    INCONCLUSIVE = "inconclusive"
    NEGATIVE_PRIMARY_ENDPOINT = "negative_primary_endpoint"


class TrialPhase(str, Enum):
    PRECLINICAL = "Preclinical"
    PHASE_I = "Phase I"
    PHASE_I_II = "Phase I/II"
    PHASE_II = "Phase II"
    PHASE_II_III = "Phase II/III"
    PHASE_III = "Phase III"
    APPROVED = "Approved"


class SourceType(str, Enum):
    CLINICALTRIALS_GOV = "clinicaltrials_gov"
    PUBMED = "pubmed"
    PRESS_RELEASE = "press_release"
    SEC_FILING = "sec_filing"
    CONFERENCE = "conference"
    BIOLENS_CALCULATED = "biolens_calculated"


class TrialMetricKind(str, Enum):
    ORR = "orr"
    HAZARD_RATIO = "hazard_ratio"
    PFS = "pfs"
    OS = "os"
    GENERIC = "generic"


class EndpointRole(str, Enum):
    PRIMARY = "primary"
    SECONDARY = "secondary"
    EXPLORATORY = "exploratory"


class Source(BaseModel):
    id: UUID
    type: SourceType
    label: str
    url: str | None = None
    external_id: str | None = None
    fetched_at: datetime | None = None


class Target(BaseModel):
    id: UUID
    name: str
    simple_explanation: str
    detailed_explanation: str


class Indication(BaseModel):
    id: UUID
    name: str


class Company(BaseModel):
    id: UUID
    name: str
    ticker: str | None = None
    stage: str
    therapeutic_area: str
    one_liner: str
    frontier_score: int | None = Field(default=None, ge=0, le=100)
    is_mock_data: bool = False
    last_verified_at: datetime | None = None


class Drug(BaseModel):
    id: UUID
    company_id: UUID
    name: str
    target_id: UUID | None = None
    modality: str
    phase: TrialPhase
    one_liner: str
    confidence: ConfidenceLevel
    is_mock_data: bool = False


class TrialResult(BaseModel):
    id: UUID
    trial_id: UUID
    kind: TrialMetricKind
    label: str
    responders: int | None = None
    evaluable: int | None = None
    hazard_ratio: float | None = None
    value_text: str | None = None
    ci_low: float | None = None
    ci_high: float | None = None
    p_value: float | None = None
    endpoint_role: EndpointRole | None = None
    caption: str | None = None
    flag: str | None = None
    source_id: UUID | None = None

    @model_validator(mode="after")
    def orr_pair_required(self) -> "TrialResult":
        """BUILD_BRIEF.txt §34: ORR is never a bare percentage — responders
        and evaluable must both be present or both absent."""
        has_responders = self.responders is not None
        has_evaluable = self.evaluable is not None
        if has_responders != has_evaluable:
            raise ValueError("responders and evaluable must both be set together (never one alone)")
        return self

    @model_validator(mode="after")
    def hazard_ratio_needs_caption(self) -> "TrialResult":
        """BUILD_BRIEF.txt §33: a hazard ratio must always ship with
        plain-language framing, never a bare number."""
        is_hr = self.kind == TrialMetricKind.HAZARD_RATIO
        if is_hr and self.hazard_ratio is not None and not self.caption:
            raise ValueError("hazard_ratio results require a plain-language caption")
        return self


class Trial(BaseModel):
    id: UUID
    nct_id: str | None = None
    drug_id: UUID | None = None
    company_id: UUID
    phase: TrialPhase
    indication_id: UUID | None = None
    status: str | None = None
    sponsor: str | None = None
    is_single_arm: bool = False
    is_mock_data: bool = False
    last_verified_at: datetime | None = None
    results: list[TrialResult] = Field(default_factory=list)


class Event(BaseModel):
    id: UUID
    company_id: UUID
    drug_id: UUID | None = None
    trial_id: UUID | None = None
    event_type: str
    occurred_on: date
    title: str
    bottom_line: str
    evidence_classification: EvidenceClassification
    confidence: ConfidenceLevel
    is_mock_data: bool = False
    sources: list[Source] = Field(default_factory=list)


class AnalysisClaimType(str, Enum):
    """Phase 7 interpretation layer: each claim is labeled separately, never
    merged into undifferentiated prose."""

    FACT = "fact"
    CALCULATED = "calculated"
    INTERPRETATION = "interpretation"
    SPECULATION = "speculation"


class Analysis(BaseModel):
    id: UUID
    event_id: UUID | None = None
    company_id: UUID | None = None
    claim_type: AnalysisClaimType
    content: str
    confidence: ConfidenceLevel | None = None
    source_id: UUID | None = None


class WatchlistEntityType(str, Enum):
    COMPANY = "company"
    DRUG = "drug"
    TARGET = "target"


class WatchlistEntry(BaseModel):
    id: UUID
    user_id: UUID
    entity_type: WatchlistEntityType
    entity_id: UUID
    created_at: datetime
