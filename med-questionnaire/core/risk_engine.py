from django.db import transaction

from .ml_risk import apply_ml_to_findings, apply_ml_to_red_flags
from .models import (
    Assessment,
    LabValue,
    Patient,
    PatientRiskProfile,
    RecommendationTemplate,
    RiskFinding,
    RiskRedFlag,
)


RECOMMENDATION_DEFAULTS = {
    "metabolic_followup": {
        "title": "Metabolic risk follow-up",
        "preliminary_conclusion": "Metabolic risk pattern is elevated and requires structured follow-up.",
        "next_steps": "Review nutrition/activity, repeat glycemic markers, and schedule physician reassessment.",
    },
    "anemia_followup": {
        "title": "Possible anemia pattern follow-up",
        "preliminary_conclusion": "Findings suggest a possible anemia-related risk pattern.",
        "next_steps": "Consider CBC-focused reassessment and clinical correlation with symptoms.",
    },
    "cardio_followup": {
        "title": "Cardiovascular risk follow-up",
        "preliminary_conclusion": "Cardiovascular risk pattern is elevated.",
        "next_steps": "Review lipid profile, blood pressure, and lifestyle factors with interval monitoring.",
    },
    "psycho_followup": {
        "title": "Psychoemotional follow-up",
        "preliminary_conclusion": "Psychoemotional burden appears elevated based on questionnaire signals.",
        "next_steps": "Consider closer follow-up, sleep hygiene guidance, and mental health screening review.",
    },
    "dyslipid_followup": {
        "title": "Dyslipidemia follow-up",
        "preliminary_conclusion": "Atherogenic lipid pattern (triglycerides and/or HDL) warrants review.",
        "next_steps": "Repeat fasting lipids, assess secondary causes, reinforce diet/activity, and align with CV risk goals.",
    },
    "renal_followup": {
        "title": "Kidney function follow-up",
        "preliminary_conclusion": "Creatinine elevation with contextual risk factors suggests renal pathway review.",
        "next_steps": "Repeat renal panel, check eGFR trend, review nephrotoxic exposures, and optimize BP/glucose control.",
    },
    "liver_followup": {
        "title": "Liver enzyme follow-up",
        "preliminary_conclusion": "Transaminase elevation merits correlation with symptoms and risk factors.",
        "next_steps": "Repeat LFTs, review alcohol/medications/metabolic factors, and consider hepatology workup if persistent.",
    },
    "thyroid_followup": {
        "title": "Thyroid function follow-up",
        "preliminary_conclusion": "TSH outside the reference range suggests thyroid axis evaluation.",
        "next_steps": "Confirm with repeat TSH ± free T4, review symptoms, and plan treatment referral if indicated.",
    },
    "vitamin_d_followup": {
        "title": "Vitamin D repletion",
        "preliminary_conclusion": "Low 25-OH vitamin D with lifestyle or symptom overlap supports repletion planning.",
        "next_steps": "Consider supplementation per local guideline, safe sun exposure, and repeat level after therapy.",
    },
    "iron_deficiency_followup": {
        "title": "Iron stores follow-up",
        "preliminary_conclusion": "Low ferritin with supportive findings suggests iron deficiency workup.",
        "next_steps": "Correlate with CBC/iron studies, evaluate GI sources if indicated, and discuss oral/IV iron with clinician.",
    },
    "osa_workup_followup": {
        "title": "Sleep apnea screening follow-up",
        "preliminary_conclusion": "Cluster of sleep-related symptoms matches elevated OSA screening probability.",
        "next_steps": "Discuss sleep study or home sleep testing, weight/BP review, and daytime safety (driving) counseling.",
    },
    "depression_followup": {
        "title": "Depressive symptoms follow-up",
        "preliminary_conclusion": "PHQ-9 style burden is elevated; clinical assessment is appropriate.",
        "next_steps": "Safety check, structured depression care pathways, and follow-up within days to weeks per severity.",
    },
    "metabolic_syndrome_followup": {
        "title": "Metabolic syndrome pattern",
        "preliminary_conclusion": "Combined central adiposity, glycemic, and lipid signals suggest metabolic syndrome clustering.",
        "next_steps": "Integrated lifestyle program, lipid/glucose monitoring, and periodic cardiometabolic reassessment.",
    },
    "hyperglycemia_urgent_followup": {
        "title": "Hyperglycemia with osmotic symptoms",
        "preliminary_conclusion": "Severe thirst/polyuria with elevated glucose/HbA1c requires prompt clinical contact.",
        "next_steps": "Same-day clinician contact, ketone check if unwell, hydration plan, and ED referral if vomiting or altered mentation.",
    },
}


