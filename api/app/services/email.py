"""
EmailProvider abstraction (mirrors app/services/llm.py's LLMProvider
pattern exactly): feature code depends on this interface, never on a
specific way of sending mail.

ConsoleEmailProvider is the default and logs the email instead of sending
it -- the same "never fabricate success" discipline BUILD_BRIEF.txt applies
everywhere else in this codebase applies to email too: until real SMTP
credentials exist, BioLens does not pretend a verification link reached a
real inbox. SMTPEmailProvider activates the moment smtp_host/username/
password are configured, exactly like AnthropicProvider only activates once
ANTHROPIC_API_KEY is set.
"""

from __future__ import annotations

import asyncio
import logging
import smtplib
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import get_settings

logger = logging.getLogger("biolens.email")


class EmailProvider(ABC):
    @abstractmethod
    async def send(self, *, to: str, subject: str, html_body: str, text_body: str) -> None:
        raise NotImplementedError


@dataclass
class ConsoleEmailProvider(EmailProvider):
    """Logs the email instead of sending it. Also keeps every "sent" email
    in memory (`self.sent`) so tests and the signup flow's own dev-mode
    response can surface the verification link without a real inbox."""

    sent: list[dict] = field(default_factory=list)

    async def send(self, *, to: str, subject: str, html_body: str, text_body: str) -> None:
        record = {"to": to, "subject": subject, "html_body": html_body, "text_body": text_body}
        self.sent.append(record)
        logger.info(
            "ConsoleEmailProvider: no SMTP configured, logging instead of sending.\n"
            "To: %s\nSubject: %s\n%s",
            to,
            subject,
            text_body,
        )


class SMTPEmailProvider(EmailProvider):
    def __init__(
        self, *, host: str, port: int, username: str, password: str, use_tls: bool, sender: str
    ):
        self._host = host
        self._port = port
        self._username = username
        self._password = password
        self._use_tls = use_tls
        self._sender = sender

    async def send(self, *, to: str, subject: str, html_body: str, text_body: str) -> None:
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = self._sender
        message["To"] = to
        message.attach(MIMEText(text_body, "plain"))
        message.attach(MIMEText(html_body, "html"))
        # smtplib is synchronous; run it off the event loop rather than
        # pulling in an extra async-SMTP dependency for one call site.
        await asyncio.to_thread(self._send_sync, to, message)

    def _send_sync(self, to: str, message: MIMEMultipart) -> None:
        with smtplib.SMTP(self._host, self._port, timeout=10) as server:
            if self._use_tls:
                server.starttls()
            server.login(self._username, self._password)
            server.sendmail(self._sender, [to], message.as_string())


def get_email_provider() -> EmailProvider:
    settings = get_settings()
    if settings.smtp_host and settings.smtp_username and settings.smtp_password:
        return SMTPEmailProvider(
            host=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_username,
            password=settings.smtp_password,
            use_tls=settings.smtp_use_tls,
            sender=settings.email_from,
        )
    return ConsoleEmailProvider()
