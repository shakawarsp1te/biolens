"""
GET /companies and GET /companies/{id} -- the real, live-updatable
replacement for the mobile app's old hardcoded mock data. Response shapes
match app/types/domain.ts's DiscoveryCardData/CompanyProfile exactly (see
app/models/company.py's docstring for why), so the mobile app's existing
components render these responses with zero changes.

POST /companies/discover triggers one auto-discovery pass
(app/services/discovery.py) on demand -- in production this is what a
cron job/scheduled task would call unattended (or use
scripts/run_discovery.py directly); exposed here too for manual/on-demand
triggering during development. Not auth-gated yet since no admin-role
concept exists in this codebase's account system -- worth adding before
any public deployment, since each call makes real LLM + ClinicalTrials.gov
requests.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.services.company_store import get_company_store
from app.services.discovery import run_discovery_pass

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("")
async def list_companies() -> list[dict]:
    return await get_company_store().list_companies()


@router.post("/discover")
async def discover(max_new: int = Query(3, ge=1, le=10)) -> dict:
    added = await run_discovery_pass(max_new=max_new)
    return {"added": added, "count": len(added)}


@router.get("/{company_id}")
async def get_company(company_id: str) -> dict:
    company = await get_company_store().get_company(company_id)
    if company is None:
        raise HTTPException(status_code=404, detail=f"No company found for id '{company_id}'.")
    return company
