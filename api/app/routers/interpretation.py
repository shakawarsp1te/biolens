"""PLAN.md Phase 7: POST /analyze/interpretation."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.rate_limit import enforce_llm_rate_limit
from app.services.interpretation import (
    InterpretationError,
    classify_evidence,
    generate_interpretation,
)

router = APIRouter(prefix="/analyze", tags=["analyze"])


class InterpretationRequest(BaseModel):
    facts: list[str] = []
    calculated: list[str] = []
    source_ids: list[str] = []
    primary_endpoint_met: bool | None = None
    is_single_arm: bool = False
    sample_size: int | None = None
    follow_up_adequate: bool | None = None


@router.post("/interpretation", dependencies=[Depends(enforce_llm_rate_limit)])
async def analyze_interpretation(request: InterpretationRequest) -> dict:
    evidence_classification = classify_evidence(
        primary_endpoint_met=request.primary_endpoint_met,
        is_single_arm=request.is_single_arm,
        sample_size=request.sample_size,
        follow_up_adequate=request.follow_up_adequate,
    )

    try:
        claims = await generate_interpretation(
            facts=request.facts,
            calculated=request.calculated,
            source_ids=request.source_ids,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except InterpretationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return {
        "evidence_classification": evidence_classification.value,
        "claims": [claim.model_dump() for claim in claims],
    }
