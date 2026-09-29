"""valuation.py tests: market cap, debt, EV, TTM from SEC frames, and the
guards that refuse to compute a wrong number (foreign filers, non-USD)."""

from app.services.valuation import (
    compute_valuation,
    latest_total_debt,
    trailing_twelve_months,
)


def _facts(us_gaap: dict | None = None, shares_form: str = "10-Q", ifrs: bool = False) -> dict:
    facts: dict = {
        "dei": {
            "EntityCommonStockSharesOutstanding": {
                "units": {
                    "shares": [
                        {
                            "end": "2026-08-01",
                            "val": 100_000_000,
                            "accn": "a1",
                            "filed": "2026-08-05",
                            "form": shares_form,
                        }
                    ]
                }
            }
        },
        "us-gaap": us_gaap or {},
    }
    if ifrs:
        facts["ifrs-full"] = {}
    return {"facts": facts}


def _tag(*entries) -> dict:
    return {"units": {"USD": [dict(e) for e in entries]}}


def _quarter(year, q, val, end=None):
    return {"frame": f"CY{year}Q{q}", "val": val, "end": end or f"{year}-{3 * q:02d}-28"}


def test_market_cap_and_ev_with_net_cash():
    facts = _facts(
        {
            "CashAndCashEquivalentsAtCarryingValue": _tag({"end": "2026-06-30", "val": 300e6}),
            "LongTermDebtNoncurrent": _tag({"end": "2026-06-30", "val": 50e6}),
        }
    )
    result = compute_valuation(facts, share_price=5.0, currency="USD")
    assert result.marketCap == 500e6
    assert result.enterpriseValue == 250e6  # 500 + 50 - 300
    assert result.netCashToMarketCap == 0.5


def test_negative_ev_gets_no_revenue_multiple():
    quarters = [_quarter(2025, 3, 30e6), _quarter(2025, 4, 30e6)]
    quarters += [_quarter(2026, 1, 30e6), _quarter(2026, 2, 30e6)]
    facts = _facts(
        {
            "CashAndCashEquivalentsAtCarryingValue": _tag({"end": "2026-06-30", "val": 900e6}),
            "Revenues": _tag(*quarters),
        }
    )
    result = compute_valuation(facts, share_price=5.0, currency="USD")
    assert result.enterpriseValue < 0
    assert result.ttmRevenue == 120e6
    assert result.evToRevenue is None


def test_foreign_filer_and_non_usd_quote_are_refused():
    assert compute_valuation(_facts(shares_form="20-F"), share_price=10, currency="USD") is None
    assert compute_valuation(_facts(ifrs=True), share_price=10, currency="USD") is None
    assert compute_valuation(_facts(), share_price=10, currency="HKD") is None


def test_ttm_derives_missing_q4_from_annual_frame():
    facts = _facts(
        {
            "Revenues": _tag(
                _quarter(2025, 1, 10),
                _quarter(2025, 2, 20),
                _quarter(2025, 3, 30),
                {"frame": "CY2025", "val": 100, "end": "2025-12-31"},
                _quarter(2026, 1, 50),
            )
        }
    )
    # Q2+Q3+Q4(=100-60)+Q1'26 = 20+30+40+50
    assert trailing_twelve_months(facts, ["Revenues"]) == (140.0, "2026-03-28")


def test_ttm_needs_four_consecutive_quarters():
    facts = _facts({"Revenues": _tag(_quarter(2026, 1, 50), _quarter(2026, 2, 60))})
    assert trailing_twelve_months(facts, ["Revenues"]) is None


def test_pfizer_debt_uses_balance_sheet_parts_over_stale_combined_tag():
    facts = _facts(
        {
            "LongTermDebt": _tag({"end": "2025-12-31", "val": 4_000e6}),
            "LongTermDebtNoncurrent": _tag({"end": "2026-06-28", "val": 60_495e6}),
            "DebtCurrent": _tag({"end": "2026-06-28", "val": 2_699e6}),
        }
    )
    assert latest_total_debt(facts) == (63_194e6, "2026-06-28")


def test_no_debt_tagged_is_none_and_noted():
    facts = _facts(
        {"CashAndCashEquivalentsAtCarryingValue": _tag({"end": "2026-06-30", "val": 1e6})}
    )
    assert latest_total_debt(facts) is None
    result = compute_valuation(facts, share_price=1.0, currency="USD")
    assert any("No debt" in note for note in result.notes)
