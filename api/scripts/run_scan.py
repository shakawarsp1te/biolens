"""
Runs one continuous-update scan pass (app/services/scan.py): new PubMed
papers and new SEC filings for every tracked company, and -- only with
--discover, since it makes real LLM calls -- one auto-discovery pass for
brand-new companies.

Usage (from api/):
    python -m scripts.run_scan [--discover] [--max-new N]

Same underlying logic as POST /scan/run, but runs straight against the
local SQLite stores with no server needed -- this is what
scripts/install_daily_scan.sh schedules via launchd for daily updates.
"""

from __future__ import annotations

import argparse
import asyncio
import logging

from app.services.scan import run_scan_pass


async def main() -> None:
    parser = argparse.ArgumentParser(description="Run one BioLens scan pass.")
    parser.add_argument(
        "--discover", action="store_true", help="Also run auto-discovery (real LLM cost)."
    )
    parser.add_argument("--max-new", type=int, default=2, help="Max new companies to discover.")
    args = parser.parse_args()

    summary = await run_scan_pass(run_discovery=args.discover, max_new_companies=args.max_new)
    print(
        f"[{summary['scannedAt']}] scanned {summary['companiesScanned']} companies: "
        f"{summary['newPapers']} new paper(s), {summary['newFilings']} new filing(s), "
        f"{summary['newCompaniesDiscovered']} new company(ies) discovered"
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    asyncio.run(main())