def _ensure_templates():
    mapping = {}
    for template_id, payload in RECOMMENDATION_DEFAULTS.items():
        template, _ = RecommendationTemplate.objects.get_or_create(
            template_id=template_id,
            defaults=payload,
        )
        mapping[template_id] = template
    return mapping


def _latest_lab_map(patient):
    lab_map = {}
    latest_values = (
        LabValue.objects.filter(result__patient=patient)
        .select_related("indicator", "result")
        .order_by("indicator_id", "-result__date", "-id")
    )
    for value in latest_values:
        if value.indicator_id in lab_map:
            continue
        lab_map[value.indicator_id] = value
    return lab_map


# Merged across recent assessments (any "yes" wins) for urgent / persistent symptom keys.
_RED_FLAG_MERGE_KEYS = frozenset(
    {
        "chest_pain",
        "dyspnea",
        "blood_in_stool",
        "suicidal_ideation",
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
    }
)
_RECENT_ASSESSMENTS_FOR_MERGE = 15


def _answer_to_binary_or_raw(answer):
    raw = str(answer.value or "").strip().lower()
    if raw in {"yes", "1", "true"}:
        return 1, True
    if raw in {"no", "0", "false"}:
        return 0, True
    return answer.value, False


def _questionnaire_features(patient):
    features = {}
    assessments = list(
        Assessment.objects.filter(patient=patient)
        .prefetch_related("answers__question")
        .order_by("-created_at")[:_RECENT_ASSESSMENTS_FOR_MERGE]
    )
    if not assessments:
        return features, None

    latest_assessment = assessments[0]

    for answer in latest_assessment.answers.all():
        q = answer.question
        key = q.feature_key.strip()
        if not key or key == "questionnaire_score":
            continue
        if key in _RED_FLAG_MERGE_KEYS:
            continue
        val, is_bin = _answer_to_binary_or_raw(answer)
        if is_bin:
            features[key] = val
        else:
            features[key] = val

    features["questionnaire_score"] = latest_assessment.total_score

    merged = {k: 0 for k in _RED_FLAG_MERGE_KEYS}
    for assessment in assessments:
        for answer in assessment.answers.all():
            key = answer.question.feature_key.strip()
            if key not in _RED_FLAG_MERGE_KEYS:
                continue
            val, is_bin = _answer_to_binary_or_raw(answer)
            if is_bin:
                merged[key] = max(merged[key], int(val))
    for key in _RED_FLAG_MERGE_KEYS:
        if any(a.answers.filter(question__feature_key=key).exists() for a in assessments):
            features[key] = merged[key]

    return features, latest_assessment


