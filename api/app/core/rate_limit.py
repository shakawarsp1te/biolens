"""
Lightweight per-IP request throttle for cost-incurring endpoints (anything
that calls the LLM) once this API is reachable from the public internet — a
demo deployment has no other protection against a script hammering these and
running up a real Anthropic API bill. Process-local in-memory state, same
"fine for one instance, not a scaled multi-instance deployment" caveat as
services/cache.py's InMemoryCacheStore — a real production deployment would
back this with Redis instead.
"""

from __future__ import annotations

import time
from collections import defaultdict

from fastapi import HTTPException, Request


class InMemoryRateLimiter:
    def __init__(self, *, max_requests: int, window_seconds: float):
        self._max_requests = max_requests
        self._window_seconds = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str) -> None:
        now = time.monotonic()
        window_start = now - self._window_seconds
        recent_hits = [t for t in self._hits[key] if t > window_start]
        if len(recent_hits) >= self._max_requests:
            raise HTTPException(
                status_code=429,
                detail="Too many requests — please wait a moment and try again.",
            )
        recent_hits.append(now)
        self._hits[key] = recent_hits


# Generous enough for real use (someone reading a profile and asking Ask
# BioLens a few follow-up questions), tight enough to stop a naive script
# loop from running up a real LLM bill on a publicly deployed demo.
_llm_limiter = InMemoryRateLimiter(max_requests=20, window_seconds=60.0)


def enforce_llm_rate_limit(request: Request) -> None:
    """FastAPI dependency — attach to any route that calls the LLM:
    `dependencies=[Depends(enforce_llm_rate_limit)]`."""
    client_ip = request.client.host if request.client else "unknown"
    _llm_limiter.check(client_ip)
