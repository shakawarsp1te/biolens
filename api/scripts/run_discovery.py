"""
Runs one auto-discovery pass: finds real, currently-untracked small/
emerging oncology companies from ClinicalTrials.gov and drafts a profile
for each (reviewStatus="ai_drafted_unreviewed").

Usage (from api/):
    python -m scripts.run_discovery [max_new]

This is what a cron job or scheduled task calls for unattended, recurring
runs -- POST /companies/discover (api/app/routers/companies.py) is the
same underlying logic, exposed over HTTP for manual/on-demand triggering.
"""

from __future__ import annotations

import asyncio
import sys

from app.services.discovery import run_discovery_pass


async def main() -> None:
    max_new = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    print(f"Running discovery pass (max_new={max_new})...")
    added = await run_discovery_pass(max_new=max_new)
    if not added:
        print("No new companies found this pass.")
        return
    for company in added:
        print(f"added: {company['name']} ({company['id']}) — {company['trialCount']} real trial(s)")


if __name__ == "__main__":
    asyncio.run(main())
