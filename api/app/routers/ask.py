"""PLAN.md Phase 10: POST /analyze/ask (BUILD_BRIEF.txt §57, "Ask BioLens")."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.ask_biolens import AskBioLensError, ask_biolens

router = APIRouter(prefix="/analyze", tags=["analyze"])


class AskBioLensRequest(BaseModel):
    question: str
    facts: list[str] = []
    calculated: list[str] = []
    source_ids: list[str] = []


@router.post("/ask")
async def analyze_ask(request: AskBioLensRequest) -> dict:
    if not request.question.strip():
        raise HTTPException(status_code=422, detail="question must not be empty")

    try:
        result = await ask_biolens(
            question=request.question,
            facts=request.facts,
            calculated=request.calculated,
            source_ids=request.source_ids,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except AskBioLensError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return result.model_dump()
