"""
PLAN.md's "constantly update and create new company profiles" capability:
finds real, recently-active small/emerging biotech sponsors on
ClinicalTrials.gov that BioLens doesn't track yet, pulls their real trial
data, and has an LLM draft a profile strictly grounded in those facts --
never invented, never from the model's own general knowledge. Every
drafted profile is written with reviewStatus="ai_drafted_unreviewed" (see
app/components/AiDraftFlag.tsx on the mobile side) -- PLAN.md Phase 11's
"manually review each for accuracy before publishing" rule, enforced as a
stored field instead of a step nobody can verify happened.

Same "deterministic before LLM" shape as every other service in this
codebase: which sponsors are candidates, which trials belong to them, and
the Frontier Score are all computed in plain Python from real CT.gov data.
The LLM is only ever asked to draft the narrative fields (BioLens Summary,
Why It Matters, Thesis Map, etc.), and even those are validated afterward
(no investment language, no trial ID that wasn't actually given to it, a
categorical confidence level) with the same retry-with-repair pattern as
ask_biolens.py/interpretation.py.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone

import httpx
from pydantic import BaseModel, Field, ValidationError

from app.core.config import get_settings
from app.models.company import CompanyProfileModel, PipelineAssetModel, ThesisMapModel
from app.services.company_store import CompanyStore, get_company_store
from app.services.frontier_score import FrontierScoreComponents, calculate_frontier_score
from app.services.llm import LLMProvider, get_llm_provider

# Large, already-well-known biopharma companies auto-discovery specifically
# does NOT try to surface -- the whole point is exposing smaller/emerging
# companies a person wouldn't already know about. Not exhaustive; a large
# sponsor slipping through just means one review cycle catches it (every
# auto-discovered profile is reviewStatus="ai_drafted_unreviewed" until a
# human confirms it either way).
LARGE_PHARMA_DENYLIST = {
    "pfizer",
    "merck",
    "merck sharp & dohme",
    "merck sharp & dohme llc",
    "novartis",
    "novartis pharmaceuticals",
    "roche",
    "hoffmann-la roche",
    "genentech",
    "abbvie",
    "amgen",
    "eli lilly",
    "eli lilly and company",
    "bristol-myers squibb",
    "bristol myers squibb",
    "johnson & johnson",
    "janssen",
    "gsk",
    "glaxosmithkline",
    "sanofi",
    "astrazeneca",
    "gilead sciences",
    "gilead",
    "regeneron pharmaceuticals",
    "regeneron",
    "biogen",
    "vertex pharmaceuticals",
    "boehringer ingelheim",
    "takeda",
    "bayer",
    "novo nordisk",
    "daiichi sankyo",
    "astellas pharma",
    "astellas pharma global development",
    "beigene",
    "beone medicines",
    "moderna",
    "eisai",
    "otsuka",
}

_ACTIVE_STATUSES = {"RECRUITING", "ACTIVE_NOT_RECRUITING", "ENROLLING_BY_INVITATION"}
_INVESTMENT_PHRASES = ("buy rating", "price target", "strong buy", "sell rating", "we recommend")


class DiscoveryDraftError(Exception):
    def __init__(self, message: str, *, attempts: int, last_error: str):
        super().__init__(message)
        self.attempts = attempts
        self.last_error = last_error


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or uuid.uuid4().hex[:8]


async def find_candidate_sponsors(
    *,
    known_names: set[str],
    http_client: httpx.AsyncClient,
    max_candidates: int = 20,
    condition: str = "cancer",
) -> list[str]:
    """Real, recently-updated, industry-sponsored trials on
    ClinicalTrials.gov, filtered to sponsors BioLens doesn't already track
    and excluding well-known large pharma (LARGE_PHARMA_DENYLIST) --
    surfaces smaller/emerging companies specifically. `LeadSponsorClass=
    INDUSTRY` is what does the real work here: it's CT.gov's own
    classification, not a keyword guess, so it reliably excludes
    universities/hospitals/government sponsors."""
    response = await http_client.get(
        "/studies",
        params={
            "query.cond": condition,
            "filter.advanced": "AREA[LeadSponsorClass]INDUSTRY AND AREA[OverallStatus]RECRUITING",
            "sort": "LastUpdatePostDate:desc",
            "pageSize": 100,
            "fields": "NCTId,LeadSponsorName",
        },
    )
    response.raise_for_status()
    data = response.json()

    candidates: list[str] = []
    seen_lower: set[str] = set()
    for study in data.get("studies", []):
        sponsor = (
            study.get("protocolSection", {})
            .get("sponsorCollaboratorsModule", {})
            .get("leadSponsor", {})
            .get("name")
        )
        if not sponsor:
            continue
        lowered = sponsor.strip().lower()
        if lowered in seen_lower or lowered in known_names or lowered in LARGE_PHARMA_DENYLIST:
            continue
        seen_lower.add(lowered)
        candidates.append(sponsor.strip())
        if len(candidates) >= max_candidates:
            break
    return candidates


async def fetch_sponsor_trials(
    sponsor_name: str, *, http_client: httpx.AsyncClient, page_size: int = 15
) -> list[dict]:
    """Real trial facts for one sponsor -- everything the LLM drafting
    step is allowed to use, and nothing else."""
    response = await http_client.get(
        "/studies",
        params={
            "query.spons": sponsor_name,
            "pageSize": page_size,
            "fields": "NCTId,BriefTitle,OverallStatus,Phase,Condition,InterventionName",
        },
    )
    response.raise_for_status()
    data = response.json()

    trials = []
    for study in data.get("studies", []):
        protocol = study.get("protocolSection", {})
        ident = protocol.get("identificationModule", {})
        status = protocol.get("statusModule", {})
        design = protocol.get("designModule", {})
        conditions = protocol.get("conditionsModule", {})
        arms = protocol.get("armsInterventionsModule", {})
        nct_id = ident.get("nctId")
        if not nct_id:
            continue
        trials.append(
            {
                "nct_id": nct_id,
                "title": ident.get("briefTitle"),
                "status": status.get("overallStatus"),
                "phases": design.get("phases") or [],
                "conditions": conditions.get("conditions") or [],
                "interventions": [
                    i.get("name") for i in arms.get("interventions", []) if i.get("name")
                ],
            }
        )
    return trials


def estimate_frontier_components(trials: list[dict]) -> FrontierScoreComponents:
    """Deterministic, from real trial metadata only -- never guessed by
    the LLM. Two of the five components (scientific_novelty,
    strategic_validation) fall back to a flat default because judging
    novelty or partnership significance isn't something trial status/phase
    metadata alone can support; a human reviewer is expected to correct
    the score if it's off, same as every other auto-discovered field."""
    active_count = sum(1 for t in trials if t["status"] in _ACTIVE_STATUSES)
    all_phases = {p for t in trials for p in t["phases"]}

    if "PHASE3" in all_phases:
        evidence_maturity = 70
    elif "PHASE2" in all_phases:
        evidence_maturity = 50
    elif "PHASE1" in all_phases:
        evidence_maturity = 30
    else:
        evidence_maturity = 20

    return FrontierScoreComponents(
        clinical_momentum=min(90, 40 + active_count * 15),
        scientific_novelty=50,
        evidence_maturity=evidence_maturity,
        catalyst_activity=min(85, 30 + active_count * 20),
        strategic_validation=40,
    )


