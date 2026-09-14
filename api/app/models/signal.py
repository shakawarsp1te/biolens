"""
A single, plain, sourced fact BioLens's continuous scan detected as new for
a company since the last pass -- a new PubMed paper, or a new SEC filing.
Deliberately NOT a prediction, score, or interpretation of what the fact
means for a stock: see app/services/paper_monitor.py and
app/services/filing_monitor.py's module docstrings for why. Field names are
camelCase for the same reason as models/company.py and models/catalyst.py --
this shape is served directly to the mobile app.
"""

from __future__ import annotations

from pydantic import BaseModel


class SignalEventModel(BaseModel):
    id: str
    companyId: str
    signalType: str  # "new_paper" | "new_filing"
    title: str
    detail: str | None = None
    # The fact's own date (a paper's PubMed pub date, a filing's filing
    # date) -- free text, since PubMed's own date format varies too much to
    # normalize losslessly. Signals are always ordered by detectedAt, never
    # this, so display-only free text is fine here.
    occurredAt: str
    # When BioLens's scan found it -- always a real ISO datetime BioLens
    # itself generated, unlike occurredAt. Sort key for every signal list.
    detectedAt: str
    source: str  # "PubMed" | "SEC EDGAR"
    sourceUrl: str
