"""
Service-level auth tests against a real (temp-file) SQLite-backed
UserStore and the real ConsoleEmailProvider -- no mocking of our own logic,
only standing in for a real inbox. A temp file (not ":memory:") is used
deliberately: UserStore opens/closes a fresh connection per call, so
":memory:" would silently reset between calls.
"""

import pytest

from app.services import auth
from app.services.email import ConsoleEmailProvider
from app.services.user_store import UserStore

VALID_PASSWORD = "Tr0ub4dor!Xyz"


@pytest.fixture
def store(tmp_path):
    return UserStore(db_path=str(tmp_path / "test_auth.sqlite3"))


@pytest.fixture
def email_provider():
    return ConsoleEmailProvider()


@pytest.mark.asyncio
async def test_sign_up_creates_unverified_user_and_sends_verification_email(store, email_provider):
    result = await auth.sign_up(
        email="new@example.com",
        password=VALID_PASSWORD,
        store=store,
        email_provider=email_provider,
    )
    assert result.email == "new@example.com"
    assert result.dev_verification_token is not None  # ConsoleEmailProvider -> dev token surfaced

    user = await store.get_user_by_email("new@example.com")
    assert user is not None
    assert user.is_verified is False

    assert len(email_provider.sent) == 1
    assert email_provider.sent[0]["to"] == "new@example.com"
    assert result.dev_verification_token in email_provider.sent[0]["text_body"]


@pytest.mark.asyncio
async def test_sign_up_rejects_invalid_email(store, email_provider):
    with pytest.raises(auth.InvalidEmailError):
        await auth.sign_up(
            email="not-an-email",
            password=VALID_PASSWORD,
            store=store,
            email_provider=email_provider,
        )


@pytest.mark.asyncio
async def test_sign_up_rejects_weak_password(store, email_provider):
    with pytest.raises(auth.PasswordPolicyError) as exc_info:
        await auth.sign_up(
            email="weak@example.com", password="short", store=store, email_provider=email_provider
        )
    assert len(exc_info.value.violations) > 0


@pytest.mark.asyncio
async def test_sign_up_rejects_duplicate_email(store, email_provider):
    await auth.sign_up(
        email="dupe@example.com",
        password=VALID_PASSWORD,
        store=store,
        email_provider=email_provider,
    )
    with pytest.raises(auth.EmailAlreadyRegisteredError):
        await auth.sign_up(
            email="dupe@example.com",
            password=VALID_PASSWORD,
            store=store,
            email_provider=email_provider,
        )


@pytest.mark.asyncio
async def test_login_before_verification_is_rejected(store, email_provider):
    await auth.sign_up(
        email="unverified@example.com",
        password=VALID_PASSWORD,
        store=store,
        email_provider=email_provider,
    )
    with pytest.raises(auth.EmailNotVerifiedError):
        await auth.log_in(email="unverified@example.com", password=VALID_PASSWORD, store=store)


@pytest.mark.asyncio
async def test_verify_then_login_succeeds_and_issues_a_decodable_token(store, email_provider):
    result = await auth.sign_up(
        email="verifyme@example.com",
        password=VALID_PASSWORD,
        store=store,
        email_provider=email_provider,
    )
    ok = await auth.verify_email(result.dev_verification_token, store=store)
    assert ok is True

    login_result = await auth.log_in(
        email="verifyme@example.com", password=VALID_PASSWORD, store=store
    )
    assert login_result.email == "verifyme@example.com"

    decoded = auth.decode_access_token(login_result.access_token)
    assert decoded is not None
    assert decoded["sub"] == login_result.user_id


@pytest.mark.asyncio
async def test_verification_token_cannot_be_reused(store, email_provider):
    result = await auth.sign_up(
        email="onceonly@example.com",
        password=VALID_PASSWORD,
        store=store,
        email_provider=email_provider,
    )
    first = await auth.verify_email(result.dev_verification_token, store=store)
    second = await auth.verify_email(result.dev_verification_token, store=store)
    assert first is True
    assert second is False


@pytest.mark.asyncio
async def test_unknown_verification_token_fails_quietly(store):
    ok = await auth.verify_email("not-a-real-token", store=store)
    assert ok is False


@pytest.mark.asyncio
async def test_login_with_wrong_password_is_rejected(store, email_provider):
    result = await auth.sign_up(
        email="wrongpass@example.com",
        password=VALID_PASSWORD,
        store=store,
        email_provider=email_provider,
    )
    await auth.verify_email(result.dev_verification_token, store=store)
    with pytest.raises(auth.InvalidCredentialsError):
        await auth.log_in(email="wrongpass@example.com", password="WrongPassword1!", store=store)


@pytest.mark.asyncio
async def test_login_with_unknown_email_is_rejected(store):
    with pytest.raises(auth.InvalidCredentialsError):
        await auth.log_in(email="ghost@example.com", password=VALID_PASSWORD, store=store)
