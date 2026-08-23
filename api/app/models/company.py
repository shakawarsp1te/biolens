"""
Canonical company profile shape served by GET /companies and
GET /companies/{id}, and written by both the manual seed data
(api/app/seed_data/companies.py) and the auto-discovery pipeline
(api/app/services/discovery.py).

Field names are camelCase here, not this codebase's usual snake_case --
deliberately: they match app/types/domain.ts's DiscoveryCardData and
CompanyProfile exactly, field-for-field. That means the mobile app's
existing, already-tested components (DiscoveryCard, PipelineAssetRow,
ThesisMap, every Discover filter) need zero changes to consume this API --
only the fetch layer changes (an API call instead of a static import), not
a single rendering component.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class PipelineAssetModel(BaseModel):
    drugId: str
    drugName: str
    target: str
    modality: str
    disease: str
    stage: str  # PipelineStage: Discovery/Phase I/II/III/Regulatory/Approved
    trialIds: list[str] = Field(default_factory=list)
    nextMilestone: str | None = None


class ThesisMapModel(BaseModel):
    whatHasToGoRight: list[str]
    whatCouldGoWrong: list[str]


class CompanyProfileModel(BaseModel):
    id: str
    name: str
    ticker: str | None = None
    status: str
    primaryFocus: str
    technology: str
    biolensSummary: str
    whyItMatters: list[str]
    pipeline: list[PipelineAssetModel]
    thesisMap: ThesisMapModel
    confidence: str  # "high" | "moderate" | "low"

    # Discover-card fields -- same entity, different view.
    frontierScore: int
    whyItSurfaced: list[str]
    oneSentenceSummary: str
    keyRisk: str
    therapeuticArea: str
    stage: str  # TrialPhase
    maturity: str  # emerging | scaling | established
    modalities: list[str]
    targets: list[str]

    isMockData: bool = True
    # "verified" -- a human (or WebSearch-verified manual research pass)
    # confirmed these facts. "ai_drafted_unreviewed" -- assembled by
    # services/discovery.py from live ClinicalTrials.gov/PubMed data with an
    # LLM only drafting the narrative fields; not yet human-reviewed for
    # accuracy (PLAN.md Phase 11's own rule: "manually review each for
    # accuracy before publishing" -- this flag is how that rule is enforced
    # for auto-discovered profiles instead of silently skipped).
    reviewStatus: str = "verified"
    source: str = "manual_research"  # "manual_research" | "auto_discovery"
    createdAt: str
    updatedAt: str
    lastVerifiedAt: str | None = None
