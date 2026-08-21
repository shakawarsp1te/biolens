"""Router-level tests for /auth/* -- service-layer functions monkeypatched
(same pattern as test_ask_router.py/test_market_router.py) so these only
exercise request/response shape and status-code mapping."""

from fastapi.testclient import TestClient

import app.routers.auth as auth_router_module
from app.main import app
from app.services import auth as auth_service
from app.services.user_store import UserRecord

client = TestClient(app)


def test_signup_success(monkeypatch):
    async def fake_sign_up(*, email, password):
        assert email == "new@example.com"
        return auth_service.SignUpResult(
            user_id="u1", email=email, dev_verification_token="dev-token-123"
        )

    monkeypatch.setattr(auth_router_module.auth, "sign_up", fake_sign_up)

    response = client.post(
        "/auth/signup", json={"email": "new@example.com", "password": "Tr0ub4dor!Xyz"}
    )
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "new@example.com"
    assert body["dev_verification_token"] == "dev-token-123"


def test_signup_rejects_weak_password(monkeypatch):
    async def fake_sign_up(*, email, password):
        raise auth_service.PasswordPolicyError(["Must be at least 10 characters long."])

    monkeypatch.setattr(auth_router_module.auth, "sign_up", fake_sign_up)

    response = client.post("/auth/signup", json={"email": "a@example.com", "password": "short"})
    assert response.status_code == 422
    assert "at least 10 characters" in str(response.json()["detail"])


def test_signup_rejects_duplicate_email(monkeypatch):
    async def fake_sign_up(*, email, password):
        raise auth_service.EmailAlreadyRegisteredError(f"An account already exists for '{email}'.")

    monkeypatch.setattr(auth_router_module.auth, "sign_up", fake_sign_up)

    response = client.post(
        "/auth/signup", json={"email": "dupe@example.com", "password": "Tr0ub4dor!Xyz"}
    )
    assert response.status_code == 409


def test_verify_success_renders_html(monkeypatch):
    async def fake_verify_email(token):
        assert token == "good-token"
        return True

    monkeypatch.setattr(auth_router_module.auth, "verify_email", fake_verify_email)

    response = client.get("/auth/verify", params={"token": "good-token"})
    assert response.status_code == 200
    assert "verified" in response.text.lower()


def test_verify_failure_renders_error_page(monkeypatch):
    async def fake_verify_email(token):
        return False

    monkeypatch.setattr(auth_router_module.auth, "verify_email", fake_verify_email)

    response = client.get("/auth/verify", params={"token": "bad-token"})
    assert response.status_code == 400
    assert "isn't valid" in response.text.lower() or "not valid" in response.text.lower()


