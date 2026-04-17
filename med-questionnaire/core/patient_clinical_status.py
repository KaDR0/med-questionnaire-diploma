"""Derive Patient.status from questionnaires, labs, risk profile, and visit date."""

from __future__ import annotations

from django.utils import timezone

from .models import Assessment, LabResult, Patient, PatientRiskProfile


def _lab_value_abnormal(indicator, value: float) -> bool:
    min_n = indicator.min_norm
    max_n = indicator.max_norm
    if min_n is not None and value < min_n:
        return True
    if max_n is not None and value > max_n:
        return True
    return False


def _latest_lab_abnormal_count(patient_id: int) -> int:
    lr = (
        LabResult.objects.filter(patient_id=patient_id)
        .prefetch_related("values__indicator")
        .order_by("-date", "-id")
        .first()
    )
    if not lr:
        return 0
    return sum(1 for v in lr.values.all() if _lab_value_abnormal(v.indicator, v.value))


def _visit_overdue(patient: Patient) -> bool:
    nv = patient.next_visit_date
    if not nv:
        return False
    return nv < timezone.localdate()


def compute_clinical_status(patient: Patient | int) -> str:
    """Return one of Patient.STATUS_* values."""
    if not isinstance(patient, Patient):
        patient = Patient.objects.get(pk=patient)

    severity = 0  # 0 stable, 1 monitoring, 2 attention, 3 critical

    profile = (
        PatientRiskProfile.objects.filter(patient_id=patient.id)
        .prefetch_related("red_flags")
        .order_by("-created_at")
        .first()
    )

    if profile:
        lvl = (profile.overall_risk_level or "low").lower()
        if lvl == "critical":
            severity = max(severity, 3)
        elif lvl == "high":
            severity = max(severity, 2)
        elif lvl in ("moderate", "elevated"):
            severity = max(severity, 1)

        for rf in profile.red_flags.all():
            u = (rf.urgency_level or "").lower()
            if u == "critical":
                severity = max(severity, 3)
            elif u == "high":
                severity = max(severity, 2)

    asm = Assessment.objects.filter(patient_id=patient.id).order_by("-created_at").first()
    if asm:
        interp = asm.interpretation or {}
        label = (interp.get("label") or "").lower()
        score = int(asm.total_score or 0)
        if label == "high_risk" or score >= 7:
            severity = max(severity, 2)
        elif label == "moderate_risk" or score >= 4:
            severity = max(severity, 1)

    lab_abn = _latest_lab_abnormal_count(patient.id)
    if lab_abn >= 6:
        severity = max(severity, 2)
    elif lab_abn >= 3:
        severity = max(severity, 1)
    elif lab_abn >= 1:
        severity = max(severity, 1)

    visit_overdue = _visit_overdue(patient)
    if visit_overdue:
        severity = min(3, severity + 1)

    has_any_clinical = asm is not None or profile is not None or lab_abn > 0 or visit_overdue
    if not has_any_clinical:
        return Patient.STATUS_MONITORING

    mapping = (
        Patient.STATUS_STABLE,
        Patient.STATUS_MONITORING,
        Patient.STATUS_ATTENTION,
        Patient.STATUS_CRITICAL,
    )
    return mapping[severity]


def refresh_patient_clinical_status(patient_id: int) -> str:
    patient = Patient.objects.get(pk=patient_id)
    new_status = compute_clinical_status(patient)
    if patient.status != new_status:
        patient.status = new_status
        patient.save(update_fields=["status"])
    return new_status
