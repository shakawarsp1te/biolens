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

    # Interim local account system (api/app/services/auth.py, user_store.py) —
    # stands in for Supabase Auth until that's provisioned (db/migrations/
    # 0001_init_schema.sql already assumes it via `auth.users`). Swapping to
    # Supabase Auth later is a storage-layer + token-issuer change, not a
    # rewrite of the signup/login/verification flow itself.
    jwt_secret: str = "dev-only-insecure-secret-change-me"
    jwt_expires_minutes: int = 60 * 24 * 7  # 7 days
    user_db_path: str = "db/biolens_dev.sqlite3"
    # Interim company profile store (app/services/company_store.py) --
    # replaces the old hardcoded app/mocks/*.ts data with a real,
    # server-side store the mobile app fetches from, so profiles can
    # actually be updated (or auto-discovered -- see discovery.py) without
    # shipping a new app build. Stands in for the real Postgres `companies`
    # table the same way user_db_path stands in for Supabase Auth.
    company_db_path: str = "db/biolens_companies.sqlite3"
    # Where verification links point — the API itself, since the link is
    # opened directly in whatever browser the user's email client hands off
    # to, not deep-linked into the Expo app at this stage.
    api_public_base_url: str = "http://localhost:8000"

    # Email delivery (api/app/services/email.py) — mirrors the LLMProvider
    # pattern: ConsoleEmailProvider (logs the email, including the
    # verification link, instead of sending it) is the default until real
    # SMTP credentials are configured below, exactly like AnthropicProvider
    # only activates once ANTHROPIC_API_KEY is set.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    email_from: str = "BioLens <no-reply@biolens.app>"

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
    # SEC EDGAR's fair-access policy (sec.gov/os/webmaster-faq#developers)
    # asks every automated caller to identify itself with a descriptive
    # User-Agent including a contact email -- same posture as PubMed's
    # tool/email params above. Works without one configured (falls back to a
    # placeholder), same as pubmed_contact_email being optional.
    sec_edgar_contact_email: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
