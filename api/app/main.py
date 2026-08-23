import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models.company import CompanyProfileModel
from app.routers import (
    ask,
    auth,
    clinicaltrials,
    companies,
    health,
    interpretation,
    market,
    pubmed,
    readout,
)
from app.seed_data.companies import COMPANIES
from app.services.company_store import get_company_store

# Without this, our own loggers (e.g. app.services.email's "biolens.email")
# inherit the root logger's default WARNING level and their INFO messages —
# including ConsoleEmailProvider's "here's the email we would have sent" —
# silently vanish instead of showing up in `uvicorn`'s console output.
logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # A fresh checkout has no api/db/biolens_companies.sqlite3 -- without
    # this, GET /companies would return an empty list on first run and the
    # whole mobile app would look broken until someone remembered to run
    # `python -m scripts.seed_companies` by hand. Only seeds when the store
    # is genuinely empty, so it never overwrites real (including
    # auto-discovered) data on every restart.
    store = get_company_store()
    if await store.count() == 0:
        for raw in COMPANIES:
            await store.upsert_company(CompanyProfileModel(**raw).model_dump())
    yield


app = FastAPI(
    title="BioLens API",
    description="Backend for BioLens — biotech discovery and clinical-trial interpretation.",
    version="0.1.0",
    lifespan=lifespan,
)

# Loosened for local Expo Go development. Tighten before any public deploy.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(clinicaltrials.router)
app.include_router(pubmed.router)
app.include_router(readout.router)
app.include_router(interpretation.router)
app.include_router(ask.router)
app.include_router(market.router)
app.include_router(auth.router)
app.include_router(companies.router)
