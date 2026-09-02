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