class DraftedPipelineAsset(BaseModel):
    drugName: str
    target: str
    modality: str
    disease: str
    stage: str
    trialIds: list[str] = Field(default_factory=list)
    nextMilestone: str | None = None


class DraftedThesisMap(BaseModel):
    whatHasToGoRight: list[str]
    whatCouldGoWrong: list[str]


class DraftedNarrative(BaseModel):
    """Raw shape the LLM returns -- only the fields real trial metadata
    can't determine on its own."""

    primaryFocus: str
    technology: str
    biolensSummary: str
    whyItMatters: list[str]
    oneSentenceSummary: str
    keyRisk: str
    whyItSurfaced: list[str]
    thesisMap: DraftedThesisMap
    pipeline: list[DraftedPipelineAsset]
    confidence: str
    therapeuticArea: str
    stage: str
    maturity: str
    modalities: list[str]
    targets: list[str]


_VALID_CONFIDENCE = {"high", "moderate", "low"}
_VALID_MATURITY = {"emerging", "scaling", "established"}
# Exact strings the mobile app's TrialPhase/PipelineStage types and its
# Discover filter pills depend on (app/types/domain.ts) -- "Phase 1" or
# "Phase1" would silently create a new, unmatched filter bucket instead of
# grouping with the real one. Caught by live-testing this exact mismatch on
# the pipeline's first real run (the LLM wrote "Phase 1", not "Phase I").
_VALID_TRIAL_PHASE = {
    "Preclinical",
    "Phase I",
    "Phase I/II",
    "Phase II",
    "Phase II/III",
    "Phase III",
    "Approved",
}
_VALID_PIPELINE_STAGE = {"Discovery", "Phase I", "Phase II", "Phase III", "Regulatory", "Approved"}

