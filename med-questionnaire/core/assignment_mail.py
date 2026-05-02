"""
Transactional emails for questionnaire assignments.

Uses Django's email stack (same as OTP): DEFAULT_FROM_EMAIL, EMAIL_BACKEND, SMTP settings.
Failures are logged and never propagate — assignment creation always succeeds.
"""

from __future__ import annotations

import logging
import smtplib
import socket
import time

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def _questionnaire_display_title(questionnaire) -> str:
    q = questionnaire
    return (
        (q.title_ru or q.title_en or q.title_kk or q.title or "").strip() or "опросник"
    )


def _resolve_patient_email(patient) -> str:
    """
    Recipient for this assignment — derived only from this Patient row.

    Priority:
    1) Patient.email (clinical / contact email on the card) when non-empty.
    2) Else patient.user.email — only if this patient has a linked login account
       (same Patient.user FK); never staff/doctor/request user emails.

    Wrong-person risk is avoided because we never branch from assignment context:
    only assignment.patient is used.
    """
    raw = (getattr(patient, "email", None) or "").strip()
    if raw:
        return raw.lower()
    # Linked login for this same patient record only (Patient.user).
    user = getattr(patient, "user", None)
    if user is not None:
        u = (getattr(user, "email", None) or "").strip()
        if u:
            return u.lower()
    return ""


def _format_due_line(due_date) -> str:
    if not due_date:
        return (
            "Срок прохождения врач не ограничил — вы можете заполнить опросник, "
            "когда вам будет удобно."
        )
    try:
        return f"Рекомендуемый срок прохождения: {due_date.strftime('%d.%m.%Y')}."
    except Exception:
        return "Уточните срок прохождения вместе с вашим врачом, если нужно."


def _portal_hint() -> str:
    base = getattr(settings, "PATIENT_PORTAL_BASE_URL", "") or ""
    base = str(base).strip().rstrip("/")
    if base:
        return (
            f"Откройте личный кабинет по ссылке: {base}\n"
            "Раздел «Мои опросники» — там будет назначенный опросник."
        )
    return (
        "Зайдите в ваш личный кабинет пациента на сайте клиники "
        "и откройте раздел «Мои опросники»."
    )


def _site_label() -> str:
    return getattr(settings, "EMAIL_SITE_BRAND_NAME", "Med Questionnaire")


def _send_mail_best_effort(recipient: str, subject: str, body: str, *, patient_id, assignment_id) -> None:
    """Two attempts; logs errors; never raises."""
    max_attempts = 2
    for attempt in range(1, max_attempts + 1):
        try:
            send_mail(
                subject=subject,
                message=body,
                from_email=getattr(
                    settings,
                    "DEFAULT_FROM_EMAIL",
                    "no-reply@med-questionnaire.local",
                ),
                recipient_list=[recipient],
                fail_silently=False,
            )
            logger.info(
                "Questionnaire assignment email sent: to=%s patient_id=%s assignment_id=%s attempt=%s",
                recipient,
                patient_id,
                assignment_id,
                attempt,
            )
            return
        except (socket.gaierror, TimeoutError, smtplib.SMTPException, OSError) as exc:
            logger.warning(
                "Questionnaire assignment email transport error: to=%s patient_id=%s assignment_id=%s "
                "attempt=%s/%s error=%s",
                recipient,
                patient_id,
                assignment_id,
                attempt,
                max_attempts,
                exc,
                exc_info=True,
            )
            if attempt < max_attempts:
                time.sleep(0.5)
                continue
            logger.error(
                "Questionnaire assignment email failed after retries: to=%s patient_id=%s assignment_id=%s",
                recipient,
                patient_id,
                assignment_id,
                exc_info=True,
            )
            return
        except Exception as exc:
            logger.exception(
                "Questionnaire assignment email unexpected failure: to=%s patient_id=%s assignment_id=%s error=%s",
                recipient,
                patient_id,
                assignment_id,
                exc,
            )
            return


def send_questionnaire_assignment_notification(assignment) -> None:
    """
    Notify the patient that a questionnaire was assigned.

    Skips when no email on file. Never raises to callers.
    """
    try:
        patient = assignment.patient
        questionnaire = assignment.questionnaire
    except Exception as exc:
        logger.exception(
            "Assignment notification: could not load related objects: assignment_id=%s error=%s",
            getattr(assignment, "pk", None),
            exc,
        )
        return

    recipient = _resolve_patient_email(patient)
    if not recipient:
        logger.info(
            "Questionnaire assignment email skipped (no email): patient_id=%s assignment_id=%s",
            patient.pk,
            assignment.pk,
        )
        return

    title = _questionnaire_display_title(questionnaire)
    due_line = _format_due_line(assignment.due_date)
    portal = _portal_hint()
    brand = _site_label()

    subject = f"Новое назначение — опросник «{title}»"

    body = f"""Здравствуйте!

Врач назначил вам новый опросник: «{title}».

{due_line}

{portal}

Если вы не помните, как войти в личный кабинет, обратитесь в регистратуру или к вашему лечащему врачу.

С уважением,
{brand}
"""

    try:
        _send_mail_best_effort(
            recipient,
            subject,
            body,
            patient_id=patient.pk,
            assignment_id=assignment.pk,
        )
    except Exception as exc:
        logger.exception(
            "Questionnaire assignment notification outer failure assignment_id=%s: %s",
            getattr(assignment, "pk", None),
            exc,
        )
