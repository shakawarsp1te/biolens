from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Backend-only configuration. Nothing here is ever sent to the mobile app —
    the app only ever talks to this API, never directly to Supabase's service
    role, ClinicalTrials.gov, PubMed, or any LLM provider.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"

    # Supabase (Postgres + pgvector + Auth)
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    # LLM provider abstraction (see app/services/llm.py) — never hardcode a
    # single vendor into feature code, only into this settings/provider layer.
    llm_provider: str = "anthropic"
    anthropic_api_key: str = ""

    # External data sources
    clinicaltrials_api_base: str = "https://clinicaltrials.gov/api/v2"
    pubmed_api_base: str = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
    # NCBI usage policy asks every E-utilities caller to identify itself via
    # `tool` + `email` params. Optional pubmed_api_key raises the rate limit
    # from 3 req/sec to 10 req/sec (free — https://www.ncbi.nlm.nih.gov/account/) —
    # not required, BioLens works without one.
    pubmed_tool_name: str = "biolens"
    pubmed_contact_email: str = ""
    pubmed_api_key: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
