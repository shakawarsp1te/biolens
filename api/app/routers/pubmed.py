"""
PLAN.md Phase 4: targeted PubMed search by NCT ID, drug name/alias, and
target+indication, each returning a cached research package (metadata +
abstract per paper, never full text).
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.services.pubmed import PubMedClient

router = APIRouter(prefix="/pubmed", tags=["pubmed"])


@router.get("/nct/{nct_id}")
async def search_by_nct_id(nct_id: str, retmax: int = Query(10, ge=1, le=50)) -> dict:
    async with PubMedClient() as client:
        pmids = await client.search_by_nct_id(nct_id, retmax=retmax)
        return await client.build_research_package(pmids, query=f"nct:{nct_id}")


@router.get("/drug")
async def search_by_drug(
    name: str = Query(..., min_length=1),
    aliases: str = Query("", description="Comma-separated list of alternate names"),
    retmax: int = Query(10, ge=1, le=50),
) -> dict:
    alias_list = [a.strip() for a in aliases.split(",") if a.strip()]
    async with PubMedClient() as client:
        pmids = await client.search_by_drug_name(name, aliases=alias_list, retmax=retmax)
        query_label = f"drug:{name}" + (f"+aliases:{','.join(alias_list)}" if alias_list else "")
        return await client.build_research_package(pmids, query=query_label)


@router.get("/target-indication")
async def search_by_target_and_indication(
    target: str = Query(..., min_length=1),
    indication: str = Query(..., min_length=1),
    retmax: int = Query(10, ge=1, le=50),
) -> dict:
    async with PubMedClient() as client:
        pmids = await client.search_by_target_and_indication(target, indication, retmax=retmax)
        return await client.build_research_package(
            pmids, query=f"target:{target}+indication:{indication}"
        )