_DISCOVERY_SYSTEM_PROMPT = (
    "You are BioLens's company-profile drafting assistant. You are given real trial data for "
    "one biotechnology company, pulled directly from ClinicalTrials.gov. Write a profile using "
    "ONLY the facts given to you -- never your own general knowledge about this company, its "
    "drugs, or its trials, since anything not in the given data cannot be verified. If you are "
    "unsure of a detail, describe it more generally rather than inventing a specific fact. "
    "Every trial id you reference in the pipeline must come from the given list of known trial "
    "IDs -- never cite one that wasn't given to you. `confidence` must be exactly one of "
    "'high', 'moderate', or 'low' -- never a numeric probability. `maturity` must be exactly "
    "one of 'emerging', 'scaling', or 'established'. `stage` (the company's overall stage) "
    "must be exactly one of 'Preclinical', 'Phase I', 'Phase I/II', 'Phase II', 'Phase II/III', "
    "'Phase III', or 'Approved' -- these exact strings, never variations like 'Phase 1'. Each "
    "pipeline asset's own `stage` must be exactly one of 'Discovery', 'Phase I', 'Phase II', "
    "'Phase III', 'Regulatory', or 'Approved'. Never use investment language: no buy/sell/"
    "price-target framing, no recommendation to invest. This profile will be marked as "
    "AI-drafted and unreviewed, so favor caution and hedged language over confident claims."
)


def _build_prompt(sponsor_name: str, trials: list[dict]) -> str:
    trial_lines = "\n".join(
        f"- {t['nct_id']} | {t['title']} | status={t['status']} | phases={t['phases']} | "
        f"conditions={', '.join(t['conditions'])} | interventions={', '.join(t['interventions'])}"
        for t in trials
    )
    known_ids = ", ".join(t["nct_id"] for t in trials)
    return (
        f"COMPANY: {sponsor_name}\n\n"
        f"REAL TRIALS (from ClinicalTrials.gov):\n{trial_lines}\n\n"
        f"KNOWN TRIAL IDS (cite only from this list): {known_ids}\n\n"
        "Draft a BioLens company profile from this data alone."
    )


def _build_repair_prompt(sponsor_name: str, trials: list[dict], previous_error: str) -> str:
    return (
        f"{_build_prompt(sponsor_name, trials)}\n\n"
        f"Your previous attempt failed validation: {previous_error}\n\n"
        "Fix it and try again."
    )


def _validate_narrative(narrative: DraftedNarrative, known_trial_ids: set[str]) -> None:
    if narrative.confidence not in _VALID_CONFIDENCE:
        raise ValueError(
            f"confidence must be one of {sorted(_VALID_CONFIDENCE)}, got {narrative.confidence!r}"
        )
    if narrative.maturity not in _VALID_MATURITY:
        raise ValueError(
            f"maturity must be one of {sorted(_VALID_MATURITY)}, got {narrative.maturity!r}"
        )
    if narrative.stage not in _VALID_TRIAL_PHASE:
        raise ValueError(
            f"stage must be one of {sorted(_VALID_TRIAL_PHASE)}, got {narrative.stage!r}"
        )
    for asset in narrative.pipeline:
        if asset.stage not in _VALID_PIPELINE_STAGE:
            raise ValueError(
                f"pipeline asset {asset.drugName!r}'s stage must be one of "
                f"{sorted(_VALID_PIPELINE_STAGE)}, got {asset.stage!r}"
            )

    cited = {trial_id for asset in narrative.pipeline for trial_id in asset.trialIds}
    unknown = cited - known_trial_ids
    if unknown:
        raise ValueError(f"cited trial id(s) not in the given known list: {sorted(unknown)}")

    all_text = " ".join(
        [
            narrative.biolensSummary,
            narrative.oneSentenceSummary,
            narrative.keyRisk,
            *narrative.whyItMatters,
            *narrative.whyItSurfaced,
        ]
    ).lower()
    for phrase in _INVESTMENT_PHRASES:
        if phrase in all_text:
            raise ValueError(f"contains investment language: {phrase!r}")

    if not narrative.pipeline:
        raise ValueError("must include at least one pipeline asset")


