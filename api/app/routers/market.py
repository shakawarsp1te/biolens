"""
GET /market/quote/{ticker} — factual current market data for a publicly
traded company, backed by MarketDataClient. Never rendered anywhere paired
with buy/sell/price-target language; see app/services/market_data.py's
module docstring for why a real ticker's real price is in scope while
investment advice never is.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.services.financial_health import compute_financial_health
from app.services.market_data import CHART_RANGES, MarketDataClient
from app.services.sec_edgar import SecEdgarClient
from app.services.valuation import annual_history, compute_valuation

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/quote/{ticker}")
async def get_quote(ticker: str) -> dict:
    async with MarketDataClient() as client:
        quote = await client.get_quote(ticker)
    if quote is None:
        raise HTTPException(
            status_code=404, detail=f"No market data available for '{ticker}' right now."
        )
    return quote


@router.get("/history/{ticker}")
async def get_history(
    ticker: str,
    range: str = Query("1M", description="One of: " + ", ".join(CHART_RANGES)),
) -> dict:
    chart_range = range
    if chart_range not in CHART_RANGES:
        raise HTTPException(
            status_code=422,
            detail=f"'{chart_range}' is not a supported range. "
            f"Use one of: {', '.join(CHART_RANGES)}.",
        )
    async with MarketDataClient() as client:
        history = await client.get_history(ticker, chart_range)
    if history is None:
        raise HTTPException(
            status_code=404, detail=f"No price history available for '{ticker}' right now."
        )
    return history


@router.get("/financial-health/{ticker}")
async def get_financial_health(ticker: str) -> dict:
    """Cash on hand, last reported quarterly operating burn, and the runway
    that implies -- computed deterministically from a company's own SEC
    filings (see app/services/financial_health.py). A 404 here just means
    "not enough disclosed data yet", the same normal, expected outcome as an
    unavailable stock quote -- never an app-breaking error."""
    async with SecEdgarClient() as client:
        cik = await client.get_cik(ticker)
        if cik is None:
            raise HTTPException(status_code=404, detail=f"'{ticker}' isn't a recognized SEC filer.")
        facts = await client.get_company_facts(cik)

    if facts is None:
        raise HTTPException(
            status_code=404, detail=f"No SEC filings available for '{ticker}' right now."
        )

    result = compute_financial_health(facts)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"No cash or burn figures found in '{ticker}'s SEC filings.",
        )

    return {
        "ticker": ticker.upper(),
        "companyName": facts.get("entityName"),
        **result.model_dump(),
    }


@router.get("/valuation/{ticker}")
async def get_valuation(ticker: str) -> dict:
    """Market cap, enterprise value, trailing revenue/R&D and plain
    multiples, computed from the company's own SEC filings and its live
    share price (app/services/valuation.py), with every input and its date.
    A 404 means a correct figure can't be computed -- a foreign filer, a
    non-USD listing, or missing data -- never a guess."""
    async with MarketDataClient() as market, SecEdgarClient() as sec:
        quote = await market.get_quote(ticker)
        cik = await sec.get_cik(ticker)
        facts = await sec.get_company_facts(cik) if cik else None

    if quote is None or facts is None:
        raise HTTPException(status_code=404, detail=f"No valuation data for '{ticker}' right now.")
    result = compute_valuation(facts, share_price=quote["price"], currency=quote.get("currency"))
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"'{ticker}' isn't a US-GAAP filer with a USD listing, so BioLens can't "
            "compute its valuation reliably.",
        )
    return {"ticker": ticker.upper(), "priceAsOf": quote.get("market_time"), **result.model_dump()}


@router.get("/financial-history/{ticker}")
async def get_financial_history(ticker: str) -> dict:
    """Up to five calendar years of revenue, R&D, operating income and net
    income, straight from the company's SEC filings (XBRL company facts) --
    see app/services/valuation.py's annual_history. A 404 means there's no
    US-GAAP annual data to show, never an estimate."""
    async with SecEdgarClient() as client:
        cik = await client.get_cik(ticker)
        facts = await client.get_company_facts(cik) if cik else None

    years = annual_history(facts) if facts else []
    if not years:
        raise HTTPException(
            status_code=404, detail=f"No annual figures found in '{ticker}'s SEC filings."
        )
    return {
        "ticker": ticker.upper(),
        "source": "SEC EDGAR XBRL company facts",
        "years": [year.model_dump() for year in years],
    }
