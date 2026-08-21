"""
Account creation, email verification, login, session check, password
reset, change password, and delete account.

GET/POST /auth/verify and /auth/reset-password return HTML pages rather
than JSON -- they're the endpoints in this API meant to be opened directly
by a browser (via whatever link a person clicks in their email client, or
the reset form itself), not called by the mobile app.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Form, HTTPException
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


class RequestPasswordResetRequest(BaseModel):
    email: str


class RequestPasswordResetResponse(BaseModel):
    message: str
    # Same dev-only escape hatch as SignUpResponse.dev_verification_token.
    dev_reset_token: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class DeleteAccountRequest(BaseModel):
    password: str


class MessageResponse(BaseModel):
    message: str


async def _require_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> str:
    """Shared dependency behind every endpoint that needs "who is this,
    authenticated" -- one place that maps a missing/invalid/expired bearer
    token to 401, so /me, /change-password, and DELETE /me can't drift out
    of sync on how they check a session."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing bearer token.")
    payload = auth.decode_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    return payload["sub"]


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
        return HTMLResponse(_page("Email verified", "✅ Email verified", _VERIFY_SUCCESS_BODY))
    return HTMLResponse(
        _page("Verification link invalid", "This link isn't valid", _INVALID_LINK_BODY),
        status_code=400,
    )


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
async def me(user_id: str = Depends(_require_user_id)) -> UserOut:
    store = get_user_store()
    user = await store.get_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="Account no longer exists.")
    return UserOut(id=user.id, email=user.email, is_verified=user.is_verified)


@router.post("/request-password-reset", response_model=RequestPasswordResetResponse)
async def request_password_reset(
    payload: RequestPasswordResetRequest,
) -> RequestPasswordResetResponse:
    # Same anti-enumeration shape as /resend-verification -- always the
    # same message, whether or not the email has an account.
    result = await auth.request_password_reset(email=payload.email)
    return RequestPasswordResetResponse(
        message="If that email has a BioLens account, we've sent a password reset link.",
        dev_reset_token=result.dev_reset_token,
    )


@router.get("/reset-password", response_class=HTMLResponse)
async def reset_password_form(token: str) -> HTMLResponse:
    return HTMLResponse(_RESET_FORM_HTML.replace("__TOKEN__", token))


@router.post("/reset-password", response_class=HTMLResponse)
async def reset_password_submit(
    token: str = Form(...),
    new_password: str = Form(...),
    confirm_password: str = Form(...),
) -> HTMLResponse:
    if new_password != confirm_password:
        return HTMLResponse(
            _page(
                "Passwords didn't match",
                "Passwords didn't match",
                "<p>Go back and try again.</p>"
                f'<p><a href="/auth/reset-password?token={token}" style="color:#4C7EFF">'
                "Back to the reset form</a></p>",
            ),
            status_code=422,
        )
    try:
        ok = await auth.reset_password(token=token, new_password=new_password)
    except auth.PasswordPolicyError as exc:
        violations_html = "".join(f"<li>{v}</li>" for v in exc.violations)
        return HTMLResponse(
            _page(
                "Password not strong enough",
                "Password not strong enough",
                f"<ul style='text-align:left'>{violations_html}</ul>"
                "<p>This link has already been used — request a new one from the app.</p>",
            ),
            status_code=422,
        )
    if not ok:
        return HTMLResponse(
            _page("Reset link invalid", "This link isn't valid", _INVALID_LINK_BODY),
            status_code=400,
        )
    return HTMLResponse(
        _page(
            "Password updated",
            "✅ Password updated",
            "<p>Your BioLens password has been changed. Head back to the app and log in.</p>",
        )
    )


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    payload: ChangePasswordRequest, user_id: str = Depends(_require_user_id)
) -> MessageResponse:
    try:
        await auth.change_password(
            user_id=user_id,
            current_password=payload.current_password,
            new_password=payload.new_password,
        )
    except auth.IncorrectPasswordError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except auth.PasswordPolicyError as exc:
        raise HTTPException(status_code=422, detail=exc.violations) from exc
    return MessageResponse(message="Password changed.")


@router.delete("/me", response_model=MessageResponse)
async def delete_account(
    payload: DeleteAccountRequest, user_id: str = Depends(_require_user_id)
) -> MessageResponse:
    try:
        await auth.delete_account(user_id=user_id, password=payload.password)
    except auth.IncorrectPasswordError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return MessageResponse(message="Account deleted.")


def _page(title: str, heading: str, body_html: str) -> str:
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>BioLens — {title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  body {{ background:#060708; color:#F5F7FA; font-family:-apple-system,sans-serif;
         display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }}
  .card {{ text-align:center; padding:32px; max-width:360px; }}
  h1 {{ font-size:22px; margin-bottom:8px; }}
  p {{ color:#98A2B3; font-size:15px; }}
  input {{ width:100%; box-sizing:border-box; padding:12px 14px; margin-top:6px;
          border-radius:10px; border:none; background:#1A1E24; color:#F5F7FA; font-size:15px; }}
  label {{ display:block; text-align:left; font-size:12px; color:#5D6470; margin-top:16px; }}
  button {{ width:100%; margin-top:24px; padding:12px; border-radius:999px; border:none;
           background:#4C7EFF; color:#04070D; font-size:15px; font-weight:700; cursor:pointer; }}
</style></head>
<body><div class="card">
  <h1>{heading}</h1>
  {body_html}
</div></body></html>"""


_VERIFY_SUCCESS_BODY = "<p>Your BioLens account is ready. Head back to the app and log in.</p>"

_INVALID_LINK_BODY = (
    "<p>It may have expired or already been used. Request a new one from the app.</p>"
)

_RESET_FORM_HTML = _page(
    "Reset your password",
    "Reset your password",
    """
  <form method="POST" action="/auth/reset-password">
    <input type="hidden" name="token" value="__TOKEN__" />
    <label for="new_password">New password</label>
    <input type="password" id="new_password" name="new_password" required />
    <label for="confirm_password">Confirm new password</label>
    <input type="password" id="confirm_password" name="confirm_password" required />
    <button type="submit">Set new password</button>
  </form>
""",
)
