"""
Market capitalization, enterprise value, and valuation multiples for a
publicly traded company -- computed deterministically from its own SEC
filings (XBRL company facts) plus its live share price, never estimated by
an LLM. Same "BioLens calculated" discipline as financial_health.py: every
output ships with the inputs and dates it came from, so a reader can check
the arithmetic.

These are facts about how the market prices a company, not opinions on
whether it's cheap or expensive -- BioLens never labels a multiple "low",
"high", "attractive" or "undervalued" (docs/PLAN.md §3).

Scope limits, stated rather than papered over:
- US-GAAP 10-Q/10-K filers only. Foreign private issuers file 20-F (often
  under IFRS), and their US-listed ADRs represent a ratio of ordinary shares
  -- multiplying an ADR price by ordinary shares outstanding would produce a
  wrong market cap, so those companies return None instead.
- USD quotes only, for the same reason.
- "Debt" is what the company tags as long-term debt (plus current portion
  and convertible notes where tagged separately); leases and other
  obligations aren't included. EV = market cap + debt - cash & investments.
"""

from __future__ import annotations

import re
from datetime import date
from typing import Any

from pydantic import BaseModel

from app.services.financial_health import latest_liquidity

_REVENUE_TAGS = [
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "Revenues",
    "RevenueFromContractWithCustomerIncludingAssessedTax",
]
_RND_TAGS = [
    "ResearchAndDevelopmentExpense",
    "ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost",
]
# Debt, preferred as balance-sheet parts (noncurrent + current, where the
# current line includes short-term borrowings). A single combined tag can
# hold a stale or partial figure -- Pfizer's "LongTermDebt" read $4.0B
# against $63B on its balance sheet.
_NONCURRENT_DEBT_TAGS = ["LongTermDebtNoncurrent"]
_CURRENT_DEBT_TAGS = ["DebtCurrent", "LongTermDebtCurrent"]
_COMBINED_DEBT_TAGS = ["LongTermDebt", "DebtInstrumentCarryingAmount"]
_CONVERTIBLE_TAGS = ["ConvertibleNotesPayable", "ConvertibleDebtNoncurrent"]

# Below this, EV/revenue is dominated by noise -- a clinical-stage company's
# collaboration payments (Relay: $10M of revenue gave a 363x multiple) --
# so it isn't shown.
_MIN_REVENUE_FOR_MULTIPLE = 50_000_000

_QUARTER_FRAME = re.compile(r"^CY(\d{4})Q([1-4])$")
_YEAR_FRAME = re.compile(r"^CY(\d{4})$")


class ValuationResult(BaseModel):
    marketCap: float
    sharePrice: float
    sharesOutstanding: float
    sharesAsOf: str
    cashAndInvestments: float | None = None
    cashAsOf: str | None = None
    totalDebt: float | None = None
    debtAsOf: str | None = None
    enterpriseValue: float | None = None
    ttmRevenue: float | None = None
    ttmRevenueThrough: str | None = None
    ttmRnD: float | None = None
    ttmRnDThrough: str | None = None
    evToRevenue: float | None = None
    # Share of the market cap covered by net cash (cash & investments minus
    # debt) -- a plain ratio; above 1.0 means EV is negative.
    netCashToMarketCap: float | None = None
    notes: list[str] = []


def _usd(facts: dict[str, Any], tag: str) -> list[dict[str, Any]]:
    entries = facts.get("facts", {}).get("us-gaap", {}).get(tag, {}).get("units", {}).get("USD", [])
    return [e for e in entries if e.get("end") and e.get("val") is not None]


def is_domestic_gaap_filer(facts: dict[str, Any]) -> bool:
    """True for US-GAAP 10-Q/10-K filers -- the only case where shares
    outstanding x a US quote is a real market cap (see module docstring)."""
    if "ifrs-full" in facts.get("facts", {}):
        return False
    shares = _shares_entries(facts)
    return bool(shares) and max(shares, key=lambda e: e["end"]).get("form") in ("10-Q", "10-K")


def _shares_entries(facts: dict[str, Any]) -> list[dict[str, Any]]:
    entries = (
        facts.get("facts", {})
        .get("dei", {})
        .get("EntityCommonStockSharesOutstanding", {})
        .get("units", {})
        .get("shares", [])
    )
    return [e for e in entries if e.get("end") and e.get("val")]


