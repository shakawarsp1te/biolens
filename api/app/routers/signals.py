"""
GET /signals/recent -- the newest signals (new papers, new filings) across
every tracked company, most recent first. The cross-company counterpart to
GET /companies/{id}/signals; this is what a Home-feed "what's new across
the frontier" module reads from.
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.services.signal_store import get_signal_store

router = APIRouter(prefix="/signals", tags=["signals"])


@router.get("/recent")
async def get_recent_signals(limit: int = Query(20, ge=1, le=100)) -> list[dict]:
    return await get_signal_store().list_recent_signals(limit=limit)
