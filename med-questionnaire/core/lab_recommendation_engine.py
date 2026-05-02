"""
Stage-1 lab-based recommendation layer: structured, non-diagnostic guidance from latest lab values.

Does not modify risk_engine or risk profile generation; intended for separate API consumption.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from django.utils import timezone

from .models import LabValue, Patient


def _lab_ref_status(value: float, min_norm: Optional[float], max_norm: Optional[float]) -> str:
    if min_norm is not None and value < min_norm:
        return "below"
    if max_norm is not None and value > max_norm:
        return "above"
    return "normal"


def _latest_lab_map(patient: Patient) -> Dict[int, LabValue]:
    """Latest LabValue per LabIndicator row (same strategy as risk_engine._latest_lab_map)."""
    lab_map: Dict[int, LabValue] = {}
    latest_values = (
        LabValue.objects.filter(result__patient=patient)
        .select_related("indicator", "result")
        .order_by("indicator_id", "-result__date", "-result__id", "-id")
    )
    for row in latest_values:
        if row.indicator_id in lab_map:
            continue
        lab_map[row.indicator_id] = row
    return lab_map


def _canonical_indicator_key(ind) -> str:
    """One logical lab analyte per non-empty code; otherwise isolate by indicator pk."""
    code = (ind.code or "").strip().lower()
    return code if code else f"_iid:{ind.pk}"


def _labvalue_sample_sort_key(lv: LabValue) -> Tuple:
    """Newest lab collection wins for the same coded analyte (date, then result row, then value row)."""
    r = lv.result
    return (r.date, r.pk, lv.pk)


def _collapse_to_latest_per_coded_analyte(by_indicator_id: Dict[int, LabValue]) -> List[LabValue]:
    """
    If multiple LabIndicator rows share the same `code`, keep only the latest sample among them.
    Prevents duplicate/contradictory recommendations for one analyte (e.g. two «glucose» rows).
    """
    groups: Dict[str, List[LabValue]] = defaultdict(list)
    for lv in by_indicator_id.values():
        groups[_canonical_indicator_key(lv.indicator)].append(lv)
    resolved: List[LabValue] = []
    for group in groups.values():
        resolved.append(max(group, key=_labvalue_sample_sort_key))
    return resolved


def _prepend_latest_value_context_ru(lv: LabValue, body: str) -> str:
    """Tie narrative to the exact latest value & collection date used for the rule."""
    ind = lv.indicator
    if lv.result_id:
        d_str = lv.result.date.strftime("%d.%m.%Y")
        prefix = f"Актуальное значение по последнему загруженному анализу ({d_str}): {lv.value:g} {ind.unit}. "
    else:
        prefix = f"Использовано значение: {lv.value:g} {ind.unit}. "
    return prefix + body


def _dedupe_strings_preserve_order(strings: List[str]) -> List[str]:
    seen = set()
    out: List[str] = []
    for s in strings:
        if s in seen:
            continue
        seen.add(s)
        out.append(s)
    return out


def _metric_snapshot(lv: LabValue) -> Dict[str, Any]:
    ind = lv.indicator
    code = (ind.code or ind.standard_name or ind.name or "").strip() or "unknown"
    status = _lab_ref_status(lv.value, ind.min_norm, ind.max_norm)
    return {
        "code": code,
        "name": ind.standard_name or ind.name,
        "value": lv.value,
        "unit": ind.unit or "",
        "min_norm": ind.min_norm,
        "max_norm": ind.max_norm,
        "ref_status": status,
        "result_date": lv.result.date.isoformat() if lv.result_id else None,
        "indicator_id": ind.pk,
        "lab_result_id": lv.result_id,
        "lab_value_id": lv.pk,
    }


@dataclass
class LabRec:
    rule_id: str
    priority: str  # low | medium | high | urgent
    category: str
    title: str
    patient_text: str
    doctor_text: str
    trigger_reason: str
    related_metrics: List[Dict[str, Any]]
    follow_ups: List[str] = field(default_factory=list)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "id": self.rule_id,
            "source_type": "lab",
            "priority": self.priority,
            "category": self.category,
            "title": self.title,
            "patient_text": self.patient_text,
            "doctor_text": self.doctor_text,
            "trigger_reason": self.trigger_reason,
            "related_metrics": self.related_metrics,
            "suggested_follow_up": self.follow_ups,
        }


def _norm_msgs(lv: LabValue) -> Tuple[str, str]:
    ind = lv.indicator
    ref = []
    if ind.min_norm is not None:
        ref.append(f"{ind.min_norm:g}")
    if ind.max_norm is not None:
        ref.append(f"{ind.max_norm:g}")
    ref_str = "–".join(ref) if ref else "reference"
    patient = (
        f"Показатель «{ind.name}» ({lv.value:g} {ind.unit}, дата анализа {lv.result.date.strftime('%d.%m.%Y')}) "
        f"находится в пределах лабораторной нормы ({ref_str} {ind.unit}). "
        "Это не исключает необходимость очной оценки при симптомах."
    )
    doctor = (
        f"{ind.standard_name or ind.name}: {lv.value:g} {ind.unit}, в пределах заданных референсов "
        f"({ind.min_norm}, {ind.max_norm}), дата: {lv.result.date}."
    )
    return patient, doctor


def _rules_for_glucose(lv: LabValue) -> Optional[LabRec]:
    st = _lab_ref_status(lv.value, lv.indicator.min_norm, lv.indicator.max_norm)
    if st == "normal":
        return None
    m = [_metric_snapshot(lv)]
    v = lv.value
    fu = [
        "Повторить анализ натощак при согласовании с врачом",
        "Обсудить результаты с лечащим врачом",
    ]
    if st == "below":
        return LabRec(
            rule_id="lab_glucose_below_ref_v1",
            priority="medium",
            category="metabolic",
            title="Глюкоза ниже референсного диапазона",
            patient_text=(
                "Значение глюкозы ниже ожидаемого для используемого референса. "
                "При головокружении, слабости или потере сознания не откладывайте обращение за неотложной помощью. "
                "В иных случаях полезно обсудить образ жизни и повтор анализа с врачом."
            ),
            doctor_text=(
                "Glucose below reference range on latest result; correlate with symptoms, medications, and sampling conditions; "
                "consider repeat fasting glucose and clinical review."
            ),
            trigger_reason="glucose_below_reference",
            related_metrics=m,
            follow_ups=fu,
        )
    # above
    if v >= 11.0:
        pri = "urgent"
        pt = (
            "Очень высокое значение глюкозы по сравнению с типичным референсом. "
            "Это требует срочной оценки врачом; при недомогании, рвоте или спутанности сознания — неотложная помощь."
        )
        dt = "Marked hyperglycemia on screening labs — urgent clinical assessment if symptomatic; rule out acute decompensation."
    elif v >= 7.0:
        pri = "high"
        pt = (
            "Глюкоза повышена относительно референса. "
            "Рекомендуется обсудить с врачом питание, физическую активность и план контроля; возможен повтор анализа."
        )
        dt = "Elevated fasting glucose — lifestyle counseling, repeat testing, and clinician follow-up per protocol."
    else:
        pri = "medium"
        pt = (
            "Выявлено повышение глюкозы относительно лабораторного референса. "
            "Полезно проконтролировать питание и активность и обсудить результат с врачом; желателен повтор анализа."
        )
        dt = "Glucose above local reference — reinforce diet/activity, schedule repeat glucose/HbA1c per care pathway."

    return LabRec(
        rule_id="lab_glucose_above_ref_v1",
        priority=pri,
        category="metabolic",
        title="Глюкоза выше референса",
        patient_text=pt,
        doctor_text=dt,
        trigger_reason="glucose_above_reference",
        related_metrics=m,
        follow_ups=fu,
    )


def _rules_for_hba1c(lv: LabValue) -> Optional[LabRec]:
    st = _lab_ref_status(lv.value, lv.indicator.min_norm, lv.indicator.max_norm)
    if st != "above":
        return None
    m = [_metric_snapshot(lv)]
    v = lv.value
    pri = "high" if v >= 6.5 else "medium"
    return LabRec(
        rule_id="lab_hba1c_above_ref_v1",
        priority=pri,
        category="metabolic",
        title="HbA1c выше референса",
        patient_text=(
            "Долгосрочный показатель гликемии (HbA1c) выше лабораторного верхнего референса. "
            "Это сигнал для обсуждения с врачом плана наблюдения и образа жизни; не является сам по себе диагнозом."
        ),
        doctor_text=(
            "HbA1c above laboratory upper limit — align with local diabetes screening pathways; "
            "repeat confirmatory testing and clinical correlation as appropriate."
        ),
        trigger_reason="hba1c_above_reference",
        related_metrics=m,
        follow_ups=[
            "Согласовать с врачом повтор HbA1c/гликемии",
            "Обсудить питание и физическую активность",
        ],
    )


def _rules_for_ldl(lv: LabValue) -> Optional[LabRec]:
    st = _lab_ref_status(lv.value, lv.indicator.min_norm, lv.indicator.max_norm)
    if st != "above":
        return None
    m = [_metric_snapshot(lv)]
    pri = "high" if lv.value > 4.5 else "medium"
    return LabRec(
        rule_id="lab_ldl_above_ref_v1",
        priority=pri,
        category="cardiovascular",
        title="ЛПНП выше целевого референса",
        patient_text=(
            "Холестерин ЛПНП выше указанного референса. "
            "Рекомендуется обсудить с врачом сердечно-сосудистый риск, питание и необходимость повторного липидного профиля."
        ),
        doctor_text=(
            "LDL above configured reference — cardiovascular risk discussion, lifestyle measures, and repeat lipids per guideline."
        ),
        trigger_reason="ldl_above_reference",
        related_metrics=m,
        follow_ups=["Повтор липидного профиля по решению врача", "Коррекция образа жизни по рекомендации специалиста"],
    )


def _rules_for_hdl(lv: LabValue) -> Optional[LabRec]:
    st = _lab_ref_status(lv.value, lv.indicator.min_norm, lv.indicator.max_norm)
    if st != "below":
        return None
    m = [_metric_snapshot(lv)]
    return LabRec(
        rule_id="lab_hdl_below_ref_v1",
        priority="medium",
        category="cardiovascular",
        title="ЛПВП ниже референса",
        patient_text=(
            "ЛПВП ниже референсного диапазона. "
            "Имеет смысл обсудить с врачом привычки питания, активность и общий сердечно-сосудистый риск; возможен повтор анализа."
        ),
        doctor_text="HDL below reference — reinforce lifestyle modification and CV risk review; repeat fasting lipids as indicated.",
        trigger_reason="hdl_below_reference",
        related_metrics=m,
        follow_ups=["Повтор липидов по плану врача"],
    )


def _rules_for_triglycerides(lv: LabValue) -> Optional[LabRec]:
    st = _lab_ref_status(lv.value, lv.indicator.min_norm, lv.indicator.max_norm)
    if st != "above":
        return None
    m = [_metric_snapshot(lv)]
    pri = "high" if lv.value >= 5.6 else "medium"
    return LabRec(
        rule_id="lab_triglycerides_above_ref_v1",
        priority=pri,
        category="cardiovascular",
        title="Триглицериды выше референса",
        patient_text=(
            "Триглицериды превышают лабораторный референс. "
            "Полезно обсудить с врачом питание, алкоголь, физическую активность и повтор анализа на фоне подготовки."
        ),
        doctor_text=(
            "Triglycerides above reference — evaluate secondary causes, alcohol intake, metabolic context; repeat fasting TG."
        ),
        trigger_reason="triglycerides_above_reference",
        related_metrics=m,
        follow_ups=["Повторить анализ натощак при назначении врача"],
    )


def _rules_for_hemoglobin(lv: LabValue) -> Optional[LabRec]:
    st = _lab_ref_status(lv.value, lv.indicator.min_norm, lv.indicator.max_norm)
    if st != "below":
        return None
    m = [_metric_snapshot(lv)]
    return LabRec(
        rule_id="lab_hemoglobin_below_ref_v1",
        priority="medium",
        category="anemia",
        title="Гемоглобин ниже референса",
        patient_text=(
            "Гемоглобин ниже лабораторного референса — возможный сигнал анемии или других состояний. "
            "Рекомендуется обсудить с врачом причину и план обследования; не занимайтесь самолечением железом без назначения."
        ),
        doctor_text=(
            "Hemoglobin below reference — correlate with symptoms, MCV pattern if CBC available, iron studies as indicated."
        ),
        trigger_reason="hemoglobin_below_reference",
        related_metrics=m,
        follow_ups=["Общий анализ крови и консультация врача по показаниям"],
    )


def _rules_for_transaminase(lv: LabValue, kind: str) -> Optional[LabRec]:
    st = _lab_ref_status(lv.value, lv.indicator.min_norm, lv.indicator.max_norm)
    if st != "above":
        return None
    m = [_metric_snapshot(lv)]
    v = lv.value
    max_ref = lv.indicator.max_norm or 40.0
    pri = "high" if v >= 3 * max_ref else "medium"
    title = "АЛТ выше референса" if kind == "alt" else "АСТ выше референса"
    return LabRec(
        rule_id=f"lab_{kind}_above_ref_v1",
        priority=pri,
        category="hepatic",
        title=title,
        patient_text=(
            "Показатель печёночных ферментов выше референса. "
            "Имеет смысл обсудить с врачом приём лекарств, алкоголь и повтор анализа; при выраженном недомогании — неотложная помощь."
        ),
        doctor_text=(
            f"{kind.upper()} elevation — review hepatotoxic meds/alcohol, repeat LFTs, metabolic screen if persistent elevation."
        ),
        trigger_reason=f"{kind}_above_reference",
        related_metrics=m,
        follow_ups=["Повтор ЛФТ по назначению врача", "Исключить гепатотоксичные факторы"],
    )


def _rules_for_creatinine(lv: LabValue) -> Optional[LabRec]:
    st = _lab_ref_status(lv.value, lv.indicator.min_norm, lv.indicator.max_norm)
    if st != "above":
        return None
    m = [_metric_snapshot(lv)]
    max_ref = lv.indicator.max_norm or 104.0
    pri = "high" if lv.value >= 1.5 * max_ref else "medium"
    return LabRec(
        rule_id="lab_creatinine_above_ref_v1",
        priority=pri,
        category="renal",
        title="Креатинин выше референса",
        patient_text=(
            "Креатинин выше лабораторного референса — сигнал проверить функцию почек и приём нефротоксичных препаратов. "
            "Обсудите с врачом повтор анализа и дальнейший план; избегайте самоназначения диуретиков и НПВС без консультации."
        ),
        doctor_text=(
            "Creatinine above reference — assess renal function trend, medications, volume status; repeat renal panel as indicated."
        ),
        trigger_reason="creatinine_above_reference",
        related_metrics=m,
        follow_ups=["Контроль функции почек по назначению врача"],
    )


def _rules_for_total_cholesterol(lv: LabValue) -> Optional[LabRec]:
    st = _lab_ref_status(lv.value, lv.indicator.min_norm, lv.indicator.max_norm)
    if st != "above":
        return None
    m = [_metric_snapshot(lv)]
    return LabRec(
        rule_id="lab_total_cholesterol_above_ref_v1",
        priority="medium",
        category="cardiovascular",
        title="Общий холестерин выше референса",
        patient_text=(
            "Общий холестерин выше указанного референса. "
            "Рекомендуется обсудить с врачом липидный профиль, питание и повтор анализа после подготовки."
        ),
        doctor_text="Total cholesterol above reference — contextualize with full lipid panel and ASCVD risk discussion.",
        trigger_reason="total_cholesterol_above_reference",
        related_metrics=m,
        follow_ups=["Полный липидный профиль по решению врача"],
    )


def _rules_for_albumin(lv: LabValue) -> Optional[LabRec]:
    st = _lab_ref_status(lv.value, lv.indicator.min_norm, lv.indicator.max_norm)
    if st != "below":
        return None
    m = [_metric_snapshot(lv)]
    return LabRec(
        rule_id="lab_albumin_below_ref_v1",
        priority="medium",
        category="other",
        title="Альбумин ниже референса",
        patient_text=(
            "Альбумин ниже референса — возможный сигнал недостаточного питания, воспаления или других состояний. "
            "Обсудите с врачом питание и причины; не начинайте самостоятельно высокие дозы белка без консультации."
        ),
        doctor_text=(
            "Hypoalbuminemia pattern — consider nutrition, inflammation, hepatic/renal context; targeted workup per clinical picture."
        ),
        trigger_reason="albumin_below_reference",
        related_metrics=m,
        follow_ups=["Оценка питания и повтор белковых показателей по назначению"],
    )


RULE_DISPATCH = {
    "glucose": _rules_for_glucose,
    "hba1c": _rules_for_hba1c,
    "ldl": _rules_for_ldl,
    "hdl": _rules_for_hdl,
    "triglycerides": _rules_for_triglycerides,
    "hemoglobin": _rules_for_hemoglobin,
    "creatinine": _rules_for_creatinine,
    "total_cholesterol": _rules_for_total_cholesterol,
    "albumin": _rules_for_albumin,
}


def _dispatch_by_code(code: str, lv: LabValue) -> Optional[LabRec]:
    key = (code or "").strip().lower()
    if key == "alt":
        return _rules_for_transaminase(lv, "alt")
    if key == "ast":
        return _rules_for_transaminase(lv, "ast")
    fn = RULE_DISPATCH.get(key)
    if not fn:
        return None
    return fn(lv)


def _priority_rank(p: str) -> int:
    return {"urgent": 0, "high": 1, "medium": 2, "low": 3}.get(p, 4)


def build_lab_recommendation_bundle(patient: Patient) -> Dict[str, Any]:
    """
    Returns structured lab recommendations + grouped sections for UI layers.

    Non-diagnostic language only. Uses latest sample per LabIndicator row, then one row per coded analyte
    (newest collection wins when duplicate indicator definitions share the same code).
    """
    generated_at = timezone.now()
    lab_map = _latest_lab_map(patient)
    sorted_vals = sorted(
        _collapse_to_latest_per_coded_analyte(lab_map),
        key=lambda x: (x.indicator.name or "").lower(),
    )
    items_out: List[Dict[str, Any]] = []
    what_is_normal: List[str] = []
    attention_points: List[str] = []
    patient_recs: List[str] = []
    doctor_recs: List[str] = []
    follow_up_all: List[str] = []

    if not lab_map:
        return {
            "version": 1,
            "source": "lab_recommendation_engine",
            "generated_at": generated_at.isoformat(),
            "patient_id": patient.id,
            "note": "Нет загруженных лабораторных результатов для формирования рекомендаций.",
            "items": [],
            "what_is_normal": [],
            "attention_points": [],
            "patient_recommendations": [],
            "doctor_recommendations": [],
            "follow_up_actions": [],
        }

    for lv in sorted_vals:
        ind = lv.indicator
        code = (ind.code or "").strip().lower()
        status = _lab_ref_status(lv.value, ind.min_norm, ind.max_norm)

        if status == "normal":
            pn, _ = _norm_msgs(lv)
            what_is_normal.append(pn)
            continue

        rec = _dispatch_by_code(code, lv)
        if rec is None:
            # Unknown indicator but abnormal vs ref: generic cautious signal
            m = [_metric_snapshot(lv)]
            generic = LabRec(
                rule_id=f"lab_generic_abnormal_i{ind.id}",
                priority="low",
                category=ind.category or "other",
                title=f"Отклонение: {ind.name}",
                patient_text=(
                    f"Показатель «{ind.name}» выходит за пределы заданного референса в системе. "
                    "Рекомендуется обсудить результат с лечащим врачом и при необходимости повторить анализ."
                ),
                doctor_text=(
                    f"{ind.standard_name or ind.name} outside configured reference on {lv.result.date}: "
                    f"{lv.value:g} {ind.unit}; clinical correlation and repeat testing as appropriate."
                ),
                trigger_reason="unknown_indicator_out_of_range",
                related_metrics=m,
                follow_ups=["Клиническая корреляция и повтор анализа по показаниям"],
            )
            rec = generic

        d = rec.as_dict()
        d["patient_text"] = _prepend_latest_value_context_ru(lv, rec.patient_text)
        if lv.result_id:
            d["doctor_text"] = (
                f"Latest sample {lv.result.date.isoformat()}: {lv.value:g} {lv.indicator.unit}. {rec.doctor_text}"
            )
        items_out.append(d)
        attention_points.append(rec.title + ": " + rec.trigger_reason)
        patient_recs.append(d["patient_text"])
        doctor_recs.append(d["doctor_text"])
        follow_up_all.extend(rec.follow_ups)

    items_out.sort(key=lambda x: (_priority_rank(x.get("priority", "low")), x.get("id", "")))

    follow_deduped = _dedupe_strings_preserve_order(follow_up_all)
    patient_recs = _dedupe_strings_preserve_order(patient_recs)
    doctor_recs = _dedupe_strings_preserve_order(doctor_recs)
    attention_points = _dedupe_strings_preserve_order(attention_points)

    return {
        "version": 1,
        "source": "lab_recommendation_engine",
        "generated_at": generated_at.isoformat(),
        "patient_id": patient.id,
        "note": None,
        "items": items_out,
        "what_is_normal": what_is_normal,
        "attention_points": attention_points,
        "patient_recommendations": patient_recs,
        "doctor_recommendations": doctor_recs,
        "follow_up_actions": follow_deduped,
    }
