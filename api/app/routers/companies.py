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
triggering during development. Gated behind settings.admin_token (an
X-Admin-Token header) once that's set -- each call makes real LLM +
ClinicalTrials.gov requests, so this is what stops it being a free-to-
anyone "spend BioLens's Anthropic credits" button on a public deployment.
Left as no-op (open) when admin_token is unset, matching local-dev today.
"""

from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, Query

from app.core.admin import require_admin_token
from app.services.catalysts import get_catalysts_for_company
from app.services.clinicaltrials import ClinicalTrialsClient
from app.services.company_store import get_company_store
from app.services.discovery import run_discovery_pass
from app.services.signal_store import get_signal_store

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("")
async def list_companies() -> list[dict]:
    return await get_company_store().list_companies()


@router.post("/discover")
async def discover(
    max_new: int = Query(3, ge=1, le=10), x_admin_token: str | None = Header(default=None)
) -> dict:
    require_admin_token(x_admin_token)
    added = await run_discovery_pass(max_new=max_new)
    return {"added": added, "count": len(added)}


@router.get("/{company_id}")
async def get_company(company_id: str) -> dict:
    company = await get_company_store().get_company(company_id)
    if company is None:
        raise HTTPException(status_code=404, detail=f"No company found for id '{company_id}'.")
    return company


@router.get("/{company_id}/catalysts")
async def get_company_catalysts(company_id: str) -> list[dict]:
    """Upcoming trial-readout catalysts for one company (see
    app/services/catalysts.py) -- a real, sourced date per event, never an
    invented one. An empty list is a normal outcome (no trial in this
    company's pipeline has a disclosed upcoming completion date), not an
    error, so this never 404s once the company itself exists."""
    company = await get_company_store().get_company(company_id)
    if company is None:
        raise HTTPException(status_code=404, detail=f"No company found for id '{company_id}'.")
    async with ClinicalTrialsClient() as client:
        events = await get_catalysts_for_company(company, client=client)
    return [event.model_dump() for event in events]


@router.get("/{company_id}/signals")
async def get_company_signals(company_id: str, limit: int = Query(20, ge=1, le=100)) -> list[dict]:
    """New papers and new SEC filings the continuous-scan pipeline
    (app/services/scan.py) has found for this company, most recent first.
    Each is a plain sourced fact -- never a prediction of what it means for
    the stock. An empty list is a normal outcome (nothing new since the
    last scan, or no scan has run yet), not an error."""
    company = await get_company_store().get_company(company_id)
    if company is None:
        raise HTTPException(status_code=404, detail=f"No company found for id '{company_id}'.")
    return await get_signal_store().list_signals_for_company(company_id, limit=limit)
