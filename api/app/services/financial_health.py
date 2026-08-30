"""
Deterministic cash-runway calculation from a company's real SEC filings --
the same "BioLens calculated, never invented" discipline as
frontier_score.py. Every number here traces to an actual XBRL fact a company
filed in a 10-Q or 10-K; this module only does arithmetic on it (cash divided
by one quarter's burn, times three), never estimates or predicts anything
the filing itself didn't already state.

This is exactly the fact retail biotech investors say matters most and that
BioLens's direct competitors either lock behind a paywall or skip entirely
(see the "Cash runway, on every profile" section of The BioLens Playbook,
Aug 25 2026) -- and it's real disclosure, not an opinion, so it fits the
same "no investment advice" posture as a stock's actual current price
(market_data.py) rather than the analysis this codebase never gives.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from pydantic import BaseModel

# XBRL tags aren't perfectly standardized across filers even under the same
# US-GAAP taxonomy -- some clinical-stage biotechs tag restricted + operating
# cash together. Tried in order; the first tag with any data wins.
_CASH_TAGS = [
    "CashAndCashEquivalentsAtCarryingValue",
    "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
    "Cash",
]
_BURN_TAG = "NetCashProvidedByUsedInOperatingActivities"

# A company-facts payload's duration-tagged values mix true single-quarter
# figures with year-to-date cumulative ones under the same tag (a real,
# well-known XBRL quirk) -- filtering to ~1 quarter's duration on a 10-Q is
# what isolates the former.
_MIN_QUARTER_DAYS = 60
_MAX_QUARTER_DAYS = 100


class FinancialHealthResult(BaseModel):
    cashOnHand: float
    cashAsOf: str
    quarterlyBurn: float | None = None
    burnPeriodStart: str | None = None
    burnPeriodEnd: str | None = None
    # True when no clean discrete-quarter figure existed and this burn had
    # to be derived -- by subtracting two year-to-date cumulative filings,
    # or (failing that) averaging a YTD/annual figure over the quarters it
    # spans. Still arithmetic on real disclosed numbers, just a step
    # removed from a single filed line item.
    burnIsEstimated: bool = False
    filingForm: str | None = None
    runwayMonths: float | None = None
    note: str | None = None


def _days_between(start: str, end: str) -> int:
    return (date.fromisoformat(end) - date.fromisoformat(start)).days


def _latest_cash(facts: dict[str, Any]) -> tuple[float, str] | None:
    us_gaap = facts.get("facts", {}).get("us-gaap", {})
    for tag in _CASH_TAGS:
        entries = us_gaap.get(tag, {}).get("units", {}).get("USD", [])
        dated = [e for e in entries if e.get("end") and e.get("val") is not None]
        if not dated:
            continue
        latest = max(dated, key=lambda e: e["end"])
        return float(latest["val"]), latest["end"]
    return None


def _latest_quarterly_burn(
    facts: dict[str, Any],
) -> tuple[float, str, str, str, bool] | None:
    """Returns (burn, period_start, period_end, filing_form, is_estimated).

    GAAP requires a 10-Q's cash flow statement to cover year-to-date, not
    the discrete quarter -- unlike revenue or EPS, which are usually tagged
    both ways. So the freshest filed value for this tag is almost always a
    cumulative YTD figure (Q2 covers Jan-Jun, Q3 covers Jan-Sep, ...), and
    isolating "what changed last quarter" means subtracting the previous
    cumulative filing that shares the same fiscal-year start -- a fiscal Q1
    is the one case where YTD already *is* a single quarter, so it's used
    directly.
    """
    entries = (
        facts.get("facts", {}).get("us-gaap", {}).get(_BURN_TAG, {}).get("units", {}).get("USD", [])
    )
    durationed = [
        e
        for e in entries
        if e.get("start")
        and e.get("end")
        and e.get("val") is not None
        and e.get("form") in ("10-Q", "10-K")
    ]
    if not durationed:
        return None

    latest = max(durationed, key=lambda e: e["end"])
    latest_days = _days_between(latest["start"], latest["end"])

    if _MIN_QUARTER_DAYS <= latest_days <= _MAX_QUARTER_DAYS:
        return float(latest["val"]), latest["start"], latest["end"], latest["form"], False

    # `latest` spans more than one quarter (a YTD cumulative figure) --
    # subtract the most recent earlier filing that shares the same
    # fiscal-year start to isolate the discrete quarter between them.
    same_year_start = [e for e in durationed if e["start"] == latest["start"] and e["end"] < latest["end"]]
    if same_year_start:
        previous = max(same_year_start, key=lambda e: e["end"])
        discrete_days = _days_between(previous["end"], latest["end"])
        if _MIN_QUARTER_DAYS <= discrete_days <= _MAX_QUARTER_DAYS:
            discrete_val = float(latest["val"]) - float(previous["val"])
            return discrete_val, previous["end"], latest["end"], latest["form"], False

    # No clean pair to subtract (missed a filing, fiscal year changed, or
    # this genuinely is a full 10-K year) -- average the cumulative figure
    # over the quarters it spans instead of mislabeling a multi-quarter
    # number as a single quarter's burn.
    quarters_spanned = max(round(latest_days / 91), 1)
    return (
        float(latest["val"]) / quarters_spanned,
        latest["start"],
        latest["end"],
        latest["form"],
        True,
    )


def compute_financial_health(facts: dict[str, Any]) -> FinancialHealthResult | None:
    """None means "not enough disclosed data to say anything" -- a private
    company, a very new filer, or a company that simply doesn't tag cash the
    way this parser expects. Same "insufficient evidence is a normal state,
    not a failure" posture as Ask BioLens, never raised as an error."""
    cash = _latest_cash(facts)
    if cash is None:
        return None
    cash_on_hand, cash_as_of = cash

    burn_info = _latest_quarterly_burn(facts)
    if burn_info is None:
        return FinancialHealthResult(
            cashOnHand=cash_on_hand,
            cashAsOf=cash_as_of,
            note="No operating cash flow figure found in recent filings to estimate burn from.",
        )

    quarterly_burn, period_start, period_end, filing_form, is_estimated = burn_info

    if quarterly_burn >= 0:
        return FinancialHealthResult(
            cashOnHand=cash_on_hand,
            cashAsOf=cash_as_of,
            quarterlyBurn=quarterly_burn,
            burnPeriodStart=period_start,
            burnPeriodEnd=period_end,
            burnIsEstimated=is_estimated,
            filingForm=filing_form,
            note="Operating cash flow was positive in the most recent reported period "
            "— no burn to project a runway from.",
        )

    runway_months = round(cash_on_hand / abs(quarterly_burn) * 3, 1)
    return FinancialHealthResult(
        cashOnHand=cash_on_hand,
        cashAsOf=cash_as_of,
        quarterlyBurn=quarterly_burn,
        burnPeriodStart=period_start,
        burnPeriodEnd=period_end,
        burnIsEstimated=is_estimated,
        filingForm=filing_form,
        runwayMonths=runway_months,
    )