def latest_shares_outstanding(facts: dict[str, Any]) -> tuple[float, str] | None:
    """Cover-page shares outstanding from the latest filing. A company with
    several share classes files one entry per class for the same date; they
    are summed."""
    entries = _shares_entries(facts)
    if not entries:
        return None
    latest_end = max(e["end"] for e in entries)
    latest_accn = max(
        (e for e in entries if e["end"] == latest_end), key=lambda e: e.get("filed", "")
    ).get("accn")
    same_filing = [e for e in entries if e["end"] == latest_end and e.get("accn") == latest_accn]
    return float(sum(e["val"] for e in same_filing)), latest_end


def trailing_twelve_months(facts: dict[str, Any], tags: list[str]) -> tuple[float, str] | None:
    """Sum of the four latest consecutive calendar quarters, from SEC's
    de-duplicated `frame` values (CY2026Q2 = one discrete quarter). Q4 is
    rarely filed discretely -- it's in the 10-K's annual figure -- so a
    missing Q4 is derived as annual minus Q1-Q3. Tries each tag and keeps
    the one with the most recent data."""
    best: tuple[float, str] | None = None
    for tag in tags:
        quarters: dict[tuple[int, int], tuple[float, str]] = {}
        annual: dict[int, float] = {}
        for entry in _usd(facts, tag):
            frame = entry.get("frame") or ""
            if match := _QUARTER_FRAME.match(frame):
                quarters[(int(match[1]), int(match[2]))] = (float(entry["val"]), entry["end"])
            elif match := _YEAR_FRAME.match(frame):
                annual[int(match[1])] = float(entry["val"])
        for year, total in annual.items():
            q123 = [quarters.get((year, q)) for q in (1, 2, 3)]
            if (year, 4) not in quarters and all(q123):
                quarters[(year, 4)] = (total - sum(q[0] for q in q123), f"{year}-12-31")
        if not quarters:
            continue
        year, quarter = max(quarters)
        window = []
        for _ in range(4):
            if (year, quarter) not in quarters:
                break
            window.append(quarters[(year, quarter)])
            year, quarter = (year, quarter - 1) if quarter > 1 else (year - 1, 4)
        if len(window) < 4:
            continue
        candidate = (sum(v for v, _ in window), window[0][1])
        if best is None or candidate[1] > best[1]:
            best = candidate
    return best


def _latest_by_date(facts: dict[str, Any], tags: list[str]) -> dict[str, float]:
    """{end_date: value} from the first tag that has any data."""
    for tag in tags:
        dated = {e["end"]: float(e["val"]) for e in _usd(facts, tag)}
        if dated:
            return dated
    return {}


def latest_total_debt(facts: dict[str, Any]) -> tuple[float, str] | None:
    """Total tagged debt at the latest balance-sheet date that reports any.
    None when the company tags no debt at all -- which for many
    clinical-stage biotechs is the true state."""
    noncurrent = _latest_by_date(facts, _NONCURRENT_DEBT_TAGS)
    current = _latest_by_date(facts, _CURRENT_DEBT_TAGS)
    parts_dates = set(noncurrent) | set(current)
    combined = _latest_by_date(facts, _COMBINED_DEBT_TAGS)
    if parts_dates and (not combined or max(parts_dates) >= max(combined)):
        latest = max(parts_dates)
        return noncurrent.get(latest, 0.0) + current.get(latest, 0.0), latest
    if combined:
        latest = max(combined)
        return combined[latest], latest
    # Only when nothing above is tagged -- otherwise convertibles are
    # usually already inside long-term debt and would be double counted.
    convertible = _latest_by_date(facts, _CONVERTIBLE_TAGS)
    if convertible:
        latest = max(convertible)
        return convertible[latest], latest
    return None


