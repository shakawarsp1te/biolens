"""
Shared admin-token gate for endpoints that make real outbound-cost calls
(LLM, external APIs) and aren't meant for an end user to trigger --
POST /companies/discover and POST /scan/run. See config.py's admin_token
field for the full rationale.
"""

from __future__ import annotations

from fastapi import HTTPException

from app.core.config import get_settings


def require_admin_token(x_admin_token: str | None) -> None:
    expected = get_settings().admin_token
    if expected and x_admin_token != expected:
        raise HTTPException(status_code=401, detail="Missing or incorrect X-Admin-Token header.")
