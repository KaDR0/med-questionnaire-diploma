import random
from pathlib import Path

import numpy as np
from django.core.management.base import BaseCommand
from sklearn.linear_model import LogisticRegression

from core.ml_risk import extract_feature_vector
from core.risk_engine import _rule_findings

PROBLEM_CODES = (
    "metabolic_risk",
    "metabolic_syndrome_pattern",
    "dyslipidemia_risk",
    "anemia_risk",
    "iron_deficiency_pattern",
    "cardiovascular_risk",
    "psychoemotional_risk",
    "depressive_symptom_burden",
    "renal_function_risk",
    "hepatic_enzyme_risk",
    "thyroid_axis_risk",
    "vitamin_d_insufficiency_risk",
    "obstructive_sleep_apnea_screen_risk",
    "hyperglycemia_symptom_cluster",
)

RED_FLAG_CODES = (
    "chest_dyspnea",
    "syncope_chest_red",
    "chest_pain_lone",
    "suicidal_ideation",
    "gi_bleeding",
    "stroke_fast_cluster",
    "thunderclap_neuro_red",
    "sepsis_confusion_red",
    "acute_abdomen_red",
    "renal_colic_pattern",
    "hemoptysis_red",
    "hyperglycemia_red",
    "dyspnea_systemic_red",
    "weight_loss_gi_bleed",
    "palpitation_syncope_red",
)


def _rand_labs() -> dict:
    labs = {}

    def add(key: str, lo: float, hi: float, spread: float = 1.35):
        if random.random() > 0.12:
            v = random.uniform(lo / spread, hi * spread)
            labs[key] = {"value": round(v, 2), "min_norm": lo, "max_norm": hi}

    add("glucose", 3.9, 6.0)
    add("hba1c", 4.0, 5.7)
    add("hemoglobin", 120.0, 160.0)
    add("ldl", 2.0, 3.0, spread=1.6)
    if random.random() > 0.12:
        labs["hdl"] = {
            "value": round(random.uniform(0.55, 2.4), 2),
            "min_norm": 1.0,
            "max_norm": None,
        }
    if random.random() > 0.12:
        labs["triglycerides"] = {
            "value": round(random.uniform(0.4, 4.5), 2),
            "min_norm": None,
            "max_norm": 1.7,
        }
    add("creatinine", 59.0, 104.0)
    add("alt", 10.0, 40.0)
    add("tsh", 0.4, 4.0)
    add("vitamin_d", 30.0, 100.0)
    if random.random() > 0.12:
        labs["ferritin"] = {
            "value": round(random.uniform(8.0, 420.0), 1),
            "min_norm": 30.0,
            "max_norm": 400.0,
        }
    return labs


def _rand_features() -> dict:
    keys = [
        "low_activity",
        "smoking",
        "fatigue",
        "dizziness",
        "sleep_problem",
        "hypertension",
        "chest_pain",
        "dyspnea",
        "suicidal_ideation",
        "blood_in_stool",
        "syncope",
        "thunderclap_headache",
        "focal_weakness",
        "speech_trouble_acute",
        "facial_droop_acute",
        "fever_confusion",
        "unintentional_weight_loss",
        "hematuria",
        "severe_abdominal_pain",
        "persistent_vomiting",
        "hemoptysis",
        "polyuria_polydipsia",
        "palpitations_presyncope",
        "osa_loud_snoring",
        "osa_observed_apnea",
        "osa_high_bmi_35",
        "osa_daytime_sleepiness",
    ]
    out = {k: random.choice([0, 1]) for k in keys}
    out["anxiety_score"] = random.uniform(0, 14)
    out["questionnaire_score"] = random.randint(0, 45)
    return out


def _synthetic_profile() -> dict:
    return {
        "age": random.randint(18, 92),
        "sex": random.choice([0, 1]),
        "bmi": round(random.uniform(17.5, 42.0), 1),
        "labs": _rand_labs(),
        "features": _rand_features(),
        "anx_screening_total_score": random.randint(0, 21),
        "dep_screening_total_score": random.randint(0, 27),
    }


def _label_findings(profile_data: dict) -> dict[str, int]:
    findings, _ = _rule_findings(profile_data)
    present = {f["problem_code"] for f in findings}
    return {code: int(code in present) for code in PROBLEM_CODES}


def _label_red_flags(profile_data: dict) -> dict[str, int]:
    _, flags = _rule_findings(profile_data)
    present = {f.get("flag_code") for f in flags if f.get("flag_code")}
    return {code: int(code in present) for code in RED_FLAG_CODES}


class Command(BaseCommand):
    help = "Train sklearn models for risk findings and red flags; writes core/ml_artifacts/*.joblib"

    def add_arguments(self, parser):
        parser.add_argument("--samples", type=int, default=10000, help="Synthetic training rows")
        parser.add_argument("--seed", type=int, default=42)

    def handle(self, *args, **options):
        import joblib

        n = max(500, options["samples"])
        random.seed(options["seed"])
        np.random.seed(options["seed"])

        X_list = []
        y_findings = {c: [] for c in PROBLEM_CODES}
        y_flags = {c: [] for c in RED_FLAG_CODES}

        for _ in range(n):
            pd = _synthetic_profile()
            x = extract_feature_vector(pd).ravel()
            X_list.append(x)
            lf = _label_findings(pd)
            for c in PROBLEM_CODES:
                y_findings[c].append(lf[c])
            rf = _label_red_flags(pd)
            for c in RED_FLAG_CODES:
                y_flags[c].append(rf[c])

        X = np.vstack(X_list)

        out_dir = Path(__file__).resolve().parents[2] / "ml_artifacts"
        out_dir.mkdir(parents=True, exist_ok=True)

        finding_models = {}
        for code in PROBLEM_CODES:
            y = np.array(y_findings[code])
            clf = LogisticRegression(
                max_iter=2000,
                class_weight="balanced",
                random_state=options["seed"],
                solver="lbfgs",
            )
            clf.fit(X, y)
            finding_models[code] = clf
            self.stdout.write(f"{code}: positives={int(y.sum())} / {n}")

        joblib.dump(
            {"version": 2, "models": finding_models, "feature_dim": X.shape[1]},
            out_dir / "findings_bundle.joblib",
        )

        flag_models = {}
        for code in RED_FLAG_CODES:
            y = np.array(y_flags[code])
            clf = LogisticRegression(
                max_iter=2000,
                class_weight="balanced",
                random_state=options["seed"] + 1,
                solver="lbfgs",
            )
            clf.fit(X, y)
            flag_models[code] = clf
            self.stdout.write(f"red_flag {code}: positives={int(y.sum())} / {n}")

        joblib.dump(
            {"version": 2, "models": flag_models, "feature_dim": X.shape[1]},
            out_dir / "red_flags_bundle.joblib",
        )

        self.stdout.write(self.style.SUCCESS(f"Saved bundles to {out_dir}"))
