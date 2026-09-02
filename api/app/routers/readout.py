"""PLAN.md Phase 5: POST /analyze/readout — plain-text -> structured extraction."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.rate_limit import enforce_llm_rate_limit
from app.services.readout_extraction import ReadoutExtractionError, extract_readout

router = APIRouter(prefix="/analyze", tags=["analyze"])


class ReadoutRequest(BaseModel):
    text: str


@router.post("/readout", dependencies=[Depends(enforce_llm_rate_limit)])
async def analyze_readout(request: ReadoutRequest) -> dict:
    if not request.text.strip():
        raise HTTPException(status_code=422, detail="text must not be empty")

    try:
        result = await extract_readout(request.text)
    except RuntimeError as exc:
        # LLMProvider isn't configured yet (no ANTHROPIC_API_KEY set) —
        # a service-unavailable condition, not a client error.
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ReadoutExtractionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return result.model_dump()