def _build_profile(patient):
    bmi = None
    if patient.height_cm and patient.weight_kg and patient.height_cm > 0:
        bmi = round(patient.weight_kg / ((patient.height_cm / 100) ** 2), 1)

    labs = _latest_lab_map(patient)
    features, latest_assessment = _questionnaire_features(patient)
    intake = (patient.data or {}).get("intake", {})

    anx_assessment = (
        Assessment.objects.filter(patient=patient, questionnaire__target_condition_code="ANX-SCR")
        .select_related("questionnaire")
        .order_by("-created_at")
        .first()
    )
    anx_screening_total_score = anx_assessment.total_score if anx_assessment else None

    dep_assessment = (
        Assessment.objects.filter(patient=patient, questionnaire__target_condition_code="DEP-SCR")
        .select_related("questionnaire")
        .order_by("-created_at")
        .first()
    )
    dep_screening_total_score = dep_assessment.total_score if dep_assessment else None

    return {
        "patient_id": patient.id,
        "age": patient.age,
        "sex": patient.sex,
        "bmi": bmi,
        "status": patient.status,
        "intake": intake,
        "labs": {
            value.indicator.code or value.indicator.name.lower(): {
                "name": value.indicator.standard_name or value.indicator.name,
                "value": value.value,
                "min_norm": value.indicator.min_norm,
                "max_norm": value.indicator.max_norm,
                "unit": value.indicator.unit,
            }
            for value in labs.values()
        },
        "features": features,
        "latest_assessment_id": latest_assessment.id if latest_assessment else None,
        "anx_screening_total_score": anx_screening_total_score,
        "dep_screening_total_score": dep_screening_total_score,
    }, latest_assessment


def _lab_is_high(lab_entry):
    if not lab_entry:
        return False
    max_norm = lab_entry.get("max_norm")
    value = lab_entry.get("value")
    return max_norm is not None and value is not None and value > max_norm


def _lab_is_low(lab_entry):
    if not lab_entry:
        return False
    min_norm = lab_entry.get("min_norm")
    value = lab_entry.get("value")
    return min_norm is not None and value is not None and value < min_norm


def _ml_probability(evidence_count, base=0.4):
    prob = min(0.95, base + evidence_count * 0.13)
    confidence = min(0.9, 0.45 + evidence_count * 0.11)
    return round(prob, 3), round(confidence, 3)


def _yes(features, key):
    return int(features.get(key, 0) or 0) == 1


