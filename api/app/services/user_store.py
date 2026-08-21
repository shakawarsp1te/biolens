"""
Interim account store, backed by local SQLite via aiosqlite -- stands in
for Supabase Auth's `auth.users` table (already assumed by
db/migrations/0001_init_schema.sql's `watchlists.user_id` foreign key) until
that's provisioned. Shaped to migrate cleanly: `id` is a uuid4 hex string
(matches a Postgres uuid column), `email`/`created_at` name and mean the
same thing Supabase Auth would give them. Swapping to real Supabase Auth
later is a storage-layer change in this file plus app/services/auth.py,
not a rewrite of the signup/login/verification flow or the API surface
callers depend on.
"""

from __future__ import annotations

import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

import aiosqlite

from app.core.config import get_settings


@dataclass
class UserRecord:
    id: str
    email: str
    password_hash: str
    is_verified: bool
    created_at: str


_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    expires_at TEXT NOT NULL,
    used_at TEXT
);
"""


class UserStore:
    def __init__(self, db_path: str | None = None):
        self._db_path = db_path or get_settings().user_db_path
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

    async def create_user(self, *, email: str, password_hash: str) -> UserRecord:
        await self._ensure_initialized()
        user_id = uuid.uuid4().hex
        created_at = datetime.now(timezone.utc).isoformat()
        async with aiosqlite.connect(self._db_path) as db:
            await db.execute(
                "INSERT INTO users (id, email, password_hash, is_verified, created_at) "
                "VALUES (?, ?, ?, 0, ?)",
                (user_id, email.lower(), password_hash, created_at),
            )
            await db.commit()
        return UserRecord(
            id=user_id,
            email=email.lower(),
            password_hash=password_hash,
            is_verified=False,
            created_at=created_at,
        )

    async def get_user_by_email(self, email: str) -> UserRecord | None:
        await self._ensure_initialized()
        async with aiosqlite.connect(self._db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM users WHERE email = ?", (email.lower(),))
            row = await cursor.fetchone()
        return _row_to_user(row)

    async def get_user_by_id(self, user_id: str) -> UserRecord | None:
        await self._ensure_initialized()
        async with aiosqlite.connect(self._db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            row = await cursor.fetchone()
        return _row_to_user(row)

    async def mark_verified(self, user_id: str) -> None:
        await self._ensure_initialized()
        async with aiosqlite.connect(self._db_path) as db:
            await db.execute("UPDATE users SET is_verified = 1 WHERE id = ?", (user_id,))
            await db.commit()

    async def create_verification_token(self, user_id: str, *, ttl_hours: int = 24) -> str:
        await self._ensure_initialized()
        token = secrets.token_urlsafe(32)
        expires_at = (datetime.now(timezone.utc) + timedelta(hours=ttl_hours)).isoformat()
        async with aiosqlite.connect(self._db_path) as db:
            await db.execute(
                "INSERT INTO email_verification_tokens (token, user_id, expires_at) "
                "VALUES (?, ?, ?)",
                (token, user_id, expires_at),
            )
            await db.commit()
        return token

    async def consume_verification_token(self, token: str) -> str | None:
        """Marks the token used and returns its user_id -- but only if it
        exists, hasn't already been used, and hasn't expired. Returns None
        for any other case (unknown/reused/expired token), deliberately not
        distinguishing which, so a guessed or replayed token can't be used
        to probe token validity."""
        await self._ensure_initialized()
        async with aiosqlite.connect(self._db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM email_verification_tokens WHERE token = ?", (token,)
            )
            row = await cursor.fetchone()
            if row is None or row["used_at"] is not None:
                return None
            expires_at = datetime.fromisoformat(row["expires_at"])
            if expires_at < datetime.now(timezone.utc):
                return None
            await db.execute(
                "UPDATE email_verification_tokens SET used_at = ? WHERE token = ?",
                (datetime.now(timezone.utc).isoformat(), token),
            )
            await db.commit()
            return row["user_id"]


def _row_to_user(row) -> UserRecord | None:
    if row is None:
        return None
    return UserRecord(
        id=row["id"],
        email=row["email"],
        password_hash=row["password_hash"],
        is_verified=bool(row["is_verified"]),
        created_at=row["created_at"],
    )


_default_store: UserStore | None = None


def get_user_store() -> UserStore:
    global _default_store
    if _default_store is None:
        _default_store = UserStore()
    return _default_store
