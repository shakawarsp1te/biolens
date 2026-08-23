"""
Company profile store -- the real, server-side replacement for what used
to be hardcoded TypeScript objects (app/mocks/companyProfile.ts,
discoveryCards.ts). That distinction matters for this feature specifically:
data baked into the compiled mobile app bundle can never be "constantly
updated" without shipping a new app version, so moving it here is the
actual prerequisite for that ability, not just a refactor.

SQLite via aiosqlite, same interim-store pattern as user_store.py -- stands
in for the eventual Postgres `companies` table (db/migrations/
0001_init_schema.sql) until Supabase is provisioned. Each row stores one
company's full CompanyProfileModel-shaped document as JSON; a few columns
are pulled out for cheap lookups (name, for discovery's dedup check) but
there's no need for a fully normalized schema yet at this scale (dozens,
not thousands, of companies).
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import aiosqlite

from app.core.config import get_settings

_SCHEMA = """
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    review_status TEXT NOT NULL DEFAULT 'verified',
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
"""


class CompanyStore:
    def __init__(self, db_path: str | None = None):
        self._db_path = db_path or get_settings().company_db_path
        if self._db_path != ":memory:":
            Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)
        self._initialized = False

    async def _ensure_initialized(self) -> None:
        if self._initialized:
            return
        async with aiosqlite.connect(self._db_path) as db:
            await db.executescript(_SCHEMA)
            await db.commit()
        self._initialized = True

    async def list_companies(self) -> list[dict[str, Any]]:
        await self._ensure_initialized()
        async with aiosqlite.connect(self._db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT data FROM companies ORDER BY name ASC")
            rows = await cursor.fetchall()
        return [json.loads(row["data"]) for row in rows]

    async def get_company(self, company_id: str) -> dict[str, Any] | None:
        await self._ensure_initialized()
        async with aiosqlite.connect(self._db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT data FROM companies WHERE id = ?", (company_id,))
            row = await cursor.fetchone()
        return json.loads(row["data"]) if row is not None else None

    async def upsert_company(self, profile: dict[str, Any]) -> None:
        """`profile` must already be a full CompanyProfileModel-shaped dict
        (including id/name/createdAt/updatedAt) -- callers (seed script,
        discovery pipeline) build that, this just persists it."""
        await self._ensure_initialized()
        async with aiosqlite.connect(self._db_path) as db:
            await db.execute(
                "INSERT INTO companies (id, name, review_status, data, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?) "
                "ON CONFLICT(id) DO UPDATE SET "
                "name = excluded.name, review_status = excluded.review_status, "
                "data = excluded.data, updated_at = excluded.updated_at",
                (
                    profile["id"],
                    profile["name"],
                    profile.get("reviewStatus", "verified"),
                    json.dumps(profile),
                    profile["createdAt"],
                    profile["updatedAt"],
                ),
            )
            await db.commit()

    async def known_names(self) -> set[str]:
        """Lowercased company names already tracked -- used by the
        discovery pipeline to skip sponsors that are already a company here
        under a slightly different casing."""
        await self._ensure_initialized()
        async with aiosqlite.connect(self._db_path) as db:
            cursor = await db.execute("SELECT name FROM companies")
            rows = await cursor.fetchall()
        return {row[0].lower() for row in rows}

    async def count(self) -> int:
        await self._ensure_initialized()
        async with aiosqlite.connect(self._db_path) as db:
            cursor = await db.execute("SELECT COUNT(*) FROM companies")
            row = await cursor.fetchone()
        return row[0] if row else 0


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


_default_store: CompanyStore | None = None


def get_company_store() -> CompanyStore:
    global _default_store
    if _default_store is None:
        _default_store = CompanyStore()
    return _default_store