def _rule_findings(profile_data):
    labs = profile_data["labs"]
    features = profile_data["features"]
    findings = []
    red_flags = []

    glucose = labs.get("glucose")
    hba1c = labs.get("hba1c")
    hemoglobin = labs.get("hemoglobin")
    ldl = labs.get("ldl")
    hdl = labs.get("hdl")
    tg = labs.get("triglycerides")
    creatinine = labs.get("creatinine")
    alt = labs.get("alt")
    tsh = labs.get("tsh")
    vit_d = labs.get("vitamin_d")
    ferritin = labs.get("ferritin")

    bmi = profile_data.get("bmi") or 0
    bmi_high = bmi >= 30
    bmi_overweight = bmi >= 28
    age = profile_data.get("age") or 0

    low_activity = _yes(features, "low_activity")
    smoking = _yes(features, "smoking")
    fatigue = _yes(features, "fatigue")
    dizziness = _yes(features, "dizziness")
    sleep_problem = _yes(features, "sleep_problem")
    hypertension = _yes(features, "hypertension")
    anx_total = profile_data.get("anx_screening_total_score")
    dep_total = profile_data.get("dep_screening_total_score")

    snore = _yes(features, "osa_loud_snoring")
    apnea_obs = _yes(features, "osa_observed_apnea")
    osa_bmi35 = _yes(features, "osa_high_bmi_35")
    osa_daytime = int(features.get("osa_daytime_sleepiness", 0) or 0) == 1

    metabolic_evidence = []
    if _lab_is_high(glucose):
        metabolic_evidence.append("Glucose above reference range")
    if _lab_is_high(hba1c):
        metabolic_evidence.append("HbA1c above reference range")
    if bmi_high:
        metabolic_evidence.append("BMI >= 30")
    if low_activity:
        metabolic_evidence.append("Low physical activity")
    if len(metabolic_evidence) >= 3:
        prob, conf = _ml_probability(len(metabolic_evidence), base=0.5)
        findings.append(
            {
                "problem_code": "metabolic_risk",
                "risk_level": "high" if len(metabolic_evidence) >= 4 else "moderate",
                "evidence": metabolic_evidence,
                "recommendation_template_id": "metabolic_followup",
                "ml_probability": prob,
                "confidence_score": conf,
            }
        )

    ms_evidence = []
    if _lab_is_high(tg):
        ms_evidence.append("Triglycerides above reference range")
    if _lab_is_low(hdl):
        ms_evidence.append("HDL below reference range")
    if _lab_is_high(glucose) or _lab_is_high(hba1c):
        ms_evidence.append("Glycemic marker above reference range")
    if bmi_high or bmi_overweight:
        ms_evidence.append("Elevated BMI (central adiposity risk context)")
    if hypertension:
        ms_evidence.append("Hypertension risk factor")
    if len(ms_evidence) >= 3:
        prob, conf = _ml_probability(len(ms_evidence), base=0.48)
        findings.append(
            {
                "problem_code": "metabolic_syndrome_pattern",
                "risk_level": "high" if len(ms_evidence) >= 4 else "moderate",
                "evidence": ms_evidence,
                "recommendation_template_id": "metabolic_syndrome_followup",
                "ml_probability": prob,
                "confidence_score": conf,
            }
        )

    dys_evidence = []
    if _lab_is_high(tg):
        dys_evidence.append("Triglycerides above reference range")
    if _lab_is_low(hdl):
        dys_evidence.append("HDL below reference range")
    if _lab_is_high(ldl):
        dys_evidence.append("LDL above reference range")
    if smoking or hypertension:
        dys_evidence.append("Cardiovascular risk context (smoking or hypertension)")
    if len(dys_evidence) >= 2:
        prob, conf = _ml_probability(len(dys_evidence), base=0.45)
        findings.append(
            {
                "problem_code": "dyslipidemia_risk",
                "risk_level": "high" if len(dys_evidence) >= 3 else "moderate",
                "evidence": dys_evidence,
                "recommendation_template_id": "dyslipid_followup",
                "ml_probability": prob,
                "confidence_score": conf,
            }
        )

    anemia_evidence = []
    if _lab_is_low(hemoglobin):
        anemia_evidence.append("Hemoglobin below reference range")
    if fatigue:
        anemia_evidence.append("Fatigue reported")
    if dizziness:
        anemia_evidence.append("Dizziness reported")
    if len(anemia_evidence) >= 2:
        prob, conf = _ml_probability(len(anemia_evidence), base=0.44)
        findings.append(
            {
                "problem_code": "anemia_risk",
                "risk_level": "high" if len(anemia_evidence) >= 3 else "moderate",
                "evidence": anemia_evidence,
                "recommendation_template_id": "anemia_followup",
                "ml_probability": prob,
                "confidence_score": conf,
            }
        )

    iron_evidence = []
    if _lab_is_low(ferritin):
        iron_evidence.append("Ferritin below reference range")
    if _lab_is_low(hemoglobin):
        iron_evidence.append("Hemoglobin below reference range")
    if fatigue:
        iron_evidence.append("Fatigue reported")
    if len(iron_evidence) >= 2 and _lab_is_low(ferritin):
        prob, conf = _ml_probability(len(iron_evidence), base=0.43)
        findings.append(
            {
                "problem_code": "iron_deficiency_pattern",
                "risk_level": "high" if len(iron_evidence) >= 3 else "moderate",
                "evidence": iron_evidence,
                "recommendation_template_id": "iron_deficiency_followup",
                "ml_probability": prob,
                "confidence_score": conf,
            }
        )

    cardio_evidence = []
    if _lab_is_high(ldl):
        cardio_evidence.append("LDL above reference range")
    if smoking:
        cardio_evidence.append("Smoking risk factor")
    if hypertension:
        cardio_evidence.append("Hypertension risk factor")
    if len(cardio_evidence) >= 2:
        prob, conf = _ml_probability(len(cardio_evidence), base=0.46)
        findings.append(
            {
                "problem_code": "cardiovascular_risk",
                "risk_level": "high" if len(cardio_evidence) >= 3 else "moderate",
                "evidence": cardio_evidence,
                "recommendation_template_id": "cardio_followup",
                "ml_probability": prob,
                "confidence_score": conf,
            }
        )

    psycho_evidence = []
    if anx_total is not None and anx_total >= 8:
        psycho_evidence.append("Anxiety screening total score elevated (GAD-7 style)")
    if sleep_problem:
        psycho_evidence.append("Sleep problems reported")
    if len(psycho_evidence) >= 2 or (anx_total is not None and anx_total >= 8):
        prob, conf = _ml_probability(len(psycho_evidence), base=0.42)
        findings.append(
            {
                "problem_code": "psychoemotional_risk",
                "risk_level": "elevated",
                "evidence": psycho_evidence,
                "recommendation_template_id": "psycho_followup",
                "ml_probability": prob,
                "confidence_score": conf,
            }
        )

    dep_evidence = []
    if dep_total is not None:
        if dep_total >= 15:
            dep_evidence.append("Depressive symptom score in severe range (PHQ-9 style)")
        elif dep_total >= 10:
            dep_evidence.append("Depressive symptom score elevated (PHQ-9 style)")
        elif dep_total >= 5 and sleep_problem and fatigue:
            dep_evidence.append("Moderate mood burden with sleep and energy symptoms")
    if dep_evidence:
        prob, conf = _ml_probability(max(2, len(dep_evidence)), base=0.41)
        findings.append(
            {
                "problem_code": "depressive_symptom_burden",
                "risk_level": "high" if dep_total is not None and dep_total >= 15 else "moderate",
                "evidence": dep_evidence,
                "recommendation_template_id": "depression_followup",
                "ml_probability": prob,
                "confidence_score": conf,
            }
        )

    renal_evidence = []
    if _lab_is_high(creatinine):
        renal_evidence.append("Creatinine above reference range")
    if hypertension:
        renal_evidence.append("Hypertension risk factor")
    if _lab_is_high(glucose) or _lab_is_high(hba1c):
        renal_evidence.append("Diabetes-related metabolic stress on kidneys")
    if age >= 65:
        renal_evidence.append("Age 65+ (CKD prevalence context)")
    if _lab_is_high(creatinine) and len(renal_evidence) >= 2:
        prob, conf = _ml_probability(len(renal_evidence), base=0.47)
        findings.append(
            {
                "problem_code": "renal_function_risk",
                "risk_level": "high" if len(renal_evidence) >= 3 else "moderate",
                "evidence": renal_evidence,
                "recommendation_template_id": "renal_followup",
                "ml_probability": prob,
                "confidence_score": conf,
            }
        )
    elif _lab_is_high(creatinine):
        prob, conf = _ml_probability(1, base=0.4)
        findings.append(
            {
                "problem_code": "renal_function_risk",
                "risk_level": "moderate",
                "evidence": ["Creatinine above reference range"],
                "recommendation_template_id": "renal_followup",
                "ml_probability": prob,
                "confidence_score": conf,
            }
        )

    liver_evidence = []
    if _lab_is_high(alt):
        liver_evidence.append("ALT above reference range")
    if fatigue:
        liver_evidence.append("Fatigue reported")
    if smoking:
        liver_evidence.append("Smoking (hepatotoxic cofactor context)")
    if len(liver_evidence) >= 2:
        prob, conf = _ml_probability(len(liver_evidence), base=0.44)
        findings.append(
            {
                "problem_code": "hepatic_enzyme_risk",
                "risk_level": "high" if len(liver_evidence) >= 3 else "moderate",
                "evidence": liver_evidence,
                "recommendation_template_id": "liver_followup",
                "ml_probability": prob,
                "confidence_score": conf,
            }
        )
    elif _lab_is_high(alt):
        prob, conf = _ml_probability(1, base=0.38)
        findings.append(
            {
                "problem_code": "hepatic_enzyme_risk",
                "risk_level": "moderate",
                "evidence": ["ALT above reference range"],
                "recommendation_template_id": "liver_followup",
                "ml_probability": prob,
                "confidence_score": conf,
            }
        )

    thyroid_evidence = []
    if _lab_is_high(tsh):
        thyroid_evidence.append("TSH above reference range")
    if _lab_is_low(tsh):
        thyroid_evidence.append("TSH below reference range")
    if fatigue:
        thyroid_evidence.append("Fatigue reported")
    if sleep_problem:
        thyroid_evidence.append("Sleep problems reported")
    if _lab_is_high(tsh) or _lab_is_low(tsh):
        prob, conf = _ml_probability(len(thyroid_evidence), base=0.46)
        findings.append(
            {
                "problem_code": "thyroid_axis_risk",
                "risk_level": "high" if len(thyroid_evidence) >= 3 else "moderate",
                "evidence": thyroid_evidence,
                "recommendation_template_id": "thyroid_followup",
                "ml_probability": prob,
                "confidence_score": conf,
            }
        )

    vit_evidence = []
    if _lab_is_low(vit_d):
        vit_evidence.append("25-OH vitamin D below reference range")
    if low_activity:
        vit_evidence.append("Low physical activity (sunlight exposure context)")
    if fatigue:
        vit_evidence.append("Fatigue reported")
    if len(vit_evidence) >= 2 and _lab_is_low(vit_d):
        prob, conf = _ml_probability(len(vit_evidence), base=0.4)
        findings.append(
            {
                "problem_code": "vitamin_d_insufficiency_risk",
                "risk_level": "moderate",
                "evidence": vit_evidence,
                "recommendation_template_id": "vitamin_d_followup",
                "ml_probability": prob,
                "confidence_score": conf,
            }
        )

    osa_evidence = []
    if snore:
        osa_evidence.append("Loud snoring reported")
    if apnea_obs:
        osa_evidence.append("Observed breathing pauses during sleep")
    if osa_daytime:
        osa_evidence.append("Daytime sleepiness reported")
    if hypertension:
        osa_evidence.append("Hypertension noted on sleep questionnaire")
    if osa_bmi35 or bmi_high:
        osa_evidence.append("Elevated BMI on sleep questionnaire")
    if (snore and apnea_obs) or (snore and osa_daytime and (hypertension or osa_bmi35 or bmi_high)):
        prob, conf = _ml_probability(len(osa_evidence), base=0.43)
        findings.append(
            {
                "problem_code": "obstructive_sleep_apnea_screen_risk",
                "risk_level": "moderate",
                "evidence": osa_evidence,
                "recommendation_template_id": "osa_workup_followup",
                "ml_probability": prob,
                "confidence_score": conf,
            }
        )

    if _yes(features, "polyuria_polydipsia") and (_lab_is_high(glucose) or _lab_is_high(hba1c)):
        prob, conf = _ml_probability(3, base=0.52)
        findings.append(
            {
                "problem_code": "hyperglycemia_symptom_cluster",
                "risk_level": "high",
                "evidence": [
                    "Severe thirst/polyuria reported",
                    "Glycemic laboratory marker elevated",
                ],
                "recommendation_template_id": "hyperglycemia_urgent_followup",
                "ml_probability": prob,
                "confidence_score": conf,
            }
        )

    chest_pain = _yes(features, "chest_pain")
    dyspnea = _yes(features, "dyspnea")
    suicidal_ideation = _yes(features, "suicidal_ideation")
    gi_bleeding = _yes(features, "blood_in_stool")
    syncope = _yes(features, "syncope")
    thunder = _yes(features, "thunderclap_headache")
    focal_w = _yes(features, "focal_weakness")
    speech_tr = _yes(features, "speech_trouble_acute")
    facial_d = _yes(features, "facial_droop_acute")
    fever_conf = _yes(features, "fever_confusion")
    weight_loss = _yes(features, "unintentional_weight_loss")
    hematuria = _yes(features, "hematuria")
    abd_pain = _yes(features, "severe_abdominal_pain")
    vomit = _yes(features, "persistent_vomiting")
    hemoptysis = _yes(features, "hemoptysis")
    polyuria = _yes(features, "polyuria_polydipsia")
    palp_presync = _yes(features, "palpitations_presyncope")

    if chest_pain and dyspnea:
        red_flags.append(
            {
                "flag_code": "chest_dyspnea",
                "urgency_level": "high",
                "trigger_signs": ["Chest pain", "Dyspnea"],
                "recommended_action": "Urgent in-person cardiovascular assessment is recommended.",
            }
        )
    elif syncope and chest_pain:
        red_flags.append(
            {
                "flag_code": "syncope_chest_red",
                "urgency_level": "critical",
                "trigger_signs": ["Syncope", "Chest pain"],
                "recommended_action": "Emergency cardiovascular and rhythm evaluation is recommended.",
            }
        )
    elif chest_pain:
        red_flags.append(
            {
                "flag_code": "chest_pain_lone",
                "urgency_level": "high",
                "trigger_signs": ["Chest pain or pressure reported"],
                "recommended_action": "Same-day clinical assessment for possible acute coronary syndrome is recommended.",
            }
        )

    if suicidal_ideation:
        red_flags.append(
            {
                "flag_code": "suicidal_ideation",
                "urgency_level": "critical",
                "trigger_signs": ["Self-harm thoughts reported"],
                "recommended_action": "Immediate mental health safety assessment is recommended.",
            }
        )
    if gi_bleeding:
        red_flags.append(
            {
                "flag_code": "gi_bleeding",
                "urgency_level": "high",
                "trigger_signs": ["Blood in stool reported"],
                "recommended_action": "Urgent gastrointestinal evaluation is recommended.",
            }
        )

    if (focal_w and speech_tr) or (focal_w and facial_d) or (speech_tr and facial_d):
        red_flags.append(
            {
                "flag_code": "stroke_fast_cluster",
                "urgency_level": "critical",
                "trigger_signs": ["Acute focal neurologic or speech/facial symptoms"],
                "recommended_action": "Treat as possible stroke: emergency services or ED now; note time of symptom onset.",
            }
        )

    if thunder and (focal_w or speech_tr or fever_conf):
        red_flags.append(
            {
                "flag_code": "thunderclap_neuro_red",
                "urgency_level": "critical",
                "trigger_signs": ["Sudden severe headache with red-flag accompaniments"],
                "recommended_action": "Emergency evaluation for subarachnoid hemorrhage or other neurovascular emergency.",
            }
        )

    if fever_conf:
        red_flags.append(
            {
                "flag_code": "sepsis_confusion_red",
                "urgency_level": "critical",
                "trigger_signs": ["Fever with confusion or altered thinking"],
                "recommended_action": "Emergency evaluation for sepsis or CNS infection is recommended.",
            }
        )

    if vomit and abd_pain:
        red_flags.append(
            {
                "flag_code": "acute_abdomen_red",
                "urgency_level": "high",
                "trigger_signs": ["Persistent vomiting", "Severe abdominal pain"],
                "recommended_action": "Urgent surgical/medical assessment for possible obstruction or acute abdomen.",
            }
        )

    if hematuria and abd_pain:
        red_flags.append(
            {
                "flag_code": "renal_colic_pattern",
                "urgency_level": "high",
                "trigger_signs": ["Blood in urine", "Severe abdominal/flank pain context"],
                "recommended_action": "Urgent urologic or emergency assessment for stones or renal pathology.",
            }
        )

    if hemoptysis:
        red_flags.append(
            {
                "flag_code": "hemoptysis_red",
                "urgency_level": "critical",
                "trigger_signs": ["Coughing blood reported"],
                "recommended_action": "Emergency evaluation for airway, pulmonary embolism, or massive hemoptysis risk.",
            }
        )

    if polyuria and (_lab_is_high(glucose) or _lab_is_high(hba1c)):
        red_flags.append(
            {
                "flag_code": "hyperglycemia_red",
                "urgency_level": "high",
                "trigger_signs": ["Severe thirst/polyuria", "Markedly elevated glycemic marker"],
                "recommended_action": "Same-day medical contact for possible diabetic emergency; check ketones if unwell.",
            }
        )

    if dyspnea and (fever_conf or hemoptysis or syncope):
        red_flags.append(
            {
                "flag_code": "dyspnea_systemic_red",
                "urgency_level": "high",
                "trigger_signs": ["Dyspnea with systemic red-flag features"],
                "recommended_action": "Urgent evaluation for pulmonary embolism, infection, or cardiac decompensation.",
            }
        )

    if weight_loss and gi_bleeding:
        red_flags.append(
            {
                "flag_code": "weight_loss_gi_bleed",
                "urgency_level": "high",
                "trigger_signs": ["Unintentional weight loss", "Gastrointestinal bleeding"],
                "recommended_action": "Urgent structured evaluation for possible malignancy or significant GI pathology.",
            }
        )

    if palp_presync and (syncope or dizziness):
        red_flags.append(
            {
                "flag_code": "palpitation_syncope_red",
                "urgency_level": "high",
                "trigger_signs": ["Palpitations with presyncope", "Syncope or dizziness"],
                "recommended_action": "Prompt rhythm and cardiovascular assessment; avoid driving until cleared.",
            }
        )

    return findings, red_flags


