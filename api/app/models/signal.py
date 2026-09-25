"""
A single, sourced fact BioLens's continuous scan detected as new for a
company since the last pass -- a new PubMed paper, or a new SEC filing. New
papers additionally carry an impact call and, later, its scored outcome
(see the `impact`/`outcome` fields below); the fact itself is always kept
separate from BioLens's read on it. Field names are
camelCase for the same reason as models/company.py and models/catalyst.py --
this shape is served directly to the mobile app.
"""

from __future__ import annotations

from typing import Any

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
    # New papers only: BioLens's read on whether the paper is likely good or
    # bad news for the company (app/services/paper_impact.py), and later what
    # the stock actually did afterward (app/services/signal_outcomes.py).
    # None until assessed / scored.
    impact: dict[str, Any] | None = None
    outcome: dict[str, Any] | None = None
