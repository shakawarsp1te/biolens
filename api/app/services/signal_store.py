"""
Persistence for the continuous-scan pipeline (paper_monitor.py,
filing_monitor.py, scan.py): what BioLens has already seen per company (so
a re-scan reports only genuinely new items, not the same paper every pass),
and the resulting signal events themselves. SQLite via aiosqlite, same
interim-store pattern as company_store.py/user_store.py.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import aiosqlite

from app.core.config import get_settings

_SCHEMA = """
CREATE TABLE IF NOT EXISTS scan_state (
    company_id TEXT PRIMARY KEY,
    seen_pmids TEXT NOT NULL DEFAULT '[]',
    seen_accessions TEXT NOT NULL DEFAULT '[]',
    last_scanned_at TEXT
);

CREATE TABLE IF NOT EXISTS signals (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    detected_at TEXT NOT NULL,
    data TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_signals_company ON signals (company_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_detected ON signals (detected_at DESC);
"""


class SignalStore:
    def __init__(self, db_path: str | None = None):
        self._db_path = db_path or get_settings().signal_db_path
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

    async def _get_state_row(self, company_id: str) -> aiosqlite.Row | None:
        async with aiosqlite.connect(self._db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT seen_pmids, seen_accessions FROM scan_state WHERE company_id = ?",
                (company_id,),
            )
            return await cursor.fetchone()

    async def get_seen_pmids(self, company_id: str) -> set[str]:
        await self._ensure_initialized()
        row = await self._get_state_row(company_id)
        return set(json.loads(row["seen_pmids"])) if row is not None else set()

    async def get_seen_accessions(self, company_id: str) -> set[str]:
        await self._ensure_initialized()
        row = await self._get_state_row(company_id)
        return set(json.loads(row["seen_accessions"])) if row is not None else set()

    async def has_been_scanned(self, company_id: str) -> bool:
        """Whether a scan pass has ever completed for this company --
        deliberately NOT inferred from an empty seen-set, which is
        ambiguous with "scanned, and genuinely found nothing that round"
        (e.g. a company whose pipeline has no papers yet). Both monitors
        use this to decide whether to establish a silent baseline instead
        of reporting a fresh company's entire history as new."""
        await self._ensure_initialized()
        async with aiosqlite.connect(self._db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT last_scanned_at FROM scan_state WHERE company_id = ?", (company_id,)
            )
            row = await cursor.fetchone()
        return row is not None and row["last_scanned_at"] is not None

    async def set_seen_pmids(self, company_id: str, pmids: set[str]) -> None:
        await self._ensure_initialized()
        async with aiosqlite.connect(self._db_path) as db:
            await db.execute(
                "INSERT INTO scan_state (company_id, seen_pmids) VALUES (?, ?) "
                "ON CONFLICT(company_id) DO UPDATE SET seen_pmids = excluded.seen_pmids",
                (company_id, json.dumps(sorted(pmids))),
            )
            await db.commit()

    async def set_seen_accessions(self, company_id: str, accessions: set[str]) -> None:
        await self._ensure_initialized()
        async with aiosqlite.connect(self._db_path) as db:
            await db.execute(
                "INSERT INTO scan_state (company_id, seen_accessions) VALUES (?, ?) "
                "ON CONFLICT(company_id) DO UPDATE SET seen_accessions = excluded.seen_accessions",
                (company_id, json.dumps(sorted(accessions))),
            )
            await db.commit()

    async def mark_scanned(self, company_id: str, *, scanned_at: str) -> None:
        await self._ensure_initialized()
        async with aiosqlite.connect(self._db_path) as db:
            await db.execute(
                "INSERT INTO scan_state (company_id, last_scanned_at) VALUES (?, ?) "
                "ON CONFLICT(company_id) DO UPDATE SET last_scanned_at = excluded.last_scanned_at",
                (company_id, scanned_at),
            )
            await db.commit()

    async def add_signals(self, signals: list[dict[str, Any]]) -> None:
        if not signals:
            return
        await self._ensure_initialized()
        async with aiosqlite.connect(self._db_path) as db:
            await db.executemany(
                "INSERT INTO signals (id, company_id, detected_at, data) VALUES (?, ?, ?, ?) "
                "ON CONFLICT(id) DO NOTHING",
                [(s["id"], s["companyId"], s["detectedAt"], json.dumps(s)) for s in signals],
            )
            await db.commit()

    async def list_signals_for_company(
        self, company_id: str, *, limit: int = 20
    ) -> list[dict[str, Any]]:
        await self._ensure_initialized()
        async with aiosqlite.connect(self._db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT data FROM signals WHERE company_id = ? "
                "ORDER BY detected_at DESC LIMIT ?",
                (company_id, limit),
            )
            rows = await cursor.fetchall()
        return [json.loads(row["data"]) for row in rows]

    async def list_recent_signals(self, *, limit: int = 20) -> list[dict[str, Any]]:
        await self._ensure_initialized()
        async with aiosqlite.connect(self._db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT data FROM signals ORDER BY detected_at DESC LIMIT ?", (limit,)
            )
            rows = await cursor.fetchall()
        return [json.loads(row["data"]) for row in rows]

    async def list_assessed_signals(self) -> list[dict[str, Any]]:
        """Every signal carrying a paper impact call (paper_impact.py),
        oldest first -- the population the track record is computed over."""
        await self._ensure_initialized()
        async with aiosqlite.connect(self._db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT data FROM signals WHERE json_extract(data, '$.impact') IS NOT NULL "
                "ORDER BY detected_at ASC"
            )
            rows = await cursor.fetchall()
        return [json.loads(row["data"]) for row in rows]

    async def list_unassessed_paper_signals(self, *, limit: int = 25) -> list[dict[str, Any]]:
        """New-paper signals with no impact call yet -- older ones found before
        paper_impact.py existed, or ones whose call failed last pass."""
        await self._ensure_initialized()
        async with aiosqlite.connect(self._db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT data FROM signals "
                "WHERE json_extract(data, '$.signalType') = 'new_paper' "
                "AND json_extract(data, '$.impact') IS NULL "
                "ORDER BY detected_at DESC LIMIT ?",
                (limit,),
            )
            rows = await cursor.fetchall()
        return [json.loads(row["data"]) for row in rows]

    async def update_signal(self, signal: dict[str, Any]) -> None:
        """Replaces a stored signal's data (used to attach an impact call or
        its later outcome); id, company and detection time never change."""
        await self._ensure_initialized()
        async with aiosqlite.connect(self._db_path) as db:
            await db.execute(
                "UPDATE signals SET data = ? WHERE id = ?", (json.dumps(signal), signal["id"])
            )
            await db.commit()


_default_store: SignalStore | None = None


def get_signal_store() -> SignalStore:
    global _default_store
    if _default_store is None:
        _default_store = SignalStore()
    return _default_store
