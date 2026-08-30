"""
compute_financial_health() tests: pure function, synthetic XBRL-shaped
fixtures, no network -- verifying the quarter-vs-YTD filtering, the 10-K
fallback, and the "no burn to project" / "insufficient data" edge cases the
real SEC payload can produce.
"""

from app.services.financial_health import compute_financial_health


def _facts(cash_entries, burn_entries) -> dict:
    return {
        "entityName": "Cardiff Oncology, Inc.",
        "facts": {
            "us-gaap": {
                "CashAndCashEquivalentsAtCarryingValue": {"units": {"USD": cash_entries}},
                "NetCashProvidedByUsedInOperatingActivities": {"units": {"USD": burn_entries}},
            }
        },
    }


def test_first_fiscal_quarter_ytd_figure_is_already_a_discrete_quarter():
    facts = _facts(
        cash_entries=[
            {"end": "2025-12-31", "val": 60_000_000, "form": "10-K"},
            {"end": "2026-03-31", "val": 45_000_000, "form": "10-Q"},
        ],
        burn_entries=[
            {"start": "2026-01-01", "end": "2026-03-31", "val": -15_000_000, "form": "10-Q"},
        ],
    )

    result = compute_financial_health(facts)

    assert result is not None
    assert result.cashOnHand == 45_000_000
    assert result.cashAsOf == "2026-03-31"
    assert result.quarterlyBurn == -15_000_000
    assert result.burnPeriodStart == "2026-01-01"
    assert result.burnPeriodEnd == "2026-03-31"
    assert result.burnIsEstimated is False
    assert result.runwayMonths == round(45_000_000 / 15_000_000 * 3, 1)
    assert result.note is None


def test_second_quarter_ytd_figure_is_derived_by_subtracting_the_first_quarter():
    # GAAP only requires a 10-Q's cash-flow statement to cover
    # year-to-date, so the freshest Q2 filing reports Jan-Jun cumulative,
    # not the Apr-Jun quarter alone -- this must be recovered by
    # subtracting the earlier Jan-Mar cumulative filing, not silently used
    # as if it were one quarter's burn.
    facts = _facts(
        cash_entries=[{"end": "2026-06-30", "val": 30_000_000, "form": "10-Q"}],
        burn_entries=[
            {"start": "2026-01-01", "end": "2026-03-31", "val": -15_000_000, "form": "10-Q"},
            {"start": "2026-01-01", "end": "2026-06-30", "val": -30_000_000, "form": "10-Q"},
        ],
    )

    result = compute_financial_health(facts)

    assert result is not None
    assert result.quarterlyBurn == -15_000_000  # -30M YTD minus -15M Q1 YTD
    assert result.burnPeriodStart == "2026-03-31"
    assert result.burnPeriodEnd == "2026-06-30"
    assert result.burnIsEstimated is False
    assert result.runwayMonths == round(30_000_000 / 15_000_000 * 3, 1)


def test_falls_back_to_averaged_estimate_when_no_clean_quarter_can_be_derived():
    facts = _facts(
        cash_entries=[{"end": "2026-03-31", "val": 20_000_000, "form": "10-Q"}],
        burn_entries=[
            {"start": "2025-01-01", "end": "2025-12-31", "val": -40_000_000, "form": "10-K"},
        ],
    )

    result = compute_financial_health(facts)

    assert result is not None
    assert result.quarterlyBurn == -10_000_000  # -40M / 4 quarters
    assert result.burnIsEstimated is True
    assert result.filingForm == "10-K"
    assert result.runwayMonths == round(20_000_000 / 10_000_000 * 3, 1)


def test_positive_operating_cash_flow_reports_no_runway_instead_of_a_negative_number():
    facts = _facts(
        cash_entries=[{"end": "2026-03-31", "val": 20_000_000, "form": "10-Q"}],
        burn_entries=[
            {"start": "2026-01-01", "end": "2026-03-31", "val": 2_000_000, "form": "10-Q"},
        ],
    )

    result = compute_financial_health(facts)

    assert result is not None
    assert result.quarterlyBurn == 2_000_000
    assert result.runwayMonths is None
    assert result.note is not None and "positive" in result.note.lower()


def test_missing_burn_figure_still_reports_cash_with_an_explanatory_note():
    facts = _facts(
        cash_entries=[{"end": "2026-03-31", "val": 20_000_000, "form": "10-Q"}],
        burn_entries=[],
    )

    result = compute_financial_health(facts)

    assert result is not None
    assert result.cashOnHand == 20_000_000
    assert result.quarterlyBurn is None
    assert result.runwayMonths is None
    assert result.note is not None


def test_missing_cash_figure_entirely_returns_none():
    facts = _facts(cash_entries=[], burn_entries=[])
    assert compute_financial_health(facts) is None


def test_falls_back_through_cash_tags_when_primary_tag_is_absent():
    facts = {
        "entityName": "Some Biotech, Inc.",
        "facts": {
            "us-gaap": {
                "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents": {
                    "units": {"USD": [{"end": "2026-03-31", "val": 10_000_000, "form": "10-Q"}]}
                },
                "NetCashProvidedByUsedInOperatingActivities": {
                    "units": {
                        "USD": [
                            {
                                "start": "2026-01-01",
                                "end": "2026-03-31",
                                "val": -5_000_000,
                                "form": "10-Q",
                            }
                        ]
                    }
                },
            }
        },
    }

    result = compute_financial_health(facts)

    assert result is not None
    assert result.cashOnHand == 10_000_000
