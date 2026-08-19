"""
PLAN.md Phase 3: NCT ID lookup, sponsor/company search, drug/intervention
search, all backed by ClinicalTrialsClient's caching + parsing.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.services.clinicaltrials import (
    ClinicalTrialsClient,
    InvalidNctIdError,
    parse_study_summary,
    study_mentions_intervention,
)

router = APIRouter(prefix="/clinicaltrials", tags=["clinicaltrials"])


@router.get("/nct/{nct_id}")
async def get_by_nct_id(nct_id: str) -> dict:
    async with ClinicalTrialsClient() as client:
        try:
            raw = await client.get_study(nct_id)
        except InvalidNctIdError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
    if raw is None:
        raise HTTPException(
            status_code=404, detail=f"No ClinicalTrials.gov study found for {nct_id}"
        )
    return parse_study_summary(raw)


@router.get("/search/sponsor")
async def search_by_sponsor(
    name: str = Query(..., min_length=1), page_size: int = Query(10, ge=1, le=50)
) -> list[dict]:
    async with ClinicalTrialsClient() as client:
        raw_studies = await client.search_by_sponsor(name, page_size=page_size)
    return [parse_study_summary(study) for study in raw_studies]


@router.get("/search/intervention")
async def search_by_intervention(
    name: str = Query(..., min_length=1), page_size: int = Query(10, ge=1, le=50)
) -> list[dict]:
    async with ClinicalTrialsClient() as client:
        raw_studies = await client.search_by_intervention(name, page_size=page_size)
    return [
        {**parse_study_summary(study), "confident_match": study_mentions_intervention(study, name)}
        for study in raw_studies
    ]