@transaction.atomic
def calculate_and_store_risk_profile(patient):
    if isinstance(patient, int):
        patient = Patient.objects.get(id=patient)

    templates = _ensure_templates()
    profile_data, latest_assessment = _build_profile(patient)
    findings_data, red_flags_data = _rule_findings(profile_data)
    findings_data = apply_ml_to_findings(findings_data, profile_data)
    red_flags_data = apply_ml_to_red_flags(red_flags_data, profile_data)

    risk_rank = {"low": 1, "moderate": 2, "elevated": 2, "high": 3, "critical": 4}
    highest = "low"
    if findings_data:
        highest = max(findings_data, key=lambda f: risk_rank.get(f["risk_level"], 1))["risk_level"]
    for rf in red_flags_data:
        lvl = rf.get("urgency_level", "high")
        if risk_rank.get(lvl, 1) > risk_rank.get(highest, 1):
            highest = lvl

    summary = (
        "Structured risk profile generated from laboratory and questionnaire data. "
        "This output supports clinical decision-making and is not a final diagnosis."
    )
    risk_profile = PatientRiskProfile.objects.create(
        patient=patient,
        assessment=latest_assessment,
        overall_risk_level=highest,
        summary=summary,
        profile_data=profile_data,
    )

    for item in findings_data:
        RiskFinding.objects.create(
            risk_profile=risk_profile,
            problem_code=item["problem_code"],
            risk_level=item["risk_level"],
            evidence=item["evidence"],
            ml_probability=item["ml_probability"],
            confidence_score=item["confidence_score"],
            recommendation_template=templates.get(item["recommendation_template_id"]),
        )

    for item in red_flags_data:
        RiskRedFlag.objects.create(
            risk_profile=risk_profile,
            flag_code=item.get("flag_code", ""),
            urgency_level=item["urgency_level"],
            trigger_signs=item["trigger_signs"],
            recommended_action=item["recommended_action"],
            ml_probability=item.get("ml_probability"),
            ml_confidence=item.get("ml_confidence"),
        )

    from .patient_clinical_status import refresh_patient_clinical_status

    refresh_patient_clinical_status(patient.id)

    return risk_profile
