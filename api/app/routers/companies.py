"""
GET /companies and GET /companies/{id} -- the real, live-updatable
replacement for the mobile app's old hardcoded mock data. Response shapes
match app/types/domain.ts's DiscoveryCardData/CompanyProfile exactly (see
app/models/company.py's docstring for why), so the mobile app's existing
components render these responses with zero changes.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.services.company_store import get_company_store

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("")
async def list_companies() -> list[dict]:
    return await get_company_store().list_companies()


@router.get("/{company_id}")
async def get_company(company_id: str) -> dict:
    company = await get_company_store().get_company(company_id)
    if company is None:
        raise HTTPException(status_code=404, detail=f"No company found for id '{company_id}'.")
    return company