def test_login_success(monkeypatch):
    async def fake_log_in(*, email, password):
        return auth_service.LoginResult(access_token="jwt-abc", user_id="u1", email=email)

    monkeypatch.setattr(auth_router_module.auth, "log_in", fake_log_in)

    response = client.post(
        "/auth/login", json={"email": "user@example.com", "password": "Tr0ub4dor!Xyz"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["access_token"] == "jwt-abc"
    assert body["user"]["email"] == "user@example.com"
    assert body["user"]["is_verified"] is True


def test_login_wrong_credentials_returns_401(monkeypatch):
    async def fake_log_in(*, email, password):
        raise auth_service.InvalidCredentialsError("Incorrect email or password.")

    monkeypatch.setattr(auth_router_module.auth, "log_in", fake_log_in)

    response = client.post("/auth/login", json={"email": "user@example.com", "password": "wrong"})
    assert response.status_code == 401


def test_login_unverified_returns_403(monkeypatch):
    async def fake_log_in(*, email, password):
        raise auth_service.EmailNotVerifiedError("Please verify your email before logging in.")

    monkeypatch.setattr(auth_router_module.auth, "log_in", fake_log_in)

    response = client.post(
        "/auth/login", json={"email": "user@example.com", "password": "Tr0ub4dor!Xyz"}
    )
    assert response.status_code == 403


def test_me_without_token_returns_401():
    response = client.get("/auth/me")
    assert response.status_code == 401


def test_me_with_invalid_token_returns_401(monkeypatch):
    monkeypatch.setattr(auth_router_module.auth, "decode_access_token", lambda token: None)
    response = client.get("/auth/me", headers={"Authorization": "Bearer garbage"})
    assert response.status_code == 401


def test_me_with_valid_token_returns_user(monkeypatch):
    monkeypatch.setattr(
        auth_router_module.auth,
        "decode_access_token",
        lambda token: {"sub": "u1", "email": "x@example.com"},
    )

    async def fake_get_user_by_id(self, user_id):
        assert user_id == "u1"
        return UserRecord(
            id="u1", email="x@example.com", password_hash="hash", is_verified=True, created_at="now"
        )

    monkeypatch.setattr(
        auth_router_module.get_user_store().__class__, "get_user_by_id", fake_get_user_by_id
    )

    response = client.get("/auth/me", headers={"Authorization": "Bearer good-token"})
    assert response.status_code == 200
    assert response.json()["email"] == "x@example.com"


def test_resend_verification_returns_generic_message_regardless(monkeypatch):
    async def fake_get_user_by_email(self, email):
        return None

    monkeypatch.setattr(
        auth_router_module.get_user_store().__class__, "get_user_by_email", fake_get_user_by_email
    )

    response = client.post("/auth/resend-verification", json={"email": "nobody@example.com"})
    assert response.status_code == 200
    assert "if that email exists" in response.json()["message"].lower()


def test_request_password_reset_returns_generic_message(monkeypatch):
    async def fake_request_password_reset(*, email, store=None, email_provider=None):
        return auth_service.PasswordResetRequestResult(dev_reset_token="reset-tok")

    monkeypatch.setattr(
        auth_router_module.auth, "request_password_reset", fake_request_password_reset
    )

    response = client.post("/auth/request-password-reset", json={"email": "user@example.com"})
    assert response.status_code == 200
    body = response.json()
    assert "password reset link" in body["message"].lower()
    assert body["dev_reset_token"] == "reset-tok"


def test_reset_password_form_renders_with_token(monkeypatch):
    response = client.get("/auth/reset-password", params={"token": "abc123"})
    assert response.status_code == 200
    assert "abc123" in response.text
    assert "new_password" in response.text


def test_reset_password_submit_success(monkeypatch):
    async def fake_reset_password(*, token, new_password, store=None):
        assert token == "good-token"
        assert new_password == "Br4nd!NewPass"
        return True

    monkeypatch.setattr(auth_router_module.auth, "reset_password", fake_reset_password)

    response = client.post(
        "/auth/reset-password",
        data={
            "token": "good-token",
            "new_password": "Br4nd!NewPass",
            "confirm_password": "Br4nd!NewPass",
        },
    )
    assert response.status_code == 200
    assert "password updated" in response.text.lower()


def test_reset_password_submit_mismatched_confirmation():
    response = client.post(
        "/auth/reset-password",
        data={"token": "t", "new_password": "Br4nd!NewPass", "confirm_password": "Different1!"},
    )
    assert response.status_code == 422
    assert "didn" in response.text.lower()  # "didn't match"


def test_reset_password_submit_invalid_token(monkeypatch):
    async def fake_reset_password(*, token, new_password, store=None):
        return False

    monkeypatch.setattr(auth_router_module.auth, "reset_password", fake_reset_password)

    response = client.post(
        "/auth/reset-password",
        data={"token": "bad", "new_password": "Br4nd!NewPass", "confirm_password": "Br4nd!NewPass"},
    )
    assert response.status_code == 400


def test_reset_password_submit_weak_new_password(monkeypatch):
    async def fake_reset_password(*, token, new_password, store=None):
        raise auth_service.PasswordPolicyError(["Must be at least 10 characters long."])

    monkeypatch.setattr(auth_router_module.auth, "reset_password", fake_reset_password)

    response = client.post(
        "/auth/reset-password",
        data={"token": "t", "new_password": "weak", "confirm_password": "weak"},
    )
    assert response.status_code == 422
    assert "at least 10 characters" in response.text


def test_change_password_requires_auth():
    response = client.post(
        "/auth/change-password", json={"current_password": "a", "new_password": "b"}
    )
    assert response.status_code == 401


def test_change_password_success(monkeypatch):
    monkeypatch.setattr(auth_router_module.auth, "decode_access_token", lambda token: {"sub": "u1"})

    async def fake_change_password(*, user_id, current_password, new_password, store=None):
        assert user_id == "u1"

    monkeypatch.setattr(auth_router_module.auth, "change_password", fake_change_password)

    response = client.post(
        "/auth/change-password",
        json={"current_password": "OldPass1!!", "new_password": "NewPass1!!"},
        headers={"Authorization": "Bearer good-token"},
    )
    assert response.status_code == 200


def test_change_password_wrong_current_password_returns_400(monkeypatch):
    monkeypatch.setattr(auth_router_module.auth, "decode_access_token", lambda token: {"sub": "u1"})

    async def fake_change_password(*, user_id, current_password, new_password, store=None):
        raise auth_service.IncorrectPasswordError("Current password is incorrect.")

    monkeypatch.setattr(auth_router_module.auth, "change_password", fake_change_password)

    response = client.post(
        "/auth/change-password",
        json={"current_password": "Wrong1!!", "new_password": "NewPass1!!"},
        headers={"Authorization": "Bearer good-token"},
    )
    assert response.status_code == 400


def test_delete_account_requires_auth():
    response = client.request("DELETE", "/auth/me", json={"password": "x"})
    assert response.status_code == 401


def test_delete_account_success(monkeypatch):
    monkeypatch.setattr(auth_router_module.auth, "decode_access_token", lambda token: {"sub": "u1"})

    async def fake_delete_account(*, user_id, password, store=None):
        assert user_id == "u1"

    monkeypatch.setattr(auth_router_module.auth, "delete_account", fake_delete_account)

    response = client.request(
        "DELETE",
        "/auth/me",
        json={"password": "Tr0ub4dor!Xyz"},
        headers={"Authorization": "Bearer good-token"},
    )
    assert response.status_code == 200


def test_delete_account_wrong_password_returns_400(monkeypatch):
    monkeypatch.setattr(auth_router_module.auth, "decode_access_token", lambda token: {"sub": "u1"})

    async def fake_delete_account(*, user_id, password, store=None):
        raise auth_service.IncorrectPasswordError("Password is incorrect.")

    monkeypatch.setattr(auth_router_module.auth, "delete_account", fake_delete_account)

    response = client.request(
        "DELETE",
        "/auth/me",
        json={"password": "wrong"},
        headers={"Authorization": "Bearer good-token"},
    )
    assert response.status_code == 400
