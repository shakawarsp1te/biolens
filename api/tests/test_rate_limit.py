"""InMemoryRateLimiter tests: allows up to the limit, 429s past it, and the
window rolls forward so old hits stop counting."""

import time

import pytest
from fastapi import HTTPException

from app.core.rate_limit import InMemoryRateLimiter


def test_allows_requests_up_to_the_limit():
    limiter = InMemoryRateLimiter(max_requests=3, window_seconds=60.0)
    for _ in range(3):
        limiter.check("1.2.3.4")  # should not raise


def test_raises_429_once_over_the_limit():
    limiter = InMemoryRateLimiter(max_requests=2, window_seconds=60.0)
    limiter.check("1.2.3.4")
    limiter.check("1.2.3.4")
    with pytest.raises(HTTPException) as exc_info:
        limiter.check("1.2.3.4")
    assert exc_info.value.status_code == 429


def test_limits_are_independent_per_key():
    limiter = InMemoryRateLimiter(max_requests=1, window_seconds=60.0)
    limiter.check("1.2.3.4")
    limiter.check("5.6.7.8")  # a different client, should not raise


def test_old_hits_outside_the_window_stop_counting():
    limiter = InMemoryRateLimiter(max_requests=1, window_seconds=0.05)
    limiter.check("1.2.3.4")
    time.sleep(0.06)
    limiter.check("1.2.3.4")  # window has rolled forward, should not raise
