"""
Account creation, email verification, and login. Orchestrates
password_policy.py (deterministic complexity rules), user_store.py
(persistence), and email.py (verification email) -- the same
"deterministic logic + a narrowly-scoped external effect" shape as every
other service in this codebase, just with "send an email" standing in for
"call an LLM."

Every exception type here maps to one specific, distinguishable HTTP
response at the router layer (api/app/routers/auth.py) -- callers should
never need to string-match an error message to know what went wrong.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import get_settings
from app.services.email import ConsoleEmailProvider, EmailProvider, get_email_provider
from app.services.password_policy import validate_password
from app.services.user_store import UserRecord, UserStore, get_user_store

_EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class InvalidEmailError(ValueError):
    pass


class PasswordPolicyError(ValueError):
    def __init__(self, violations: list[str]):
        super().__init__("Password does not meet complexity requirements.")
        self.violations = violations


class EmailAlreadyRegisteredError(ValueError):
    pass


class InvalidCredentialsError(ValueError):
    pass


class EmailNotVerifiedError(ValueError):
    pass


class IncorrectPasswordError(ValueError):
    """Raised by change_password/delete_account when the caller's supplied
    current password doesn't match -- distinct from InvalidCredentialsError
    (login) only in name, to keep each router error mapping self-evident."""

    pass


@dataclass
class SignUpResult:
    user_id: str
    email: str
    # Only ever populated by ConsoleEmailProvider (no real SMTP configured)
    # so local development and tests can complete the flow without a real
    # inbox -- never populated once real email delivery is configured, so
    # it can never leak a live token to an API response in production.
    dev_verification_token: str | None = None


@dataclass
class LoginResult:
    access_token: str
    user_id: str
    email: str


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password_hash(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(*, user_id: str, email: str) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expires_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_access_token(token: str) -> dict | None:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


def build_verification_email_bodies(*, verify_url: str) -> tuple[str, str]:
    text_body = (
        "Welcome to BioLens.\n\n"
        "Confirm your email address by opening this link:\n"
        f"{verify_url}\n\n"
        "This link expires in 24 hours. If you didn't create a BioLens account, "
        "you can ignore this email."
    )
    html_body = (
        "<p>Welcome to BioLens.</p>"
        f'<p><a href="{verify_url}">Confirm your email address</a> to finish creating '
        "your account.</p>"
        "<p>This link expires in 24 hours. If you didn't create a BioLens account, "
        "you can ignore this email.</p>"
    )
    return html_body, text_body


async def sign_up(
    *,
    email: str,
    password: str,
    store: UserStore | None = None,
    email_provider: EmailProvider | None = None,
) -> SignUpResult:
    email = email.strip()
    if not _EMAIL_PATTERN.match(email):
        raise InvalidEmailError(f"'{email}' is not a valid email address.")

    violations = validate_password(password, email=email)
    if violations:
        raise PasswordPolicyError(violations)

    store = store or get_user_store()
    if await store.get_user_by_email(email) is not None:
        raise EmailAlreadyRegisteredError(f"An account already exists for '{email}'.")

    password_hash = hash_password(password)
    user = await store.create_user(email=email, password_hash=password_hash)
    token = await store.create_verification_token(user.id)

    settings = get_settings()
    verify_url = f"{settings.api_public_base_url}/auth/verify?token={token}"
    html_body, text_body = build_verification_email_bodies(verify_url=verify_url)

    email_provider = email_provider or get_email_provider()
    await email_provider.send(
        to=user.email,
        subject="Confirm your BioLens account",
        html_body=html_body,
        text_body=text_body,
    )

    dev_token = token if isinstance(email_provider, ConsoleEmailProvider) else None
    return SignUpResult(user_id=user.id, email=user.email, dev_verification_token=dev_token)


async def verify_email(token: str, *, store: UserStore | None = None) -> bool:
    store = store or get_user_store()
    user_id = await store.consume_verification_token(token)
    if user_id is None:
        return False
    await store.mark_verified(user_id)
    return True


async def log_in(*, email: str, password: str, store: UserStore | None = None) -> LoginResult:
    store = store or get_user_store()
    user: UserRecord | None = await store.get_user_by_email(email.strip())
    if user is None or not verify_password_hash(password, user.password_hash):
        raise InvalidCredentialsError("Incorrect email or password.")
    if not user.is_verified:
        raise EmailNotVerifiedError("Please verify your email before logging in.")
    access_token = create_access_token(user_id=user.id, email=user.email)
    return LoginResult(access_token=access_token, user_id=user.id, email=user.email)


def build_password_reset_email_bodies(*, reset_url: str) -> tuple[str, str]:
    text_body = (
        "Someone (hopefully you) requested a password reset for your BioLens account.\n\n"
        "Choose a new password by opening this link:\n"
        f"{reset_url}\n\n"
        "This link expires in 2 hours and can only be used once. If you didn't request "
        "this, you can safely ignore this email -- your password hasn't changed."
    )
    html_body = (
        "<p>Someone (hopefully you) requested a password reset for your BioLens account.</p>"
        f'<p><a href="{reset_url}">Choose a new password</a>.</p>'
        "<p>This link expires in 2 hours and can only be used once. If you didn't request "
        "this, you can safely ignore this email — your password hasn't changed.</p>"
    )
    return html_body, text_body


@dataclass
class PasswordResetRequestResult:
    # Only ever populated by ConsoleEmailProvider, same rationale as
    # SignUpResult.dev_verification_token.
    dev_reset_token: str | None = None


async def request_password_reset(
    *,
    email: str,
    store: UserStore | None = None,
    email_provider: EmailProvider | None = None,
) -> PasswordResetRequestResult:
    """Always returns successfully, whether or not the email exists --
    callers must show the same generic "check your email" message either
    way (see routers/auth.py), so this can never be used to probe which
    emails have an account."""
    store = store or get_user_store()
    user = await store.get_user_by_email(email.strip())
    if user is None:
        return PasswordResetRequestResult()

    token = await store.create_password_reset_token(user.id)
    settings = get_settings()
    reset_url = f"{settings.api_public_base_url}/auth/reset-password?token={token}"
    html_body, text_body = build_password_reset_email_bodies(reset_url=reset_url)

    email_provider = email_provider or get_email_provider()
    await email_provider.send(
        to=user.email,
        subject="Reset your BioLens password",
        html_body=html_body,
        text_body=text_body,
    )
    dev_token = token if isinstance(email_provider, ConsoleEmailProvider) else None
    return PasswordResetRequestResult(dev_reset_token=dev_token)


async def reset_password(*, token: str, new_password: str, store: UserStore | None = None) -> bool:
    """False for any invalid/expired/reused token (same non-distinguishing
    behavior as verify_email) -- in that case new_password is never even
    looked at. Once the token checks out it's consumed immediately (so it
    can't be replayed), *then* the new password's complexity is checked;
    a PasswordPolicyError here means the link is already spent and the user
    needs to request a new one -- the same trade-off most real reset flows
    make rather than adding a separate "peek without consuming" step."""
    store = store or get_user_store()
    user_id = await store.consume_password_reset_token(token)
    if user_id is None:
        return False
    user = await store.get_user_by_id(user_id)
    assert user is not None, "token referenced a user_id that no longer exists"
    violations = validate_password(new_password, email=user.email)
    if violations:
        raise PasswordPolicyError(violations)
    await store.update_password(user_id, password_hash=hash_password(new_password))
    return True


async def change_password(
    *,
    user_id: str,
    current_password: str,
    new_password: str,
    store: UserStore | None = None,
) -> None:
    store = store or get_user_store()
    user = await store.get_user_by_id(user_id)
    if user is None or not verify_password_hash(current_password, user.password_hash):
        raise IncorrectPasswordError("Current password is incorrect.")
    violations = validate_password(new_password, email=user.email)
    if violations:
        raise PasswordPolicyError(violations)
    await store.update_password(user_id, password_hash=hash_password(new_password))


async def delete_account(*, user_id: str, password: str, store: UserStore | None = None) -> None:
    store = store or get_user_store()
    user = await store.get_user_by_id(user_id)
    if user is None or not verify_password_hash(password, user.password_hash):
        raise IncorrectPasswordError("Password is incorrect.")
    await store.delete_user(user_id)
