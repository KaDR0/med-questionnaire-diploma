"""
Stage 3: combined (multi-factor) recommendation rules.

Uses latest lab values and latest collapsed questionnaire assessments.
Produces items with source_type=\"combined\"; singleton suppression avoids repeating the same advice.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Set, Tuple

from .lab_recommendation_engine import (
    _collapse_to_latest_per_coded_analyte,
    _lab_ref_status,
    _latest_lab_map,
)
from .models import Assessment, LabValue, Patient
from .questionnaire_recommendation_engine import (
    _collapse_to_latest_per_screening_source,
    _effective_interpretation,
    _latest_assessment_per_questionnaire,
    _normalize_band,
)


def _patient_bmi(patient: Patient) -> Optional[float]:
    if not patient.height_cm or not patient.weight_kg:
        return None
    h = patient.height_cm / 100.0
    if h <= 0:
        return None
    return round(patient.weight_kg / (h * h), 1)


def _intake_flag(patient: Patient, key: str) -> bool:
    intake = (patient.data or {}).get("intake") or {}
    v = intake.get(key)
    if v is True:
        return True
    if isinstance(v, str) and v.lower() in {"yes", "true", "1"}:
        return True
    return False


def _lv_by_code(labs: List[LabValue], code: str) -> Optional[LabValue]:
    c = code.strip().lower()
    for lv in labs:
        ic = (lv.indicator.code or "").strip().lower()
        if ic == c:
            return lv
    return None


def _assessment_by_target(assessments: List[Assessment], target: str) -> Optional[Assessment]:
    t = target.strip().upper()
    for a in assessments:
        q = a.questionnaire
        dcode = q.disease.code if getattr(q, "disease_id", None) else ""
        tc = (q.target_condition_code or dcode or "").strip().upper()
        if tc == t:
            return a
    return None


def _lab_abnormal(lv: LabValue) -> bool:
    ind = lv.indicator
    return _lab_ref_status(lv.value, ind.min_norm, ind.max_norm) != "normal"


def _combined_item(
    rule_id: str,
    priority: str,
    category: str,
    title: str,
    patient_text: str,
    doctor_text: str,
    trigger_reason: str,
    related_metrics: List[Dict[str, Any]],
    follow_ups: List[str],
    suppress_prefixes: List[str],
) -> Dict[str, Any]:
    return {
        "id": rule_id,
        "source_type": "combined",
        "priority": priority,
        "category": category,
        "title": title,
        "patient_text": patient_text,
        "doctor_text": doctor_text,
        "trigger_reason": trigger_reason,
        "related_metrics": related_metrics,
        "suggested_follow_up": follow_ups,
        "suppresses_singleton_id_prefixes": suppress_prefixes,
    }


def evaluate_combined_rules(patient: Patient) -> Tuple[List[Dict[str, Any]], Set[str]]:
    """
    Returns combined recommendation objects and a set of id prefixes to drop from singleton lab/q items
    (prefix match on recommendation item id).
    """
    lab_map = _latest_lab_map(patient)
    labs = _collapse_to_latest_per_coded_analyte(lab_map)
    per_q = _latest_assessment_per_questionnaire(patient)
    assessments = _collapse_to_latest_per_screening_source(per_q)

    combined: List[Dict[str, Any]] = []
    suppress: Set[str] = set()

    # --- 1) Diabetes questionnaire + glycemic labs ---
    glucose_lv = _lv_by_code(labs, "glucose")
    a1c_lv = _lv_by_code(labs, "hba1c")
    dm = _assessment_by_target(assessments, "T2DM-RISK")
    dm_band = _normalize_band(_effective_interpretation(dm).get("label")) if dm else None
    gly_abn = (glucose_lv and _lab_abnormal(glucose_lv)) or (a1c_lv and _lab_abnormal(a1c_lv))
    if dm and dm_band in ("moderate", "high") and gly_abn:
        pri = "high"
        if glucose_lv and _lab_ref_status(
            glucose_lv.value, glucose_lv.indicator.min_norm, glucose_lv.indicator.max_norm
        ) == "above":
            if glucose_lv.value >= 11.0:
                pri = "urgent"
        metrics = []
        if dm:
            metrics.append(
                {
                    "role": "questionnaire",
                    "target_condition_code": "T2DM-RISK",
                    "assessment_id": dm.pk,
                    "band": dm_band,
                }
            )
        if glucose_lv and _lab_abnormal(glucose_lv):
            metrics.append(
                {
                    "role": "lab",
                    "code": "glucose",
                    "value": glucose_lv.value,
                    "unit": glucose_lv.indicator.unit,
                    "ref_status": _lab_ref_status(
                        glucose_lv.value, glucose_lv.indicator.min_norm, glucose_lv.indicator.max_norm
                    ),
                }
            )
        if a1c_lv and _lab_abnormal(a1c_lv):
            metrics.append(
                {
                    "role": "lab",
                    "code": "hba1c",
                    "value": a1c_lv.value,
                    "unit": a1c_lv.indicator.unit,
                    "ref_status": _lab_ref_status(a1c_lv.value, a1c_lv.indicator.min_norm, a1c_lv.indicator.max_norm),
                }
            )
        combined.append(
            _combined_item(
                rule_id="combo_diabetes_screen_plus_glycemic_lab_v1",
                priority=pri,
                category="metabolic",
                title="Согласованная оценка: риск диабета и лабораторные маркеры",
                patient_text=(
                    "Скрининг риска диабета и результаты анализов глюкозы/HbA1c указывают на согласованный сигнал для "
                    "обсуждения с врачом плана наблюдения и повторного лабораторного контроля. Это не диагноз диабета без критериев врача."
                ),
                doctor_text=(
                    "Aligned diabetes-risk questionnaire band with abnormal fasting glucose and/or HbA1c — prioritize "
                    "metabolic follow-up, lifestyle counseling, and guideline-based confirmatory labs."
                ),
                trigger_reason="combo_diabetes_screen_plus_glycemic_lab",
                related_metrics=metrics,
                follow_ups=[
                    "Согласовать с врачом график HbA1c/гликемии",
                    "Обсудить питание и физическую активность",
                ],
                suppress_prefixes=[
                    "q_t2dm-risk",
                    "lab_glucose_above_ref",
                    "lab_hba1c_above_ref",
                ],
            )
        )
        # Questionnaire ids look like q_t2dm-risk_t2dm_moderate_risk_v1 — prefix must include full target slug.
        suppress.update(["q_t2dm-risk", "lab_glucose_above_ref", "lab_hba1c_above_ref"])

    # --- 2) STOP-Bang high + cardiometabolic context ---
    osa = _assessment_by_target(assessments, "OSA-RISK")
    osa_band = _normalize_band(_effective_interpretation(osa).get("label")) if osa else None
    bmi = _patient_bmi(patient)
    tg_lv = _lv_by_code(labs, "triglycerides")
    ldl_lv = _lv_by_code(labs, "ldl")
    cardio_extra = (
        (bmi is not None and bmi >= 30)
        or (tg_lv and _lab_abnormal(tg_lv))
        or (ldl_lv and _lab_abnormal(ldl_lv))
        or (glucose_lv and _lab_abnormal(glucose_lv))
    )
    if osa and osa_band == "high" and cardio_extra:
        metrics = [
            {
                "role": "questionnaire",
                "target_condition_code": "OSA-RISK",
                "assessment_id": osa.pk,
                "band": osa_band,
            },
            {"role": "patient_metric", "bmi": bmi},
        ]
        if tg_lv and _lab_abnormal(tg_lv):
            metrics.append({"role": "lab", "code": "triglycerides", "value": tg_lv.value})
        if ldl_lv and _lab_abnormal(ldl_lv):
            metrics.append({"role": "lab", "code": "ldl", "value": ldl_lv.value})
        pri = "high"
        if glucose_lv and glucose_lv.value >= 11.0:
            pri = "urgent"
        combined.append(
            _combined_item(
                rule_id="combo_osa_high_plus_cardiometabolic_v1",
                priority=pri,
                category="sleep_metabolic",
                title="Согласованная оценка: высокий риск апноэ сна и кардиометаболические факторы",
                patient_text=(
                    "Результаты скрининга сна и дополнительные факторы (избыточный вес по ИМТ и/или изменения липидов или глюкозы) "
                    "усиливают необходимость обсудить с врачом сон, давление, образ жизни и дальнейший план обследования."
                ),
                doctor_text=(
                    "High OSA screen plus BMI≥30 and/or dyslipidemia or hyperglycemia — integrate sleep evaluation pathways "
                    "with cardiometabolic risk management."
                ),
                trigger_reason="combo_osa_high_plus_cardiometabolic",
                related_metrics=metrics,
                follow_ups=[
                    "Консультация по поводу сна и метаболических факторов",
                    "Контроль АД и липидов по назначению врача",
                ],
                suppress_prefixes=["q_osa-risk", "lab_triglycerides_above_ref", "lab_ldl_above_ref", "lab_glucose_above_ref"],
            )
        )
        suppress.update(["q_osa-risk"])
        if tg_lv and _lab_abnormal(tg_lv):
            suppress.add("lab_triglycerides_above_ref")
        if ldl_lv and _lab_abnormal(ldl_lv):
            suppress.add("lab_ldl_above_ref")
        if glucose_lv and _lab_abnormal(glucose_lv):
            suppress.add("lab_glucose_above_ref")

    # --- 3) FRAIL elevated + nutrition/muscle labs ---
    fr = _assessment_by_target(assessments, "FRAILTY_RISK")
    fr_band = _normalize_band(_effective_interpretation(fr).get("label")) if fr else None
    hb_lv = _lv_by_code(labs, "hemoglobin")
    alb_lv = _lv_by_code(labs, "albumin")
    if fr and fr_band in ("moderate", "high") and (
        (hb_lv and _lab_abnormal(hb_lv)) or (alb_lv and _lab_abnormal(alb_lv)) or _intake_flag(patient, "unintentional_weight_loss")
    ):
        metrics = [
            {
                "role": "questionnaire",
                "target_condition_code": "FRAILTY_RISK",
                "assessment_id": fr.pk,
                "band": fr_band,
            }
        ]
        if hb_lv:
            metrics.append({"role": "lab", "code": "hemoglobin", "value": hb_lv.value})
        if alb_lv:
            metrics.append({"role": "lab", "code": "albumin", "value": alb_lv.value})
        if _intake_flag(patient, "unintentional_weight_loss"):
            metrics.append({"role": "intake", "flag": "unintentional_weight_loss"})
        combined.append(
            _combined_item(
                rule_id="combo_frailty_plus_lab_or_weight_signal_v1",
                priority="high",
                category="frailty",
                title="Согласованная оценка: хрупкость и дополнительные сигналы",
                patient_text=(
                    "Признаки повышенного риска по шкале FRAIL на фоне лабораторных или жалобных сигналов усиливают значимость "
                    "очной оценки питания, мышечной функции и профилактики падений. Диагноз не ставится автоматически."
                ),
                doctor_text=(
                    "FRAIL/pre-frail band with anemia/hypoalbuminemia or documented unintentional weight loss — geriatric-focused "
                    "workup and multidisciplinary prevention."
                ),
                trigger_reason="combo_frailty_plus_lab_or_weight_signal",
                related_metrics=metrics,
                follow_ups=["Очная оценка гериатрических факторов", "План наблюдения за гемоглобином/белком по показаниям"],
                suppress_prefixes=["q_frailty", "lab_hemoglobin_below_ref", "lab_albumin_below_ref"],
            )
        )
        suppress.update(["q_frailty", "lab_hemoglobin_below_ref", "lab_albumin_below_ref"])

    # --- 4) Multiple questionnaire elevated risks (distinct screens) ---
    elevated_codes: List[str] = []
    for a in assessments:
        intr = _effective_interpretation(a)
        band = _normalize_band(intr.get("label"))
        q = a.questionnaire
        tc = (q.target_condition_code or (q.disease.code if q.disease_id else "") or "").strip().upper()
        if tc == "URG-SCR":
            continue
        if band in ("moderate", "high"):
            elevated_codes.append(tc)
    distinct = sorted(set(elevated_codes))
    if len(distinct) >= 2:
        # Drop per-screen singleton rows so the synthesis row does not repeat the same counseling twice.
        mq_suppress = [f"q_{code.strip().lower()}" for code in distinct]
        combined.append(
            _combined_item(
                rule_id="combo_multiple_questionnaire_elevated_v1",
                priority="medium",
                category="integrated_screening",
                title="Несколько скринингов указывают на повышенное внимание",
                patient_text=(
                    "По разным опросникам одновременно выявлены признаки, требующие обсуждения с врачом. "
                    "Это не сумма диагнозов, а сигнал скоординировать заботу о здоровье и приоритеты наблюдения."
                ),
                doctor_text=(
                    f"Multiple screening instruments elevated concurrently: {', '.join(distinct)} — prioritize coordinated "
                    "follow-up rather than isolated scores."
                ),
                trigger_reason="combo_multiple_questionnaire_elevated",
                related_metrics=[{"role": "questionnaire_codes", "codes": distinct}],
                follow_ups=["Сводная консультация по результатам скринингов"],
                suppress_prefixes=mq_suppress,
            )
        )
        suppress.update(mq_suppress)

    # --- 5) High psychological symptom screen + metabolic lab abnormality ---
    dep = _assessment_by_target(assessments, "DEP-SCR")
    anx = _assessment_by_target(assessments, "ANX-SCR")
    dep_hi = dep and _normalize_band(_effective_interpretation(dep).get("label")) == "high"
    anx_hi = anx and _normalize_band(_effective_interpretation(anx).get("label")) == "high"
    metabolic_lab = False
    for code in ("glucose", "hba1c", "triglycerides", "ldl"):
        lv = _lv_by_code(labs, code)
        if lv and _lab_abnormal(lv):
            metabolic_lab = True
            break
    if (dep_hi or anx_hi) and metabolic_lab:
        metrics = []
        if dep_hi:
            metrics.append({"role": "questionnaire", "target_condition_code": "DEP-SCR", "assessment_id": dep.pk})
        if anx_hi:
            metrics.append({"role": "questionnaire", "target_condition_code": "ANX-SCR", "assessment_id": anx.pk})
        combined.append(
            _combined_item(
                rule_id="combo_distress_symptoms_plus_metabolic_lab_v1",
                priority="high",
                category="integrated_mental_metabolic",
                title="Согласованная оценка: выраженная симптоматика и метаболические маркеры",
                patient_text=(
                    "Высокая выраженность симптомов по скринингу настроения/тревоги на фоне отклонений лабораторных маркеров "
                    "усиливает необходимость комплексной очной оценки и координации ухода между специалистами."
                ),
                doctor_text=(
                    "High mood/anxiety screen plus metabolic lab abnormalities — holistic review; exclude organic contributors "
                    "and align mental-health follow-up with metabolic care."
                ),
                trigger_reason="combo_distress_plus_metabolic_lab",
                related_metrics=metrics,
                follow_ups=["Очная оценка при выраженном дискомфорте", "Координация ментального и соматического наблюдения"],
                suppress_prefixes=["q_dep-scr_dep_high", "q_anx-scr_anx_high"],
            )
        )
        if dep_hi:
            suppress.add("q_dep-scr_dep_high")
        if anx_hi:
            suppress.add("q_anx-scr_anx_high")

    return combined, suppress


def _prefix_match(item_id: str, prefixes: Set[str]) -> bool:
    lower = item_id.lower()
    for p in prefixes:
        if lower.startswith(p.lower()):
            return True
    return False