def compute_valuation(
    facts: dict[str, Any], *, share_price: float, currency: str | None
) -> ValuationResult | None:
    """None when a correct market cap can't be computed (non-USD quote,
    foreign filer, or no shares-outstanding figure) -- rendered as "not
    available", never guessed."""
    if currency != "USD" or not is_domestic_gaap_filer(facts):
        return None
    shares = latest_shares_outstanding(facts)
    if shares is None:
        return None
    shares_outstanding, shares_as_of = shares
    market_cap = shares_outstanding * share_price
    result = ValuationResult(
        marketCap=round(market_cap, 0),
        sharePrice=share_price,
        sharesOutstanding=shares_outstanding,
        sharesAsOf=shares_as_of,
    )

    liquidity = latest_liquidity(facts)
    debt = latest_total_debt(facts)
    if liquidity is not None:
        result.cashAndInvestments, result.cashAsOf = liquidity[0], liquidity[1]
    if debt is not None:
        result.totalDebt, result.debtAsOf = debt
    else:
        result.notes.append("No debt is tagged in the company's filings; treated as zero.")

    if liquidity is not None:
        debt_value = result.totalDebt or 0.0
        result.enterpriseValue = round(market_cap + debt_value - liquidity[0], 0)
        if market_cap > 0:
            result.netCashToMarketCap = round((liquidity[0] - debt_value) / market_cap, 3)

    revenue = trailing_twelve_months(facts, _REVENUE_TAGS)
    if revenue is not None:
        result.ttmRevenue, result.ttmRevenueThrough = revenue
        # A multiple of a negative EV isn't meaningful; netCashToMarketCap
        # already tells that story.
        if (
            result.enterpriseValue is not None
            and result.enterpriseValue > 0
            and revenue[0] >= _MIN_REVENUE_FOR_MULTIPLE
        ):
            result.evToRevenue = round(result.enterpriseValue / revenue[0], 1)
    rnd = trailing_twelve_months(facts, _RND_TAGS)
    if rnd is not None:
        result.ttmRnD, result.ttmRnDThrough = rnd

    return result


_OPERATING_INCOME_TAGS = ["OperatingIncomeLoss"]
_NET_INCOME_TAGS = ["NetIncomeLoss", "ProfitLoss"]


class AnnualFinancials(BaseModel):
    """One fiscal year of income-statement figures (`year` is the year the
    fiscal period ends in). None means the
    company didn't report that line for that year -- never zero-filled."""

    year: int
    periodEnd: str
    revenue: float | None = None
    researchAndDevelopment: float | None = None
    operatingIncome: float | None = None
    netIncome: float | None = None


def _annual_by_year(
    facts: dict[str, Any], tags: list[str], prefer_largest: bool = False
) -> dict[int, tuple[float, str]]:
    """{fiscal year: (value, period end)} from full-year periods in 10-K
    filings, keyed by the year the period ends in. Two things this avoids:

    - SEC's calendar-year `frame` labels can land on a proxy statement's
      pay-vs-performance table instead of the 10-K -- Cardiff Oncology's
      CY2023 NetIncomeLoss frame is a DEF 14A figure in thousands (-41,441
      against a real -$41.4M) -- so frames aren't used here.
    - A 10-K repeats prior years as comparatives; the latest-filed figure
      wins, so restatements are picked up.

    Tags are tried in order, falling back per year (companies switch tags
    over time). With `prefer_largest`, the largest value across tags wins
    instead: for revenue, the total ("Revenues": Pfizer's $101.2B for 2022)
    is never smaller than a component (contract revenue: $91.8B)."""
    per_tag: list[dict[int, tuple[float, str, str]]] = []
    for tag in tags:
        latest: dict[int, tuple[float, str, str]] = {}
        for entry in _usd(facts, tag):
            if not str(entry.get("form", "")).startswith("10-K") or not entry.get("start"):
                continue
            days = (date.fromisoformat(entry["end"]) - date.fromisoformat(entry["start"])).days
            if not 350 <= days <= 380:
                continue
            year = int(entry["end"][:4])
            filed = entry.get("filed", "")
            if year not in latest or filed > latest[year][2]:
                latest[year] = (float(entry["val"]), entry["end"], filed)
        per_tag.append(latest)

    years: dict[int, tuple[float, str]] = {}
    for latest in per_tag:
        for year, (value, end, _) in latest.items():
            if year not in years or (prefer_largest and value > years[year][0]):
                years[year] = (value, end)
    return years


def annual_history(facts: dict[str, Any], max_years: int = 5) -> list[AnnualFinancials]:
    """The latest `max_years` fiscal years of revenue, R&D, operating
    income and net income, oldest first, straight from the filings. Empty
    for a company with no US-GAAP annual data (e.g. a foreign IFRS filer)."""
    series = {
        "revenue": _annual_by_year(facts, _REVENUE_TAGS, prefer_largest=True),
        "researchAndDevelopment": _annual_by_year(facts, _RND_TAGS),
        "operatingIncome": _annual_by_year(facts, _OPERATING_INCOME_TAGS),
        "netIncome": _annual_by_year(facts, _NET_INCOME_TAGS),
    }
    all_years = sorted({year for values in series.values() for year in values})[-max_years:]
    history = []
    for year in all_years:
        ends = [values[year][1] for values in series.values() if year in values]
        history.append(
            AnnualFinancials(
                year=year,
                periodEnd=max(ends),
                **{name: values[year][0] for name, values in series.items() if year in values},
            )
        )
    return history
