import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import ask, auth, clinicaltrials, health, interpretation, market, pubmed, readout

# Without this, our own loggers (e.g. app.services.email's "biolens.email")
# inherit the root logger's default WARNING level and their INFO messages —
# including ConsoleEmailProvider's "here's the email we would have sent" —
# silently vanish instead of showing up in `uvicorn`'s console output.
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="BioLens API",
    description="Backend for BioLens — biotech discovery and clinical-trial interpretation.",
    version="0.1.0",
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
