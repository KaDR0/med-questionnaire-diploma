"""
Integrated patient recommendation bundle (labs + questionnaires + combined rules).

`/patients/<id>/lab-recommendations/` stays lab-only; `GET /patients/<id>/recommendations/` returns this payload (version 3).
"""

from __future__ import annotations

from typing import Any, Dict, List, Set, Tuple

from django.utils import timezone

from .combined_recommendation_engine import evaluate_combined_rules, _prefix_match
from .lab_recommendation_engine import (
    _dedupe_strings_preserve_order,
    _priority_rank,
    build_lab_recommendation_bundle,
)
from .models import Patient
from .questionnaire_recommendation_engine import build_questionnaire_recommendation_bundle


def _merge_notes(lab_bundle: Dict[str, Any], q_bundle: Dict[str, Any]) -> Any:
    if lab_bundle.get("items") or q_bundle.get("items"):
        return None
    parts = []
    if lab_bundle.get("note"):
        parts.append(lab_bundle["note"])
    if q_bundle.get("note"):
        parts.append(q_bundle["note"])
    return " ".join(parts) if parts else None


def _filter_singleton_items(items: List[Dict[str, Any]], suppress_prefixes: Set[str]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for it in items:
        iid = it.get("id") or ""
        if it.get("source_type") in ("lab", "questionnaire") and _prefix_match(iid, suppress_prefixes):
            continue
        out.append(it)
    return out


def _strip_combined_internal_fields(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    cleaned = []
    for it in items:
        cleaned.append({k: v for k, v in it.items() if k != "suppresses_singleton_id_prefixes"})
    return cleaned


def _follow_ups_from_items(items: List[Dict[str, Any]]) -> List[str]:
    acc: List[str] = []
    for it in items:
        acc.extend(it.get("suggested_follow_up") or [])
    return _dedupe_strings_preserve_order(acc)


def _attention_from_items(items: List[Dict[str, Any]]) -> List[str]:
    rows: List[str] = []
    for i in items:
        pri = i.get("priority")
        tr = i.get("trigger_reason") or ""
        st = i.get("source_type")
        if pri == "low" and st == "questionnaire" and tr != "questionnaire_incomplete":
            continue
        rows.append(f"{i.get('title', '')}: {tr}")
    return _dedupe_strings_preserve_order(rows)


def _collect_red_flags(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Surface only high-acuity signals that match urgent priorities or affirmative urgent triage.
    Every flag must correspond to an item still present in `items` (after singleton suppression).
    """
    flags: List[Dict[str, Any]] = []
    seen = set()
    for it in items:
        tr = it.get("trigger_reason") or ""
        pri = it.get("priority")
        key = None
        if pri == "urgent":
            key = ("urgent", it.get("id"))
        elif tr == "urg_scr_high_risk":
            # Defensive: triage rule should already use urgent priority
            key = ("urg_scr", it.get("id"))
        if key and key not in seen:
            seen.add(key)
            flags.append(
                {
                    "severity": "urgent",
                    "title": it.get("title") or "Срочное внимание",
                    "patient_summary": (it.get("patient_text") or "")[:500],
                    "source_item_id": it.get("id"),
                    "source_type": it.get("source_type"),
                    "trigger_reason": tr,
                }
            )
    return flags


def _overall_status_and_label(items: List[Dict[str, Any]], red_flags: List[Dict[str, Any]]) -> Tuple[str, str]:
    labels = {
        "stable": "Без критических автоматических сигналов по сводному обзору; информация не заменяет очную оценку.",
        "attention_needed": "Есть основания для дополнительного обсуждения результатов с врачом и планирования наблюдения.",
        "elevated_risk": "Выявлены согласованные признаки повышенного риска — рекомендуется согласовать план ведения с лечащим врачом.",
        "urgent_review": "Есть сигналы, при которых не следует откладывать клиническую оценку (при угрозе жизни — скорая помощь).",
    }
    status_suffix = {
        "elevated_risk": " Конкретные темы перечислены в разделах рекомендаций ниже.",
        "urgent_review": " Срочные и приоритетные темы отражены в рекомендациях ниже (включая блок предупреждений, если он показан).",
        "attention_needed": " Дополнительные темы для обсуждения с врачом приведены в списках ниже.",
    }
    if red_flags:
        base = labels["urgent_review"]
        suffix = status_suffix["urgent_review"] if items else ""
        return "urgent_review", base + suffix
    if not items:
        return "stable", labels["stable"]
    ranks = [_priority_rank(i.get("priority", "low")) for i in items]
    best = min(ranks)
    if best <= 0:
        base = labels["urgent_review"]
        return "urgent_review", base + status_suffix["urgent_review"]
    if best <= 1:
        return "elevated_risk", labels["elevated_risk"] + status_suffix["elevated_risk"]
    if best <= 2:
        return "attention_needed", labels["attention_needed"] + status_suffix["attention_needed"]
    return "stable", labels["stable"]


def build_full_patient_recommendation_bundle(patient: Patient) -> Dict[str, Any]:
    lab = build_lab_recommendation_bundle(patient)
    q = build_questionnaire_recommendation_bundle(patient)
    combined_raw, suppress_prefixes = evaluate_combined_rules(patient)
    combined_items = _strip_combined_internal_fields(combined_raw)

    singletons = _filter_singleton_items(lab["items"] + q["items"], suppress_prefixes)
    all_items = combined_items + singletons
    all_items.sort(
        key=lambda x: (
            _priority_rank(x.get("priority", "low")),
            x.get("source_type", ""),
            x.get("id", ""),
        )
    )

    red_flags = _collect_red_flags(all_items)
    overall_status, overall_label_ru = _overall_status_and_label(all_items, red_flags)

    patient_recs = _dedupe_strings_preserve_order([i["patient_text"] for i in all_items])
    doctor_recs = _dedupe_strings_preserve_order([i["doctor_text"] for i in all_items])
    attention = _attention_from_items(all_items)
    follow_all = _follow_ups_from_items(all_items)
    what_normal = _dedupe_strings_preserve_order(lab["what_is_normal"] + q["what_is_normal"])

    generated_at = timezone.now().isoformat()

    return {
        "version": 3,
        "source": "patient_recommendation_engine",
        "generated_at": generated_at,
        "patient_id": patient.id,
        "note": _merge_notes(lab, q),
        "overall_status": overall_status,
        "overall_status_patient_ru": overall_label_ru,
        "red_flags": red_flags,
        "combined_items": combined_items,
        "items": all_items,
        "what_is_normal": what_normal,
        "attention_points": attention,
        "patient_recommendations": patient_recs,
        "doctor_recommendations": doctor_recs,
        "follow_up_actions": follow_all,
        "sources": {
            "lab": {"engine_version": lab["version"], "engine": lab["source"]},
            "questionnaire": {"engine_version": q["version"], "engine": q["source"]},
            "combined": {"engine": "combined_recommendation_engine", "rules_version": 1},
        },
    }
