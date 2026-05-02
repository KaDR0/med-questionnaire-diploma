"""
Patient login 'remember this device' — server-backed trusted browser tokens.

Only a random raw token is placed in an httpOnly cookie; the database stores SHA-256.
"""

from __future__ import annotations

import hashlib
import logging
import secrets

from django.conf import settings
from django.contrib.auth.models import User
from django.utils import timezone

from .models import PatientTrustedDevice

logger = logging.getLogger(__name__)


def hash_trusted_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def cookie_name() -> str:
    return getattr(settings, "PATIENT_TRUSTED_DEVICE_COOKIE_NAME", "mq_patient_td")


def trusted_device_ttl_seconds() -> int:
    return int(getattr(settings, "PATIENT_TRUSTED_DEVICE_MAX_AGE_SECONDS", 30 * 24 * 3600))


def _cookie_secure(request) -> bool:
    """
    Browsers refuse Secure cookies on plain HTTP — never mark Secure on non-TLS requests.
    On HTTPS, honor PATIENT_TRUSTED_DEVICE_COOKIE_SECURE (defaults True when unset).
    """
    if not request.is_secure():
        return False
    return getattr(settings, "PATIENT_TRUSTED_DEVICE_COOKIE_SECURE", True)


def get_raw_cookie(request) -> str:
    return (request.COOKIES.get(cookie_name()) or "").strip()


def validate_trusted_device(request, user: User) -> bool:
    """
    Return True if the request has a valid, unexpired trusted-device cookie for *this* user.

    The cookie token is always looked up together with `user` (not by cookie alone), so one
    account's token cannot satisfy OTP skip for a different user.
    """
    name = cookie_name()
    raw = get_raw_cookie(request)
    hdr = request.META.get("HTTP_COOKIE") or ""
    logger.info(
        "trusted_device: login_request cookie_header_len=%s header_has_cookie_name=%s user_id=%s",
        len(hdr),
        name in hdr,
        getattr(user, "id", None),
    )
    if len(raw) < 16:
        logger.info(
            "trusted_device: absent_or_short_cookie user_id=%s cookie_name=%s parsed_len=%s raw_cookie_keys_sample=%s",
            getattr(user, "id", None),
            name,
            len(raw) if raw else 0,
            list(request.COOKIES.keys())[:12],
        )
        return False
    digest = hash_trusted_token(raw)
    now = timezone.now()
    td = PatientTrustedDevice.objects.filter(
        user=user,
        token_hash=digest,
        expires_at__gt=now,
    ).first()
    if not td:
        other_live = PatientTrustedDevice.objects.filter(token_hash=digest, expires_at__gt=now).exclude(
            user=user
        ).exists()
        stale = PatientTrustedDevice.objects.filter(user=user, token_hash=digest).first()
        expired = bool(stale and stale.expires_at <= now)
        logger.info(
            "trusted_device: no_valid_row user_id=%s hash_prefix=%s token_bound_other_user=%s "
            "had_stale_row=%s stale_expired=%s",
            user.id,
            digest[:12],
            other_live,
            stale is not None,
            expired,
        )
        return False
    PatientTrustedDevice.objects.filter(pk=td.pk).update(last_used_at=now)
    logger.info(
        "trusted_device: accepted user_id=%s device_row_id=%s expires_at=%s",
        user.id,
        td.id,
        td.expires_at.isoformat(),
    )
    return True


def issue_trusted_device(request, user: User) -> tuple[str, PatientTrustedDevice]:
    raw = secrets.token_urlsafe(32)
    digest = hash_trusted_token(raw)
    now = timezone.now()
    expires = now + timezone.timedelta(seconds=trusted_device_ttl_seconds())
    ua = (request.META.get("HTTP_USER_AGENT") or "")[:512]
    td = PatientTrustedDevice.objects.create(
        user=user,
        token_hash=digest,
        expires_at=expires,
        user_agent=ua,
    )
    return raw, td


def attach_trusted_device_cookie(response, raw_token: str, request) -> None:
    max_age = trusted_device_ttl_seconds()
    secure = _cookie_secure(request)
    response.set_cookie(
        cookie_name(),
        raw_token,
        max_age=max_age,
        httponly=True,
        secure=secure,
        samesite="Lax",
        path="/",
    )
    logger.info(
        "trusted_device: set_cookie name=%s max_age=%s secure=%s samesite=Lax path=/ "
        "transport_https=%s",
        cookie_name(),
        max_age,
        secure,
        request.is_secure(),
    )


def clear_trusted_device_cookie(response, request=None) -> None:
    """Expire the cookie in the browser (must mirror flags used when setting)."""
    secure = _cookie_secure(request) if request is not None else False
    response.set_cookie(
        cookie_name(),
        "",
        max_age=0,
        path="/",
        httponly=True,
        secure=secure,
        samesite="Lax",
    )


def revoke_trusted_device_from_request(request) -> int:
    """Delete DB row for the cookie token, if present. Returns number of rows deleted."""
    raw = get_raw_cookie(request)
    if not raw:
        return 0
    digest = hash_trusted_token(raw)
    deleted, _ = PatientTrustedDevice.objects.filter(token_hash=digest).delete()
    return deleted