async def draft_narrative(
    sponsor_name: str,
    trials: list[dict],
    *,
    provider: LLMProvider,
    max_repair_attempts: int = 2,
) -> DraftedNarrative:
    known_trial_ids = {t["nct_id"] for t in trials}
    last_error: str | None = None

    for _attempt in range(max_repair_attempts + 1):
        prompt = (
            _build_prompt(sponsor_name, trials)
            if last_error is None
            else _build_repair_prompt(sponsor_name, trials, last_error)
        )
        try:
            candidate = await provider.complete_structured(
                system=_DISCOVERY_SYSTEM_PROMPT, prompt=prompt, response_model=DraftedNarrative
            )
            _validate_narrative(candidate, known_trial_ids)
            return candidate
        except (ValidationError, ValueError) as exc:
            last_error = str(exc)
            continue

    raise DiscoveryDraftError(
        f"Failed to draft a valid profile for {sponsor_name!r} after "
        f"{max_repair_attempts + 1} attempt(s)",
        attempts=max_repair_attempts + 1,
        last_error=last_error or "unknown error",
    )


def assemble_profile(sponsor_name: str, trials: list[dict], narrative: DraftedNarrative) -> dict:
    """Builds the full CompanyProfileModel-shaped dict from a drafted
    narrative plus the real trial facts it was grounded in -- separated
    out from run_discovery_pass so it's independently testable without
    mocking CT.gov or an LLM."""
    now = datetime.now(timezone.utc).isoformat()
    company_id = slugify(sponsor_name)

    pipeline = [
        PipelineAssetModel(
            drugId=f"{company_id}-{slugify(asset.drugName)}",
            drugName=asset.drugName,
            target=asset.target,
            modality=asset.modality,
            disease=asset.disease,
            stage=asset.stage,
            trialIds=asset.trialIds,
            nextMilestone=asset.nextMilestone,
        )
        for asset in narrative.pipeline
    ]

    profile = CompanyProfileModel(
        id=company_id,
        name=sponsor_name,
        ticker=None,
        status="Auto-discovered from ClinicalTrials.gov — pending review",
        primaryFocus=narrative.primaryFocus,
        technology=narrative.technology,
        biolensSummary=narrative.biolensSummary,
        whyItMatters=narrative.whyItMatters,
        pipeline=pipeline,
        thesisMap=ThesisMapModel(**narrative.thesisMap.model_dump()),
        confidence=narrative.confidence,
        frontierScore=calculate_frontier_score(estimate_frontier_components(trials)),
        whyItSurfaced=narrative.whyItSurfaced,
        oneSentenceSummary=narrative.oneSentenceSummary,
        keyRisk=narrative.keyRisk,
        therapeuticArea=narrative.therapeuticArea,
        stage=narrative.stage,
        maturity=narrative.maturity,
        modalities=narrative.modalities,
        targets=narrative.targets,
        isMockData=True,
        reviewStatus="ai_drafted_unreviewed",
        source="auto_discovery",
        createdAt=now,
        updatedAt=now,
        lastVerifiedAt=None,
    )
    return profile.model_dump()


async def run_discovery_pass(
    *,
    store: CompanyStore | None = None,
    provider: LLMProvider | None = None,
    max_new: int = 3,
    condition: str = "cancer",
) -> list[dict]:
    """One discovery pass: finds up to `max_new` real, currently-untracked
    small/emerging oncology companies from ClinicalTrials.gov, drafts a
    profile for each, and stores it as reviewStatus="ai_drafted_unreviewed".
    Returns what was added; a candidate that has no real trials on lookup,
    or whose narrative never passes validation even after repair attempts,
    is skipped rather than force-added."""
    store = store or get_company_store()
    provider = provider or get_llm_provider()
    known_names = await store.known_names()

    added: list[dict] = []
    async with httpx.AsyncClient(
        base_url=get_settings().clinicaltrials_api_base, timeout=15.0
    ) as http_client:
        candidates = await find_candidate_sponsors(
            known_names=known_names,
            http_client=http_client,
            max_candidates=max(max_new * 4, 10),
            condition=condition,
        )
        for sponsor_name in candidates:
            if len(added) >= max_new:
                break
            trials = await fetch_sponsor_trials(sponsor_name, http_client=http_client)
            if not trials:
                continue
            try:
                narrative = await draft_narrative(sponsor_name, trials, provider=provider)
            except DiscoveryDraftError:
                continue

            profile = assemble_profile(sponsor_name, trials, narrative)
            await store.upsert_company(profile)
            added.append({"id": profile["id"], "name": profile["name"], "trialCount": len(trials)})

    return added
