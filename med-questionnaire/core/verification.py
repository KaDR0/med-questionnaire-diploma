import logging
import random
import smtplib
import socket
import time
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.utils import timezone

from .models import EmailVerificationCode

logger = logging.getLogger(__name__)
ALLOWED_PURPOSES = {
    EmailVerificationCode.PURPOSE_PATIENT_SIGNUP,
    EmailVerificationCode.PURPOSE_DOCTOR_SIGNUP,
    EmailVerificationCode.PURPOSE_PATIENT_LOGIN,
}


class VerificationError(Exception):
    def __init__(self, message, *, code="verification_error", public_message=None):
        super().__init__(message)
        self.code = code
        self.public_message = public_message or message


def _now():
    return timezone.now()


def _ttl_seconds():
    return int(getattr(settings, "VERIFICATION_CODE_TTL_SECONDS", 600))


def _cooldown_seconds():
    return int(getattr(settings, "VERIFICATION_CODE_RESEND_COOLDOWN_SECONDS", 60))


def _max_attempts():
    return int(getattr(settings, "VERIFICATION_CODE_MAX_ATTEMPTS", 5))


def _max_requests_per_hour():
    return int(getattr(settings, "VERIFICATION_CODE_MAX_REQUESTS_PER_HOUR", 5))


def _generate_code():
    return "".join(str(random.randint(0, 9)) for _ in range(6))


def _email_backend_name():
    return str(getattr(settings, "EMAIL_BACKEND", "") or "")


def _is_console_like_backend():
    backend = _email_backend_name().lower()
    return "console" in backend or "filebased" in backend or "locmem" in backend


def _log_email_backend_state():
    backend = _email_backend_name()
    logger.info(
        "OTP email backend in use: backend=%s host=%s port=%s tls=%s ssl=%s from=%s",
        backend,
        getattr(settings, "EMAIL_HOST", ""),
        getattr(settings, "EMAIL_PORT", ""),
        getattr(settings, "EMAIL_USE_TLS", False),
        getattr(settings, "EMAIL_USE_SSL", False),
        getattr(settings, "DEFAULT_FROM_EMAIL", ""),
    )
    if _is_console_like_backend():
        logger.warning("OTP emails are routed to local backend (%s), not real SMTP delivery.", backend)


def _is_smtp_backend():
    return "smtp" in _email_backend_name().lower()


def _send_otp_email(recipient_email, subject, message):
    host = str(getattr(settings, "EMAIL_HOST", "") or "").strip()
    if _is_smtp_backend() and not host:
        logger.error("OTP SMTP misconfiguration: EMAIL_HOST is empty while SMTP backend is enabled.")
        raise VerificationError(
            "Failed to send verification code. Please try again later.",
            code="smtp_config_error",
        )

    max_attempts = 2
    last_error = None
    for attempt in range(1, max_attempts + 1):
        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@med-questionnaire.local"),
                recipient_list=[recipient_email],
                fail_silently=False,
            )
            if attempt > 1:
                logger.info(
                    "OTP email send recovered after retry: email=%s attempt=%s",
                    recipient_email,
                    attempt,
                )
            return
        except (socket.gaierror, TimeoutError, smtplib.SMTPException, OSError) as exc:
            last_error = exc
            logger.warning(
                "OTP email send attempt failed: email=%s attempt=%s/%s error=%s",
                recipient_email,
                attempt,
                max_attempts,
                repr(exc),
                exc_info=True,
            )
            if attempt < max_attempts:
                time.sleep(0.5)
                continue
            logger.error(
                "OTP email delivery failed after retries: email=%s error_type=%s error=%s",
                recipient_email,
                type(exc).__name__,
                str(exc),
                exc_info=True,
            )
            raise VerificationError(
                "Failed to send verification code. Please try again later.",
                code="smtp_send_failed",
            ) from exc
        except Exception as exc:
            last_error = exc
            logger.exception("Unexpected OTP email send failure for %s: %s", recipient_email, exc)
            raise VerificationError(
                "Failed to send verification code. Please try again later.",
                code="smtp_send_failed",
            ) from exc

    logger.error("OTP email send failed without raised exception, last_error=%r", last_error)
    raise VerificationError(
        "Failed to send verification code. Please try again later.",
        code="smtp_send_failed",
    )


