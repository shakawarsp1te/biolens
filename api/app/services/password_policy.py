"""
Password complexity rules for account creation. Deterministic, no LLM
involvement (§41's "deterministic before LLM" applies just as much to a
security rule as to a stats parser) — every rule here is checkable by plain
Python, and the exact same rule set is mirrored client-side in
app/utils/passwordPolicy.ts for an instant strength meter, with this module
as the one authoritative source of truth (the client-side check is
UX-only; a request that slips past it still gets rejected here).
"""

from __future__ import annotations

import re

MIN_LENGTH = 10
SPECIAL_CHARS = "!@#$%^&*()_+-=[]{}|;:,.<>?/~`"

# A short, deliberately small denylist of the most common passwords that
# would otherwise sail through every rule below (they're long enough, and
# some even mix case/digits). Not a substitute for a real breached-password
# API — just catching the most obvious cases without a network dependency.
_COMMON_PASSWORDS = {
    "password123",
    "password1234",
    "qwertyuiop12",
    "1234567890ab",
    "letmein12345",
    "iloveyou1234",
}


def validate_password(password: str, *, email: str | None = None) -> list[str]:
    """Returns a list of violated-rule messages; empty list means the
    password passes every rule. Never raises -- callers decide what to do
    with a non-empty list (e.g. auth.py turns it into a 422)."""
    violations: list[str] = []

    if len(password) < MIN_LENGTH:
        violations.append(f"Must be at least {MIN_LENGTH} characters long.")
    if not re.search(r"[a-z]", password):
        violations.append("Must include a lowercase letter.")
    if not re.search(r"[A-Z]", password):
        violations.append("Must include an uppercase letter.")
    if not re.search(r"\d", password):
        violations.append("Must include a number.")
    if not any(char in SPECIAL_CHARS for char in password):
        violations.append("Must include a special character (e.g. ! @ # $ % & *).")
    if password.lower() in _COMMON_PASSWORDS:
        violations.append("This password is too common — please choose another.")

    if email:
        local_part = email.split("@", 1)[0].lower()
        if local_part and local_part in password.lower():
            violations.append("Must not contain your email address.")

    return violations
