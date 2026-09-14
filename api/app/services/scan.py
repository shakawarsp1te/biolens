"""
The continuous-update pipeline's orchestrator. One "scan pass" runs
paper_monitor.py and filing_monitor.py across every tracked company,
persists whatever new signals turn up, and -- only when explicitly asked,
since it makes real LLM calls -- runs one auto-discovery pass
(discovery.py) to find brand-new companies too. Together these are the
three things The BioLens Playbook grouped as "constantly update."

Triggered two ways:

1. On demand via POST /scan/run (admin-gated, same pattern as
   POST /companies/discover -- see app/routers/scan.py).
2. Automatically, by a best-effort in-process loop (run_scan_loop) started
   from app/main.py's lifespan -- but ONLY when settings.enable_background_scan
   is set. Left off by default deliberately: FastAPI's TestClient runs the
   full lifespan on every test that constructs one, so an always-on loop
   here would fire real PubMed/SEC network calls during `pytest` runs.
   It's also honest about a real limitation: a free-tier host that spins
   down on idle won't run this on a strict clock either, since the process
   itself stops existing between requests. For a guaranteed schedule
   regardless of traffic or hosting tier, point an external cron (a Render
   Cron Job, or a free pinger like cron-job.org) at POST /scan/run instead
   -- this module doesn't care which of the two triggered it.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from app.services.company_store import get_company_store
from app.services.discovery import run_discovery_pass
from app.services.filing_monitor import scan_company_for_new_filings
from app.services.paper_monitor import scan_company_for_new_papers
from app.services.pubmed import PubMedClient
from app.services.sec_edgar import SecEdgarClient
from app.services.signal_store import SignalStore, get_signal_store

logger = logging.getLogger("biolens.scan")

_SCAN_INTERVAL_SECONDS = 6 * 3600.0


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def run_scan_pass(
    *,
    run_discovery: bool = False,
    max_new_companies: int = 2,
    store: SignalStore | None = None,
) -> dict[str, Any]:
    """One full pass across every tracked company. Never raises on a single
    company's or single source's failure -- one bad company (a malformed
    ticker, a transient upstream error) shouldn't sink the whole pass, so
    failures are logged and skipped rather than propagated. Discovery is
    opt-in (`run_discovery=True`) since, unlike the paper/filing scan,
    it makes real LLM calls with a real cost per invocation."""
    store = store or get_signal_store()
    companies = await get_company_store().list_companies()

    new_paper_count = 0
    new_filing_count = 0
    companies_scanned = 0

    async with PubMedClient() as pubmed_client, SecEdgarClient() as sec_client:
        for company in companies:
            company_id = company.get("id", "unknown")

            try:
                paper_signals = await scan_company_for_new_papers(
                    company, client=pubmed_client, store=store
                )
            except Exception:
                logger.exception("paper scan failed for company %s", company_id)
                paper_signals = []

            try:
                filing_signals = await scan_company_for_new_filings(
                    company, client=sec_client, store=store
                )
            except Exception:
                logger.exception("filing scan failed for company %s", company_id)
                filing_signals = []

            all_signals = paper_signals + filing_signals
            if all_signals:
                await store.add_signals([s.model_dump() for s in all_signals])
            await store.mark_scanned(company_id, scanned_at=_utc_now_iso())

            new_paper_count += len(paper_signals)
            new_filing_count += len(filing_signals)
            companies_scanned += 1

    new_companies_found = 0
    if run_discovery:
        try:
            discovered = await run_discovery_pass(max_new=max_new_companies)
            new_companies_found = len(discovered)
        except Exception:
            logger.exception("discovery pass failed during scan")

    summary = {
        "companiesScanned": companies_scanned,
        "newPapers": new_paper_count,
        "newFilings": new_filing_count,
        "newCompaniesDiscovered": new_companies_found,
        "scannedAt": _utc_now_iso(),
    }
    logger.info("scan pass complete: %s", summary)
    return summary


async def run_scan_loop() -> None:
    """Best-effort periodic scan -- see this module's docstring for the
    real limitations. Never exits on a failed pass; logs and keeps going,
    same "one bad cycle shouldn't kill the loop" posture as run_scan_pass
    has for one bad company."""
    while True:
        try:
            await run_scan_pass()
        except Exception:
            logger.exception("background scan loop failed")
        await asyncio.sleep(_SCAN_INTERVAL_SECONDS)
