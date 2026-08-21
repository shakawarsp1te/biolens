"""
Account creation, email verification, login, and session check.

GET /auth/verify returns an HTML page rather than JSON -- it's the one
endpoint in this whole API meant to be opened directly by a browser (via
whatever link a person clicks in their email client), not called by the
mobile app.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.services import auth
from app.services.email import get_email_provider
from app.services.user_store import get_user_store

router = APIRouter(prefix="/auth", tags=["auth"])
_bearer_scheme = HTTPBearer(auto_error=False)


class SignUpRequest(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)


class SignUpResponse(BaseModel):
    message: str
    email: str
    # Populated only when no real SMTP is configured (ConsoleEmailProvider)
    # so local development/tests can complete the flow without a real
    # inbox -- see auth.py's SignUpResult docstring.
    dev_verification_token: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    is_verified: bool


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ResendVerificationRequest(BaseModel):
    email: str


class MessageResponse(BaseModel):
    message: str


@router.post("/signup", response_model=SignUpResponse, status_code=201)
async def signup(payload: SignUpRequest) -> SignUpResponse:
    try:
        result = await auth.sign_up(email=payload.email, password=payload.password)
    except auth.InvalidEmailError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except auth.PasswordPolicyError as exc:
        raise HTTPException(status_code=422, detail=exc.violations) from exc
    except auth.EmailAlreadyRegisteredError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return SignUpResponse(
        message="Account created. Check your email to verify it before logging in.",
        email=result.email,
        dev_verification_token=result.dev_verification_token,
    )


@router.get("/verify", response_class=HTMLResponse)
async def verify(token: str) -> HTMLResponse:
    ok = await auth.verify_email(token)
    if ok:
        return HTMLResponse(_VERIFY_SUCCESS_HTML)
    return HTMLResponse(_VERIFY_FAILURE_HTML, status_code=400)


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest) -> LoginResponse:
    try:
        result = await auth.log_in(email=payload.email, password=payload.password)
    except auth.InvalidCredentialsError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except auth.EmailNotVerifiedError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    return LoginResponse(
        access_token=result.access_token,
        user=UserOut(id=result.user_id, email=result.email, is_verified=True),
    )


@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification(payload: ResendVerificationRequest) -> MessageResponse:
    # Deliberately the same response whether or not the email exists or is
    # already verified -- never confirm/deny account existence to whoever's
    # calling this endpoint.
    generic_message = "If that email exists and isn't verified yet, we've sent a new link."
    store = get_user_store()
    user = await store.get_user_by_email(payload.email)
    if user is not None and not user.is_verified:
        token = await store.create_verification_token(user.id)
        settings = get_settings()
        verify_url = f"{settings.api_public_base_url}/auth/verify?token={token}"
        html_body, text_body = auth.build_verification_email_bodies(verify_url=verify_url)
        await get_email_provider().send(
            to=user.email,
            subject="Confirm your BioLens account",
            html_body=html_body,
            text_body=text_body,
        )
    return MessageResponse(message=generic_message)


@router.get("/me", response_model=UserOut)
async def me(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> UserOut:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing bearer token.")
    payload = auth.decode_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    store = get_user_store()
    user = await store.get_user_by_id(payload["sub"])
    if user is None:
        raise HTTPException(status_code=401, detail="Account no longer exists.")
    return UserOut(id=user.id, email=user.email, is_verified=user.is_verified)


_VERIFY_SUCCESS_HTML = """
<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>BioLens — Email verified</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  body { background:#060708; color:#F5F7FA; font-family:-apple-system,sans-serif;
         display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
  .card { text-align:center; padding:32px; max-width:360px; }
  h1 { font-size:22px; margin-bottom:8px; }
  p { color:#98A2B3; font-size:15px; }
</style></head>
<body><div class="card">
  <h1>✅ Email verified</h1>
  <p>Your BioLens account is ready. Head back to the app and log in.</p>
</div></body></html>
"""

_VERIFY_FAILURE_HTML = """
<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>BioLens — Verification link invalid</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  body { background:#060708; color:#F5F7FA; font-family:-apple-system,sans-serif;
         display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
  .card { text-align:center; padding:32px; max-width:360px; }
  h1 { font-size:22px; margin-bottom:8px; }
  p { color:#98A2B3; font-size:15px; }
</style></head>
<body><div class="card">
  <h1>This link isn't valid</h1>
  <p>It may have expired or already been used. Request a new verification email from the app.</p>
</div></body></html>
"""
