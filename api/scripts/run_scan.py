"""
Runs one continuous-update scan pass (app/services/scan.py): new PubMed
papers and new SEC filings for every tracked company, an impact call on each
new paper, updated stock outcomes for earlier calls, and -- only when asked,
since it makes real LLM calls -- one auto-discovery pass for brand-new
companies.

Usage (from api/):
    python -m scripts.run_scan [--discover | --weekly-discovery] [--max-new N]

--weekly-discovery runs discovery only if the last one was 7+ days ago
(tracked in db/last_discovery.txt), so a schedule that fires several times
a day -- or misses days while the Mac sleeps -- still discovers about once
a week, never more.

Same underlying logic as POST /scan/run, but runs straight against the
local SQLite stores with no server needed -- this is what
scripts/install_scan_schedule.sh schedules via launchd.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.services.scan import run_scan_pass

_DISCOVERY_STAMP = Path("db/last_discovery.txt")
_DISCOVERY_INTERVAL = timedelta(days=7)


def _discovery_due() -> bool:
    try:
        last = datetime.fromisoformat(_DISCOVERY_STAMP.read_text().strip())
    except (FileNotFoundError, ValueError):
        return True
    return datetime.now(timezone.utc) - last >= _DISCOVERY_INTERVAL


async def main() -> None:
    parser = argparse.ArgumentParser(description="Run one BioLens scan pass.")
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--discover", action="store_true", help="Also run auto-discovery (real LLM cost)."
    )
    group.add_argument(
        "--weekly-discovery",
        action="store_true",
        help="Run auto-discovery only if the last one was 7+ days ago.",
    )
    parser.add_argument("--max-new", type=int, default=2, help="Max new companies to discover.")
    args = parser.parse_args()

    run_discovery = args.discover or (args.weekly_discovery and _discovery_due())
    summary = await run_scan_pass(run_discovery=run_discovery, max_new_companies=args.max_new)
    if run_discovery:
        _DISCOVERY_STAMP.parent.mkdir(parents=True, exist_ok=True)
        _DISCOVERY_STAMP.write_text(summary["scannedAt"])
    print(
        f"[{summary['scannedAt']}] scanned {summary['companiesScanned']} companies: "
        f"{summary['newPapers']} new paper(s), {summary['newFilings']} new filing(s), "
        f"{summary['newCompaniesDiscovered']} new company(ies) discovered, "
        f"{summary['outcomesUpdated']} call outcome(s) updated"
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    asyncio.run(main())
