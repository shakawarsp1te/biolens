"""
New-SEC-filing detection per company -- the factual, sourced half of
"constantly update" alongside paper_monitor.py's new-paper detection. Diffs
a company's real SEC EDGAR filing history against what BioLens has already
seen, and reports only the filing types that typically carry real news for
a clinical-stage biotech: material events, quarterly/annual reports,
capital-raise registrations, and proxy/merger materials. Form 3/4/5 insider
transactions and routine Schedule 13G ownership-stake filings are real but
happen constantly and carry no signal on their own, so they're filtered out
here rather than flooding this feed with noise.

Every signal is a plain fact -- "Company X filed an 8-K on [date]" -- never
an interpretation of what it means or a guess at how the stock might react.
Same discipline as catalysts.py and financial_health.py.

A first-ever scan has nothing to diff against, and SEC EDGAR's "recent"
filings list is a large multi-year backlog, not "since you last checked" --
so the first pass silently establishes the baseline (zero signals), same
first-visit convention as paper_monitor.py and
app/utils/watchlistFreshness.ts on mobile.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.models.signal import SignalEventModel
from app.services.sec_edgar import SecEdgarClient
from app.services.signal_store import SignalStore

_SIGNIFICANT_FORMS = {
    "8-K",
    "8-K/A",
    "10-Q",
    "10-Q/A",
    "10-K",
    "10-K/A",
    "S-1",
    "S-1/A",
    "S-3",
    "S-3/A",
    "DEF 14A",
    "DEFA14A",
    "DEFM14A",
}

_FORM_LABELS = {
    "8-K": "Material event (8-K)",
    "8-K/A": "Material event, amended (8-K/A)",
    "10-Q": "Quarterly report (10-Q)",
    "10-Q/A": "Quarterly report, amended (10-Q/A)",
    "10-K": "Annual report (10-K)",
    "10-K/A": "Annual report, amended (10-K/A)",
    "S-1": "Registration statement (S-1)",
    "S-1/A": "Registration statement, amended (S-1/A)",
    "S-3": "Registration statement (S-3)",
    "S-3/A": "Registration statement, amended (S-3/A)",
    "DEF 14A": "Proxy statement (DEF 14A)",
    "DEFA14A": "Additional proxy materials (DEFA14A)",
    "DEFM14A": "Merger proxy statement (DEFM14A)",
}


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _document_url(*, cik: str, accession: str, primary_document: str) -> str:
    accession_no_dashes = accession.replace("-", "")
    return (
        f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/"
        f"{accession_no_dashes}/{primary_document}"
    )


async def scan_company_for_new_filings(
    company: dict[str, Any], *, client: SecEdgarClient, store: SignalStore
) -> list[SignalEventModel]:
    """Every new-since-last-scan significant SEC filing for a company, or an
    empty list when there's nothing new, the company has no ticker, or it
    isn't a SEC filer (all normal, expected outcomes here)."""
    ticker = company.get("ticker")
    if not ticker:
        return []

    cik = await client.get_cik(ticker)
    if cik is None:
        return []

    submissions = await client.get_submissions(cik)
    if submissions is None:
        return []

    recent = submissions.get("filings", {}).get("recent", {})
    forms = recent.get("form", [])
    accessions = recent.get("accessionNumber", [])
    filing_dates = recent.get("filingDate", [])
    primary_documents = recent.get("primaryDocument", [])

    seen = await store.get_seen_accessions(company["id"])
    is_first_scan = not await store.has_been_scanned(company["id"])

    all_accessions_this_scan: set[str] = {
        accession
        for form, accession in zip(forms, accessions, strict=False)
        if form in _SIGNIFICANT_FORMS and accession
    }

    if is_first_scan:
        # SEC EDGAR's "recent" filings list isn't "since you last checked"
        # -- it's a large, multi-year backlog (hundreds of entries for an
        # established filer), so a first scan with nothing to diff against
        # would otherwise report a company's entire significant-filing
        # history as "new" in one shot. Same first-visit convention as
        # paper_monitor.py / watchlistFreshness.ts: establish the baseline
        # silently, diff starting next scan.
        await store.set_seen_accessions(company["id"], all_accessions_this_scan)
        return []

    detected_at = _utc_now_iso()
    signals = []

    for form, accession, filing_date, primary_document in zip(
        forms, accessions, filing_dates, primary_documents, strict=False
    ):
        if form not in _SIGNIFICANT_FORMS or not accession:
            continue
        if accession in seen:
            continue
        signals.append(
            SignalEventModel(
                id=f"filing:{accession}",
                companyId=company["id"],
                signalType="new_filing",
                title=_FORM_LABELS.get(form, form),
                detail=f"Filed {filing_date}" if filing_date else None,
                occurredAt=filing_date or "",
                detectedAt=detected_at,
                source="SEC EDGAR",
                sourceUrl=_document_url(
                    cik=cik, accession=accession, primary_document=primary_document
                ),
            )
        )

    await store.set_seen_accessions(company["id"], seen | all_accessions_this_scan)
    return signals
