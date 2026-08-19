from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import clinicaltrials, health, pubmed

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
