"""
CacheStore abstraction for external API responses (PLAN.md's caching
requirement for Phase 3/4: ClinicalTrials.gov and PubMed responses must be
cached, both to respect rate limits and so a re-analyzed readout doesn't
silently see different upstream data on a second pull).

Mirrors the LLMProvider pattern in app/services/llm.py: feature code depends
on this interface, never on a specific storage backend. Phase 2's `sources`
table (cached_payload jsonb, fetched_at) is the eventual Postgres-backed
implementation once Supabase exists; InMemoryCacheStore is what's available
today and what tests use.
"""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass
class CacheEntry:
    value: dict[str, Any]
    fetched_at: float


class CacheStore(ABC):
    @abstractmethod
    async def get(self, key: str) -> CacheEntry | None:
        raise NotImplementedError

    @abstractmethod
    async def set(self, key: str, value: dict[str, Any]) -> None:
        raise NotImplementedError


class InMemoryCacheStore(CacheStore):
    """Process-local cache. Fine for local dev and tests; not shared across
    workers/instances — replace with a Postgres-backed store (writing to
    `sources.cached_payload`) before any multi-instance deployment."""

    def __init__(self) -> None:
        self._entries: dict[str, CacheEntry] = {}

    async def get(self, key: str) -> CacheEntry | None:
        return self._entries.get(key)

    async def set(self, key: str, value: dict[str, Any]) -> None:
        self._entries[key] = CacheEntry(value=value, fetched_at=time.time())


_default_store = InMemoryCacheStore()


def get_cache_store() -> CacheStore:
    return _default_store