def create_and_send_verification_code(email, purpose):
    email = str(email or "").strip().lower()
    if not email:
        raise VerificationError("Email is required.", code="email_required")

    if purpose not in ALLOWED_PURPOSES:
        raise VerificationError("Invalid verification purpose.", code="invalid_purpose")

    now = _now()
    cooldown_limit = now - timedelta(seconds=_cooldown_seconds())
    hourly_limit = now - timedelta(hours=1)

    recent = (
        EmailVerificationCode.objects.filter(email=email, purpose=purpose)
        .order_by("-created_at")
        .first()
    )
    # Cooldown is for resending while a code is still outstanding. Once the latest code is used
    # (e.g. completed login) or expired, a new login must be allowed to send OTP — otherwise
    # patient_login hits cooldown immediately after a successful OTP + logout within the window.
    if recent and recent.created_at >= cooldown_limit:
        pending_unused = not recent.is_used and recent.expires_at > now
        if pending_unused:
            logger.warning(
                "Verification cooldown (resend): email=%s purpose=%s last_send=%s cooldown_sec=%s",
                email,
                purpose,
                recent.created_at.isoformat() if recent else None,
                _cooldown_seconds(),
            )
            raise VerificationError(
                "Please wait before requesting another code.",
                code="cooldown",
                public_message="Please wait before requesting another code.",
            )

    sent_qs = EmailVerificationCode.objects.filter(
        email=email,
        purpose=purpose,
        created_at__gte=hourly_limit,
    ).order_by("created_at")
    sent_last_hour = sent_qs.count()
    hour_cap = _max_requests_per_hour()
    if sent_last_hour >= hour_cap:
        oldest = sent_qs.first()
        newest = sent_qs.last()
        logger.warning(
            "Verification rate limit (hourly): email=%s purpose=%s count_in_window=%s limit=%s "
            "window_rolling_1h oldest_send=%s newest_send=%s",
            email,
            purpose,
            sent_last_hour,
            hour_cap,
            oldest.created_at.isoformat() if oldest else None,
            newest.created_at.isoformat() if newest else None,
        )
        raise VerificationError(
            "Too many verification requests in the last hour. Try again later.",
            code="rate_limit",
            public_message="Too many verification requests in the last hour. Try again later.",
        )

    plain_code = _generate_code()
    hashed_code = make_password(plain_code)
    expiry = now + timedelta(seconds=_ttl_seconds())
    _log_email_backend_state()

    subject = "Your verification code"
    message = (
        f"Your verification code is: {plain_code}\n\n"
        f"It expires in {_ttl_seconds() // 60} minutes.\n"
        "If you did not request this code, ignore this message."
    )
    _send_otp_email(email, subject, message)

    # Keep OTP semantics strict: only one active code per email+purpose.
    # Invalidate previous active codes only after successful send.
    EmailVerificationCode.objects.filter(
        email=email,
        purpose=purpose,
        is_used=False,
        expires_at__gt=now,
    ).update(is_used=True)
    EmailVerificationCode.objects.create(
        email=email,
        code=hashed_code,
        purpose=purpose,
        expires_at=expiry,
    )
    logger.info("Verification code sent for %s (%s)", email, purpose)
    return {"email": email, "purpose": purpose, "expires_at": expiry}


def verify_code(email, purpose, code):
    email = str(email or "").strip().lower()
    code = str(code or "").strip()
    if not email or not code:
        raise VerificationError("Email and code are required.", code="email_or_code_missing")
    if purpose not in ALLOWED_PURPOSES:
        raise VerificationError("Invalid verification purpose.", code="invalid_purpose")

    now = _now()
    record = (
        EmailVerificationCode.objects.filter(
            email=email,
            purpose=purpose,
            is_used=False,
            expires_at__gt=now,
        )
        .order_by("-created_at")
        .first()
    )
    if not record:
        raise VerificationError("Verification code was not requested.", code="code_not_requested")
    if record.is_used:
        raise VerificationError("Verification code was already used.", code="code_already_used")
    if record.expires_at <= now:
        raise VerificationError("Verification code has expired.", code="code_expired")
    if record.attempts >= _max_attempts():
        logger.warning("Verification attempts exceeded for %s (%s)", email, purpose)
        raise VerificationError("Maximum verification attempts exceeded.", code="max_attempts_exceeded")

    if not check_password(code, record.code):
        record.attempts += 1
        record.save(update_fields=["attempts"])
        logger.warning(
            "Invalid verification code for %s (%s), attempts=%s",
            email,
            purpose,
            record.attempts,
        )
        if record.attempts >= _max_attempts():
            logger.warning("Verification code locked after failed attempts for %s (%s)", email, purpose)
        raise VerificationError("Invalid verification code.", code="invalid_code")

    record.is_used = True
    record.save(update_fields=["is_used"])
    logger.info("Verification code verified for %s (%s)", email, purpose)
    return {"email": email, "purpose": purpose, "verified": True}
