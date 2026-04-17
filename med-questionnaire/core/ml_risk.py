"""
Tabular ML for risk findings and red flags (sklearn RandomForest).
Artifacts are produced by `python manage.py train_risk_ml`.
If artifacts are missing or sklearn is unavailable, risk_engine keeps heuristic scores.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

try:
    import joblib
except ImportError:
    joblib = None

_ARTIFACTS_DIR = Path(__file__).resolve().parent / "ml_artifacts"
_FINDINGS_NAME = "findings_bundle.joblib"
_RED_FLAGS_NAME = "red_flags_bundle.joblib"

_FINDINGS_CACHE: dict[str, Any] | None = None
_RED_FLAGS_CACHE: dict[str, Any] | None = None


def _lab_is_high(lab_entry: dict | None) -> bool:
    if not lab_entry:
        return False
    max_norm = lab_entry.get("max_norm")
    value = lab_entry.get("value")
    return max_norm is not None and value is not None and value > max_norm


def _lab_is_low(lab_entry: dict | None) -> bool:
    if not lab_entry:
        return False
    min_norm = lab_entry.get("min_norm")
    value = lab_entry.get("value")
    return min_norm is not None and value is not None and value < min_norm


def extract_feature_vector(profile_data: dict[str, Any]):
    """Fixed-order numeric vector aligned with train_risk_ml (v2 feature layout)."""
    import numpy as np

    labs = profile_data.get("labs") or {}
    feats = profile_data.get("features") or {}

    def _f(v, default=0.0) -> float:
        try:
            return float(v)
        except (TypeError, ValueError):
            return default

    age = _f(profile_data.get("age"), 45.0)
    sex = _f(profile_data.get("sex"), 0.0)
    bmi = _f(profile_data.get("bmi"), 24.0)
    bmi_high = 1.0 if bmi >= 30 else 0.0

    def lab_triplet(key: str, scale: float) -> tuple[float, float, float]:
        e = labs.get(key)
        if not e:
            return -1.0, 0.0, 0.0
        return _f(e.get("value")) / scale, float(_lab_is_high(e)), float(_lab_is_low(e))

    g_v, g_hi, g_lo = lab_triplet("glucose", 10.0)
    a1c_v, a1c_hi, a1c_lo = lab_triplet("hba1c", 10.0)
    hb_v, hb_hi, hb_lo = lab_triplet("hemoglobin", 200.0)
    ldl_v, ldl_hi, ldl_lo = lab_triplet("ldl", 6.0)
    cr_v, cr_hi, cr_lo = lab_triplet("creatinine", 500.0)
    alt_v, alt_hi, alt_lo = lab_triplet("alt", 200.0)
    tsh_v, tsh_hi, tsh_lo = lab_triplet("tsh", 10.0)
    tg_v, tg_hi, tg_lo = lab_triplet("triglycerides", 6.0)
    hdl_v, hdl_hi, hdl_lo = lab_triplet("hdl", 3.0)
    vd_v, vd_hi, vd_lo = lab_triplet("vitamin_d", 150.0)
    fe_v, fe_hi, fe_lo = lab_triplet("ferritin", 600.0)

    def bit(name: str) -> float:
        return 1.0 if int(feats.get(name, 0) or 0) == 1 else 0.0

    anxiety = _f(feats.get("anxiety_score", 0), 0.0) / 20.0
    qscore = _f(feats.get("questionnaire_score", 0), 0.0) / 50.0

    anx_total = profile_data.get("anx_screening_total_score")
    dep_total = profile_data.get("dep_screening_total_score")
    anx_norm = min(_f(anx_total, 0.0), 21.0) / 21.0 if anx_total is not None else 0.0
    dep_norm = min(_f(dep_total, 0.0), 27.0) / 27.0 if dep_total is not None else 0.0

    vec = np.array(
        [
            age / 100.0,
            sex,
            min(bmi / 50.0, 1.5),
            g_v,
            g_hi,
            g_lo,
            a1c_v,
            a1c_hi,
            a1c_lo,
            hb_v,
            hb_hi,
            hb_lo,
            ldl_v,
            ldl_hi,
            ldl_lo,
            bmi_high,
            bit("low_activity"),
            bit("smoking"),
            bit("fatigue"),
            bit("dizziness"),
            bit("sleep_problem"),
            bit("hypertension"),
            bit("chest_pain"),
            bit("dyspnea"),
            bit("suicidal_ideation"),
            bit("blood_in_stool"),
            anxiety,
            qscore,
            cr_v,
            cr_hi,
            cr_lo,
            alt_v,
            alt_hi,
            alt_lo,
            tsh_v,
            tsh_hi,
            tsh_lo,
            tg_v,
            tg_hi,
            tg_lo,
            hdl_v,
            hdl_hi,
            hdl_lo,
            vd_v,
            vd_hi,
            vd_lo,
            fe_v,
            fe_hi,
            fe_lo,
            bit("syncope"),
            bit("thunderclap_headache"),
            bit("focal_weakness"),
            bit("speech_trouble_acute"),
            bit("facial_droop_acute"),
            bit("fever_confusion"),
            bit("unintentional_weight_loss"),
            bit("hematuria"),
            bit("severe_abdominal_pain"),
            bit("persistent_vomiting"),
            bit("hemoptysis"),
            bit("polyuria_polydipsia"),
            bit("palpitations_presyncope"),
            bit("osa_loud_snoring"),
            bit("osa_observed_apnea"),
            bit("osa_high_bmi_35"),
            bit("osa_daytime_sleepiness"),
            anx_norm,
            dep_norm,
        ],
        dtype=np.float64,
    )
    return vec.reshape(1, -1)


def _load_bundle(filename: str) -> dict[str, Any] | None:
    if joblib is None:
        return None
    path = _ARTIFACTS_DIR / filename
    if not path.is_file():
        return None
    try:
        return joblib.load(path)
    except Exception:
        return None


def _get_findings_bundle() -> dict[str, Any] | None:
    global _FINDINGS_CACHE
    if _FINDINGS_CACHE is None:
        _FINDINGS_CACHE = _load_bundle(_FINDINGS_NAME)
    return _FINDINGS_CACHE


def _get_red_flags_bundle() -> dict[str, Any] | None:
    global _RED_FLAGS_CACHE
    if _RED_FLAGS_CACHE is None:
        _RED_FLAGS_CACHE = _load_bundle(_RED_FLAGS_NAME)
    return _RED_FLAGS_CACHE


def apply_ml_to_findings(findings: list[dict[str, Any]], profile_data: dict[str, Any]) -> list[dict[str, Any]]:
    try:
        bundle = _get_findings_bundle()
        if not bundle or not bundle.get("models"):
            return findings
        expected = bundle.get("feature_dim")
        X = extract_feature_vector(profile_data)
        if expected is not None and int(expected) != int(X.shape[1]):
            return findings
    except Exception:
        return findings
    models: dict[str, Any] = bundle["models"]
    for item in findings:
        code = item.get("problem_code")
        model = models.get(code)
        if model is None:
            continue
        try:
            proba = float(model.predict_proba(X)[0, 1])
        except Exception:
            continue
        conf = max(proba, 1.0 - proba)
        item["ml_probability"] = round(proba, 4)
        item["confidence_score"] = round(conf, 4)
    return findings


def apply_ml_to_red_flags(red_flags: list[dict[str, Any]], profile_data: dict[str, Any]) -> list[dict[str, Any]]:
    try:
        bundle = _get_red_flags_bundle()
        if not bundle or not bundle.get("models"):
            return red_flags
        expected = bundle.get("feature_dim")
        X = extract_feature_vector(profile_data)
        if expected is not None and int(expected) != int(X.shape[1]):
            return red_flags
    except Exception:
        return red_flags
    models: dict[str, Any] = bundle["models"]
    for item in red_flags:
        code = item.get("flag_code") or ""
        model = models.get(code)
        if model is None:
            continue
        try:
            proba = float(model.predict_proba(X)[0, 1])
        except Exception:
            continue
        conf = max(proba, 1.0 - proba)
        item["ml_probability"] = round(proba, 4)
        item["ml_confidence"] = round(conf, 4)
    return red_flags


def ml_artifacts_status() -> dict[str, Any]:
    """For diagnostics / API (optional)."""
    return {
        "findings_loaded": _get_findings_bundle() is not None,
        "red_flags_loaded": _get_red_flags_bundle() is not None,
        "artifacts_dir": str(_ARTIFACTS_DIR),
    }
