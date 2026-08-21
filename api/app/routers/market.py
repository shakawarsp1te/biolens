"""
GET /market/quote/{ticker} — factual current market data for a publicly
traded company, backed by MarketDataClient. Never rendered anywhere paired
with buy/sell/price-target language; see app/services/market_data.py's
module docstring for why a real ticker's real price is in scope while
investment advice never is.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.services.market_data import MarketDataClient

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
