"""
Questionnaire-based recommendation layer (stage 2): structured guidance from latest assessments.

Uses the same item shape as lab_recommendation_engine (source_type distinguishes origin).
Non-diagnostic language only.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from django.utils import timezone

from .models import Assessment, Patient, Question, Questionnaire
from .services import _interpret_from_schema


def _priority_rank(p: str) -> int:
    return {"urgent": 0, "high": 1, "medium": 2, "low": 3}.get(p, 4)


def _dedupe_strings_preserve_order(strings: List[str]) -> List[str]:
    seen = set()
    out: List[str] = []
    for s in strings:
        if s in seen:
            continue
        seen.add(s)
        out.append(s)
    return out


def _compute_max_score(questionnaire: Questionnaire) -> int:
    total = 0
    for question in Question.objects.filter(questionnaire=questionnaire).order_by("order"):
        if question.qtype == Question.YESNO:
            total += max(question.score_yes, question.score_no)
        elif question.qtype == Question.SINGLE_CHOICE:
            options = question.options or []
            max_opt = 0
            for option in options:
                try:
                    max_opt = max(max_opt, int(option.get("score", 0)))
                except (TypeError, ValueError):
                    continue
            total += max_opt
    return total


def _latest_assessment_per_questionnaire(patient: Patient) -> Dict[int, Assessment]:
    """Most recent assessment per Questionnaire row (created_at, then pk)."""
    seen: Dict[int, Assessment] = {}
    qs = (
        Assessment.objects.filter(patient=patient)
        .select_related("questionnaire", "questionnaire__disease")
        .order_by("questionnaire_id", "-created_at", "-pk")
    )
    for row in qs:
        if row.questionnaire_id in seen:
            continue
        seen[row.questionnaire_id] = row
    return seen


def _canonical_source_key(assessment: Assessment) -> str:
    """
    Logical screening source for deduplication: target_condition_code (or disease code),
    or fall back to questionnaire pk when codes are blank.
    """
    q = assessment.questionnaire
    disease_code = q.disease.code if getattr(q, "disease_id", None) else ""
    code = (q.target_condition_code or disease_code or "").strip().upper()
    return code if code else f"_qid:{q.pk}"


def _assessment_recency_key(assessment: Assessment) -> Tuple:
    """Newer assessment wins; tie-break by pk."""
    return (assessment.created_at, assessment.pk)


def _collapse_to_latest_per_screening_source(by_questionnaire: Dict[int, Assessment]) -> List[Assessment]:
    """
    If several Questionnaire rows share the same target/disease code (e.g. two OSA-RISK versions),
    keep only the latest Assessment among them so one screening type yields one recommendation.
    """
    groups: Dict[str, List[Assessment]] = defaultdict(list)
    for a in by_questionnaire.values():
        groups[_canonical_source_key(a)].append(a)
    resolved: List[Assessment] = []
    for group in groups.values():
        resolved.append(max(group, key=_assessment_recency_key))
    return resolved


def _normalize_band(label: Optional[str]) -> str:
    """Map questionnaire interpretation labels to coarse bands."""
    if not label:
        return "unknown"
    l = str(label).strip().lower()
    mapping = {
        "low_risk": "low",
        "low_frailty_risk": "low",
        "low": "low",
        "moderate_risk": "moderate",
        "moderate": "moderate",
        "pre_frailty": "moderate",
        "pre-frailty": "moderate",
        "intermediate": "moderate",
        "high_risk": "high",
        "high": "high",
        "frailty_high": "high",
    }
    return mapping.get(l, l)


def _effective_interpretation(assessment: Assessment) -> Dict[str, Any]:
    data = assessment.interpretation if isinstance(assessment.interpretation, dict) else {}
    if data.get("label"):
        return data
    q = assessment.questionnaire
    max_score = _compute_max_score(q)
    return _interpret_from_schema(
        assessment.total_score,
        max_score,
        assessment.completion_percent or 0,
        q,
    )


@dataclass
class QuestionnaireRec:
    rule_id: str
    priority: str
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
            "source_type": "questionnaire",
            "priority": self.priority,
            "category": self.category,
            "title": self.title,
            "patient_text": self.patient_text,
            "doctor_text": self.doctor_text,
            "trigger_reason": self.trigger_reason,
            "related_metrics": self.related_metrics,
            "suggested_follow_up": self.follow_ups,
        }


def _metric_block(
    assessment: Assessment,
    target_code: str,
    band: str,
    max_score: int,
    intr: Dict[str, Any],
) -> Dict[str, Any]:
    q = assessment.questionnaire
    return {
        "assessment_id": assessment.pk,
        "questionnaire_id": q.pk,
        "target_condition_code": target_code,
        "risk_band": intr.get("label") or band,
        "risk_band_normalized": band,
        "total_score": assessment.total_score,
        "max_score": max_score,
        "completion_percent": assessment.completion_percent,
        "quality_flag": assessment.quality_flag,
        "assessment_date": assessment.created_at.isoformat() if assessment.created_at else None,
        "questionnaire_title": q.title_ru or q.title_en or q.title or "",
        "questionnaire_version": getattr(q, "version", "") or "",
    }


def _prepend_assessment_context_ru(assessment: Assessment, max_score: int, body: str) -> str:
    d_str = assessment.created_at.strftime("%d.%m.%Y") if assessment.created_at else ""
    q = assessment.questionnaire
    prefix = (
        f"По актуальному результату опросника (запись оценки №{assessment.pk}, опросник №{q.pk}, "
        f"{d_str}), сумма баллов {assessment.total_score}"
        f"{f' из {max_score}' if max_score else ''}: "
    )
    return prefix + body


def _prepend_doctor_assessment_evidence(assessment: Assessment, max_score: int, body: str) -> str:
    q = assessment.questionnaire
    ts = assessment.created_at.isoformat() if assessment.created_at else ""
    score_part = f"{assessment.total_score}/{max_score}" if max_score else str(assessment.total_score)
    prefix = (
        f"Latest assessment id={assessment.pk}, questionnaire id={q.pk}, created_at={ts}, score={score_part}. "
    )
    return prefix + body


# --- Rule bodies: (patient_ru, doctor_en, priority, category, title_ru, trigger_suffix, follow_ups)
RuleParts = Tuple[str, str, str, str, str, str, List[str]]

QUESTIONNAIRE_RULES: Dict[str, Dict[str, RuleParts]] = {
    "OSA-RISK": {
        "low": (
            "при текущих ответах риск обструктивного апноэ сна оценивается как низкий. "
            "Имеет смысл сохранять здоровые привычки сна и сообщать врачу о новой храпе, дневной сонливости или остановках дыхания.",
            "STOP-Bang–style screen: low interpreted risk for OSA; reinforce sleep hygiene and report new snoring, daytime sleepiness, or witnessed apneas.",
            "low",
            "sleep",
            "Скрининг апноэ сна: низкий уровень риска",
            "osa_low_risk",
            ["При появлении дневной сонливости или храпа обсудить с врачом"],
        ),
        "moderate": (
            "выявлены признаки промежуточного риска расстройств дыхания во сне. "
            "Рекомендуется обсудить с врачом необходимость дополнительной оценки (в том числе при храпе, сонливости, повышенном давлении).",
            "Intermediate OSA risk on screening questionnaire — discuss clinical correlation, blood pressure, and possible sleep evaluation.",
            "medium",
            "sleep",
            "Скрининг апноэ сна: умеренный риск",
            "osa_moderate_risk",
            ["Запись к лечащему врачу для обсуждения сна и возможной направительной диагностики"],
        ),
        "high": (
            "выявлены признаки повышенного риска нарушений дыхания во сне. "
            "Желательно обсудить результаты с врачом и возможность дальнейшей оценки сна; это не постановка диагноза без исследований.",
            "High OSA risk on validated screen — recommend physician discussion and pathway-appropriate sleep evaluation; diagnosis requires clinical/lab confirmation.",
            "high",
            "sleep",
            "Скрининг апноэ сна: повышенный риск",
            "osa_high_risk",
            [
                "Консультация врача по поводу сна и сердечно-сосудистых факторов",
                "Не игнорировать дневную сонливость при управлении транспортом",
            ],
        ),
    },
    "T2DM-RISK": {
        "low": (
            "по ответам скрининг показывает относительно низкий уровень модифицируемых факторов риска диабета 2 типа на данный момент. "
            "Полезно сохранять активность, контроль массы тела и периодический контроль у лечащего врача.",
            "Low interpreted diabetes risk on structured questionnaire — reinforce prevention and periodic review.",
            "low",
            "metabolic",
            "Скрининг риска диабета 2 типа: низкий уровень",
            "t2dm_low_risk",
            ["Профилактический осмотр и образ жизни по совету врача"],
        ),
        "moderate": (
            "выявлены признаки умеренного риска, связанного с факторами, влияющими на углеводный обмен. "
            "Рекомендуется обсудить с врачом питание, активность и целесообразность лабораторного контроля (по решению врача).",
            "Moderate diabetes risk factors on screen — lifestyle counseling and clinician-guided metabolic/laboratory follow-up.",
            "medium",
            "metabolic",
            "Скрининг риска диабета 2 типа: умеренный риск",
            "t2dm_moderate_risk",
            ["Обсудить с врачом график наблюдения и лабораторный контроль"],
        ),
        "high": (
            "выявлены признаки повышенного риска по ответам скрининга; диагноз диабета не выставляется без лабораторных критериев. "
            "Рекомендуется обсудить с врачом контроль глюкозы/HbA1c и план наблюдения.",
            "High interpreted diabetes risk on questionnaire — pursue clinician review and guideline-based laboratory screening; not a standalone diagnosis.",
            "high",
            "metabolic",
            "Скрининг риска диабета 2 типа: повышенный риск",
            "t2dm_high_risk",
            ["Консультация врача и лабораторная оценка по назначению"],
        ),
    },
    "FRAILTY_RISK": {
        "low": (
            "по шкале FRAIL выраженных признаков хрупкости не выявлено. "
            "Имеет смысл поддерживать активность, питание и сообщать врачу о слабости, страхе падений или похудении.",
            "FRAIL scale: low frailty risk — reinforce activity, nutrition, report weight loss or falls.",
            "low",
            "frailty",
            "FRAIL: низкий риск",
            "frail_low_risk",
            ["Продолжать профилактику падений и физическую активность"],
        ),
        "moderate": (
            "выявлены признаки промежуточного состояния (pre-frailty), требующего внимания. "
            "Рекомендуется оценка физической функции, питания и профилактики падений с лечащим врачом.",
            "Pre-frailty pattern on FRAIL — multidisciplinary prevention: mobility, nutrition, falls risk, follow-up.",
            "medium",
            "frailty",
            "FRAIL: умеренный риск (pre-frailty)",
            "frail_pre_frailty",
            ["Обсудить с врачом программу активности и безопасность передвижения"],
        ),
        "high": (
            "по ответам выявлены признаки повышенного риска синдрома хрупкости; диагноз не ставится без клинической оценки. "
            "Рекомендуется комплексная оценка у врача, поддержка питания, контроль сопутствующих состояний и падений.",
            "High frailty risk on FRAIL screen — comprehensive geriatric assessment; diagnosis remains clinical.",
            "high",
            "frailty",
            "FRAIL: высокий риск",
            "frail_high_risk",
            ["Очная оценка гериатрических факторов и плана реабилитации по назначению врача"],
        ),
    },
    "SARCOPENIA_RISK": {
        "low": (
            "по опроснику SARC-F выраженных признаков высокого риска не выявлено. "
            "Полезно сохранять силовую нагрузку и белок в рационе; при слабости или падениях — сообщить врачу.",
            "SARC-F: low interpreted sarcopenia risk — maintain resistance training and protein intake.",
            "low",
            "muscle",
            "SARC-F: низкий риск",
            "sarc_f_low_risk",
            ["Продолжать физическую активность силового характера"],
        ),
        "moderate": (
            "промежуточная зона для данного опросника не задана; при умеренной сумме баллов всё равно рекомендуется обсудить с врачом нагрузку и мышечную функцию.",
            "Intermediate band not defined for this questionnaire version — still correlate clinically.",
            "medium",
            "muscle",
            "SARC-F: дополнительная оценка",
            "sarc_f_intermediate_placeholder",
            ["Обсудить мышечную силу и падения с врачом"],
        ),
        "high": (
            "выявлены признаки повышенного риска по SARC-F; диагноз саркопении требует подтверждения врачом и при необходимости функциональных тестов. "
            "Рекомендуется обсудить программу упражнений, белок и оценку падений.",
            "SARC-F suggests elevated sarcopenia risk — confirm clinically; exercise and nutrition counseling.",
            "high",
            "muscle",
            "SARC-F: повышенный риск",
            "sarc_f_high_risk",
            ["Направление на оценку мышечной функции по показаниям"],
        ),
    },
    "DEP-SCR": {
        "low": (
            "выраженность симптомов по ответам скрининга оценивается как относительно низкая. "
            "При ухудшении настроения или появлении мыслей о самоповреждении обратитесь за неотложной помощью или к специалисту.",
            "PHQ-style screen: lower symptom burden — safety net for worsening mood or self-harm ideation.",
            "low",
            "mental_health",
            "Скрининг депрессивных симптомов: низкая выраженность",
            "dep_low_risk",
            ["Не откладывать обращение при ухудшении состояния"],
        ),
        "moderate": (
            "выявлены признаки умеренной выраженности симптомов на скрининге; это не диагноз. "
            "Рекомендуется обсудить результаты с врачом и при необходимости направление к специалисту по плану помощи.",
            "Moderate depressive symptom score on screening — clinical follow-up and reassessment.",
            "medium",
            "mental_health",
            "Скрининг депрессивных симптомов: умеренная выраженность",
            "dep_moderate_risk",
            ["Запись к врачу для очной оценки и обсуждения поддержки"],
        ),
        "high": (
            "на скрининге отмечена высокая выраженность симптомов; диагноз не выставляется без очной оценки. "
            "Рекомендуется не откладывать консультацию с врачом; при мыслях о самоповреждении — немедленная помощь.",
            "High symptom burden on depression screen — urgent clinical evaluation pathway; not a substitute for diagnosis.",
            "high",
            "mental_health",
            "Скрининг депрессивных симптомов: высокая выраженность",
            "dep_high_risk",
            ["Срочная очная оценка при угрозе себе или другим — по клиническим показаниям"],
        ),
    },
    "ANX-SCR": {
        "low": (
            "по ответам скрининг тревожных симптомов указывает на относительно низкую выраженность. "
            "При нарастании тревоги, паники или нарушений сна полезно обсудить это с врачом.",
            "GAD-style anxiety screen: lower burden — monitor and reassess if symptoms escalate.",
            "low",
            "mental_health",
            "Скрининг тревожности: низкая выраженность",
            "anx_low_risk",
            ["Обратиться к врачу при стойком ухудшении"],
        ),
        "moderate": (
            "выявлены признаки умеренной выраженности тревожных симптомов на скрининге. "
            "Рекомендуется обсудить стратегии самопомощи и профессиональную поддержку с лечащим врачом.",
            "Moderate anxiety symptom score — follow-up and evidence-based interventions per clinician.",
            "medium",
            "mental_health",
            "Скрининг тревожности: умеренная выраженность",
            "anx_moderate_risk",
            ["План наблюдения с врачом или ментальным специалистом"],
        ),
        "high": (
            "на скрининге отмечена высокая выраженность тревожных симптомов; диагноз не подтверждён формой. "
            "Рекомендуется очная оценка и обсуждение терапии с врачом.",
            "High anxiety burden on screen — prioritize clinical assessment.",
            "high",
            "mental_health",
            "Скрининг тревожности: высокая выраженность",
            "anx_high_risk",
            ["Запись на очную консультацию без промедления при выраженном страдании"],
        ),
    },
    "URG-SCR": {
        "low": (
            "по данной форме срочные «красные флаги» не отмечены. Это не исключает очную оценку при появлении новых симптомов.",
            "Urgent triage form: no affirmative red flags on this submission — still seek care for new concerning symptoms.",
            "low",
            "urgent_triage",
            "Срочные симптомы: без отмеченных триаж-сигналов",
            "urg_scr_low",
            ["При появлении новых тревожных симптомов обратиться за помощью"],
        ),
        "moderate": (
            "промежуточный уровень для данного триажа не используется.",
            "Not used for URG-SCR.",
            "medium",
            "urgent_triage",
            "Срочные симптомы",
            "urg_scr_moderate_unused",
            [],
        ),
        "high": (
            "в форме отмечены потенциально серьёзные симптомы. Это не замена очной оценке; при угрозе жизни вызывайте скорую помощь.",
            "Affirmative red-flag responses on triage questionnaire — immediate in-person or emergency evaluation per severity.",
            "urgent",
            "urgent_triage",
            "Срочные симптомы: нужна клиническая оценка",
            "urg_scr_high_risk",
            ["Немедленная очная/неотложная помощь при угрожающих симптомах"],
        ),
    },
}


def _pick_rule(
    target_code: str,
    band: str,
) -> Optional[RuleParts]:
    code = (target_code or "").strip().upper()
    # Seed uses FRAILTY_RISK
    rules_for = QUESTIONNAIRE_RULES.get(code)
    if not rules_for:
        return None
    return rules_for.get(band)


def _fallback_rule(
    assessment: Assessment,
    intr: Dict[str, Any],
    band: str,
    max_score: int,
    target_code: str,
) -> QuestionnaireRec:
    title = intr.get("title") or "Результат опросника"
    rec_body = intr.get("recommendation") or "Обсудите результаты с лечащим врачом."
    patient_plain = (
        f"По опроснику зафиксирован результат «{title}». "
        f"{rec_body} Это скрининговая информация, а не диагноз."
    )
    patient = _prepend_assessment_context_ru(assessment, max_score, patient_plain)
    doctor = _prepend_doctor_assessment_evidence(
        assessment,
        max_score,
        (
            f"Generic rule: screen ({target_code}) band={band}. "
            f"{intr.get('recommendation', '')}"
        ),
    )
    pri = "medium"
    if band == "high":
        pri = "high"
    elif band == "low":
        pri = "low"
    return QuestionnaireRec(
        rule_id=f"q_generic_{target_code.lower()}_{band}_v1",
        priority=pri,
        category="other",
        title=title[:120],
        patient_text=patient,
        doctor_text=doctor,
        trigger_reason=f"questionnaire_{band}_generic",
        related_metrics=[_metric_block(assessment, target_code, band, max_score, intr)],
        follow_ups=["Клиническая корреляция по результатам опросника"],
    )


def _build_one_recommendation(assessment: Assessment) -> Optional[QuestionnaireRec]:
    q = assessment.questionnaire
    disease_code = q.disease.code if getattr(q, "disease_id", None) else ""
    target_code = (q.target_condition_code or disease_code or "").strip().upper()
    intr = _effective_interpretation(assessment)
    raw_label = intr.get("label") or ""
    band = _normalize_band(raw_label)

    max_score = _compute_max_score(q)
    if assessment.completion_percent < q.min_completion_percent:
        inc_body = (
            "Часть вопросов осталась без ответа; интерпретация ограничена. "
            "Желательно при возможности повторить опросник или обсудить пропуски с координатором/врачом."
        )
        return QuestionnaireRec(
            rule_id=f"q_incomplete_{q.pk}_{assessment.pk}_v1",
            priority="low",
            category="other",
            title="Опросник заполнен не полностью",
            patient_text=_prepend_assessment_context_ru(assessment, max_score, inc_body),
            doctor_text=_prepend_doctor_assessment_evidence(
                assessment,
                max_score,
                (
                    f"Incomplete submission: completion {assessment.completion_percent}% "
                    f"< required {q.min_completion_percent}% — interpret with caution."
                ),
            ),
            trigger_reason="questionnaire_incomplete",
            related_metrics=[_metric_block(assessment, target_code, "incomplete", max_score, intr)],
            follow_ups=["Повторить опросник или дополнить ответы по возможности"],
        )

    parts = _pick_rule(target_code, band)
    if parts is None and target_code == "SARCOPENIA_RISK" and band == "moderate":
        parts = QUESTIONNAIRE_RULES["SARCOPENIA_RISK"]["moderate"]
    if parts is None:
        rec = _fallback_rule(assessment, intr, band, max_score, target_code)
        return rec

    patient_body, doctor_body, pri, category, title, trig_suffix, fus = parts
    rule_id = f"q_{target_code.lower()}_{trig_suffix}_v1"

    return QuestionnaireRec(
        rule_id=rule_id,
        priority=pri,
        category=category,
        title=title,
        patient_text=_prepend_assessment_context_ru(assessment, max_score, patient_body),
        doctor_text=_prepend_doctor_assessment_evidence(assessment, max_score, doctor_body),
        trigger_reason=trig_suffix,
        related_metrics=[_metric_block(assessment, target_code, band, max_score, intr)],
        follow_ups=fus,
    )


def build_questionnaire_recommendation_bundle(patient: Patient) -> Dict[str, Any]:
    generated_at = timezone.now()
    per_q = _latest_assessment_per_questionnaire(patient)
    items_out: List[Dict[str, Any]] = []
    what_normal: List[str] = []
    attention: List[str] = []
    patient_recs: List[str] = []
    doctor_recs: List[str] = []
    follow_all: List[str] = []

    if not per_q:
        return {
            "version": 1,
            "source": "questionnaire_recommendation_engine",
            "generated_at": generated_at.isoformat(),
            "patient_id": patient.id,
            "note": "Нет сохранённых опросников для генерации рекомендаций.",
            "items": [],
            "what_is_normal": [],
            "attention_points": [],
            "patient_recommendations": [],
            "doctor_recommendations": [],
            "follow_up_actions": [],
        }

    assessments_use = _collapse_to_latest_per_screening_source(per_q)
    for assessment in sorted(assessments_use, key=lambda a: (a.questionnaire.title or "").lower()):
        rec_obj = _build_one_recommendation(assessment)
        if rec_obj is None:
            continue
        d = rec_obj.as_dict()
        items_out.append(d)

        if rec_obj.trigger_reason == "questionnaire_incomplete":
            attention.append(f"{rec_obj.title}: требуется более полное заполнение")
        elif rec_obj.priority == "low":
            what_normal.append(d["patient_text"])
        else:
            attention.append(f"{rec_obj.title}: {rec_obj.trigger_reason}")

        patient_recs.append(d["patient_text"])
        doctor_recs.append(d["doctor_text"])
        follow_all.extend(rec_obj.follow_ups)

    items_out.sort(key=lambda x: (_priority_rank(x.get("priority", "low")), x.get("id", "")))

    return {
        "version": 1,
        "source": "questionnaire_recommendation_engine",
        "generated_at": generated_at.isoformat(),
        "patient_id": patient.id,
        "note": None,
        "items": items_out,
        "what_is_normal": _dedupe_strings_preserve_order(what_normal),
        "attention_points": _dedupe_strings_preserve_order(attention),
        "patient_recommendations": _dedupe_strings_preserve_order(patient_recs),
        "doctor_recommendations": _dedupe_strings_preserve_order(doctor_recs),
        "follow_up_actions": _dedupe_strings_preserve_order(follow_all),
    }
