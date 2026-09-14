"""
POST /scan/run -- triggers one pass of the continuous-update pipeline
(app/services/scan.py): new papers, new filings, and -- opt-in only,
since it makes real LLM calls with a real cost -- one auto-discovery pass.

Admin-gated exactly like POST /companies/discover, for the same reason:
this makes real outbound calls and isn't something an end user needs to
trigger. This is also the endpoint an external cron (a Render Cron Job, or
a free pinger like cron-job.org) should call on a schedule for a
guaranteed update cadence regardless of hosting-tier idle spin-down -- see
scan.py's module docstring for why the in-process background loop alone
can't promise that on a free host.
"""

from __future__ import annotations

from fastapi import APIRouter, Header, Query

from app.core.admin import require_admin_token
from app.services.scan import run_scan_pass

router = APIRouter(prefix="/scan", tags=["scan"])


@router.post("/run")
async def run_scan(
    run_discovery: bool = Query(
        False,
        description="Also run one auto-discovery pass for brand-new companies (real LLM cost).",
    ),
    max_new_companies: int = Query(2, ge=1, le=10),
    x_admin_token: str | None = Header(default=None),
) -> dict:
    require_admin_token(x_admin_token)
    return await run_scan_pass(run_discovery=run_discovery, max_new_companies=max_new_companies)
