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

from app.core.config import get_settings
from app.services.catalysts import get_catalysts_for_company
from app.services.clinicaltrials import ClinicalTrialsClient
from app.services.company_store import get_company_store
from app.services.discovery import run_discovery_pass

router = APIRouter(prefix="/companies", tags=["companies"])


def _require_admin(x_admin_token: str | None) -> None:
    expected = get_settings().admin_token
    if expected and x_admin_token != expected:
        raise HTTPException(status_code=401, detail="Missing or incorrect X-Admin-Token header.")


@router.get("")
async def list_companies() -> list[dict]:
    return await get_company_store().list_companies()


@router.post("/discover")
async def discover(
    max_new: int = Query(3, ge=1, le=10), x_admin_token: str | None = Header(default=None)
) -> dict:
    _require_admin(x_admin_token)
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
