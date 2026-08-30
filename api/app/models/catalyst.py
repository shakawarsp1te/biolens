"""
An upcoming, real, sourced date tied to one of a company's actual trials --
see app/services/catalysts.py for how these are derived. Field names are
camelCase for the same reason as models/company.py: this shape is served
directly to the mobile app and matches its TypeScript types field-for-field.
"""

from __future__ import annotations

from pydantic import BaseModel


class CatalystEventModel(BaseModel):
    id: str
    companyId: str
    drugId: str | None = None
    nctId: str
    eventType: str  # "primary_completion" | "completion"
    title: str
    phase: str | None = None  # TrialPhase, when CT.gov's phase maps to one
    expectedDate: str  # ISO date (YYYY-MM-DD)
    # CT.gov's own designation for how firm this date is -- "ESTIMATED"
    # (the sponsor's current projection, can move) or "ACTUAL" (already
    # reached; shown only when it happened recently enough to still be a
    # fresh readout, not old history). Never a BioLens-invented confidence.
    dateType: str
    hasDayPrecision: bool
    overallStatus: str | None = None
    source: str = "ClinicalTrials.gov"
    sourceUrl: str
