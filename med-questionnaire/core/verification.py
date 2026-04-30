import logging
import random
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
    pass


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


def create_and_send_verification_code(email, purpose):
    email = str(email or "").strip().lower()
    if not email:
        raise VerificationError("Email is required.")

    if purpose not in ALLOWED_PURPOSES:
        raise VerificationError("Invalid verification purpose.")

    now = _now()
    cooldown_limit = now - timedelta(seconds=_cooldown_seconds())
    hourly_limit = now - timedelta(hours=1)

    recent = (
        EmailVerificationCode.objects.filter(email=email, purpose=purpose)
        .order_by("-created_at")
        .first()
    )
    if recent and recent.created_at >= cooldown_limit:
        logger.warning("Verification cooldown hit for %s (%s)", email, purpose)
        raise VerificationError("Please wait before requesting another code.")

    sent_last_hour = EmailVerificationCode.objects.filter(
        email=email,
        purpose=purpose,
        created_at__gte=hourly_limit,
    ).count()
    if sent_last_hour >= _max_requests_per_hour():
        logger.warning("Verification rate limit reached for %s (%s)", email, purpose)
        raise VerificationError("Too many verification requests. Try again later.")

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
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@med-questionnaire.local"),
            recipient_list=[email],
            fail_silently=False,
        )
    except Exception as exc:
        logger.exception("Failed to send OTP email for %s (%s): %s", email, purpose, exc)
        raise VerificationError("Failed to send verification code. Please try again later.")

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
        raise VerificationError("Email and code are required.")
    if purpose not in ALLOWED_PURPOSES:
        raise VerificationError("Invalid verification purpose.")

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
        raise VerificationError("Verification code was not requested.")
    if record.is_used:
        raise VerificationError("Verification code was already used.")
    if record.expires_at <= now:
        raise VerificationError("Verification code has expired.")
    if record.attempts >= _max_attempts():
        logger.warning("Verification attempts exceeded for %s (%s)", email, purpose)
        raise VerificationError("Maximum verification attempts exceeded.")

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
        raise VerificationError("Invalid verification code.")

    record.is_used = True
    record.save(update_fields=["is_used"])
    logger.info("Verification code verified for %s (%s)", email, purpose)
    return {"email": email, "purpose": purpose, "verified": True}
