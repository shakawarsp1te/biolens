"""
New-PubMed-paper detection per company -- the "scan for new research
papers" half of the continuous-update pipeline (app/services/scan.py orchestrates
this together with filing_monitor.py). Searches PubMed for each drug in a
company's real pipeline (the same targeted, per-drug search
PubMedClient.search_by_drug_name already does for on-demand Search), diffs
the resulting PMIDs against what BioLens has already seen for that company,
and reports only the new ones.

Every signal here is a plain, sourced fact -- a real paper's real title,
journal, and PubMed link -- never a summary of what it means or a guess at
how it might move a stock. Interpreting a paper's *content* is what Ask
BioLens and the interpretation pipeline already do, on demand, when a human
asks; this module's only job is noticing that the paper exists.

A company's first-ever scan has no baseline to diff against, so every
paper PubMed has ever indexed for its pipeline would otherwise be reported
as "new" -- exactly the bug this codebase already solved once, for trial
freshness, in app/utils/watchlistFreshness.ts on mobile: the first pass
silently establishes the baseline (zero signals), and only a later scan,
after that baseline exists, reports anything as new.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.models.signal import SignalEventModel
from app.services.pubmed import PubMedClient
from app.services.signal_store import SignalStore

# Per-company, per-drug PubMed searches are already rate-limited inside
# PubMedClient (3-10 req/sec); this just caps how many results a single
# drug's search pulls in one pass, so one company with many pipeline assets
# doesn't balloon a single scan.
_RETMAX_PER_DRUG = 15


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def scan_company_for_new_papers(
    company: dict[str, Any], *, client: PubMedClient, store: SignalStore
) -> list[SignalEventModel]:
    """Every new-since-last-scan PubMed paper across a company's real
    pipeline. Returns an empty list (not an error) when there's nothing new
    -- the normal, expected outcome most scans produce."""
    drug_names = sorted(
        {asset["drugName"] for asset in company.get("pipeline", []) if asset.get("drugName")}
    )
    if not drug_names:
        return []

    seen = await store.get_seen_pmids(company["id"])
    is_first_scan = not await store.has_been_scanned(company["id"])

    all_pmids: set[str] = set()
    for drug_name in drug_names:
        pmids = await client.search_by_drug_name(drug_name, retmax=_RETMAX_PER_DRUG)
        all_pmids.update(pmids)

    if is_first_scan:
        await store.set_seen_pmids(company["id"], all_pmids)
        return []

    new_pmids = all_pmids - seen
    if not new_pmids:
        await store.set_seen_pmids(company["id"], seen | all_pmids)
        return []

    summaries = await client.esummary(sorted(new_pmids))
    detected_at = _utc_now_iso()
    signals = []
    for summary in summaries:
        pmid = summary.get("uid")
        if not pmid:
            continue
        signals.append(
            SignalEventModel(
                id=f"paper:{pmid}",
                companyId=company["id"],
                signalType="new_paper",
                title=summary.get("title") or "Untitled paper",
                detail=summary.get("fulljournalname") or summary.get("source"),
                occurredAt=summary.get("pubdate") or "",
                detectedAt=detected_at,
                source="PubMed",
                sourceUrl=f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
            )
        )

    await store.set_seen_pmids(company["id"], seen | all_pmids)
    return signals
