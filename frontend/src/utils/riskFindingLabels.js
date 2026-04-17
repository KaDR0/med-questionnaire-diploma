/** Maps backend English evidence strings to i18n keys under detail.riskEvidence.* */
const EVIDENCE_MAP = {
  "Glucose above reference range": "glucoseAboveRef",
  "HbA1c above reference range": "hba1cAboveRef",
  "BMI >= 30": "bmiGe30",
  "Low physical activity": "lowPhysicalActivity",
  "Hemoglobin below reference range": "hemoglobinBelowRef",
  "Fatigue reported": "fatigueReported",
  "Dizziness reported": "dizzinessReported",
  "LDL above reference range": "ldlAboveRef",
  "Smoking risk factor": "smokingRiskFactor",
  "Hypertension risk factor": "hypertensionRiskFactor",
  "Anxiety screening total score elevated (GAD-7 style)": "anxietyScreeningElevated",
  "Sleep problems reported": "sleepProblemsReported",
  "Triglycerides above reference range": "triglyceridesAboveRef",
  "HDL below reference range": "hdlBelowRef",
  "Glycemic marker above reference range": "glycemicMarkerAboveRef",
  "Elevated BMI (central adiposity risk context)": "elevatedBmiCentralAdiposity",
  "Diabetes-related metabolic stress on kidneys": "diabetesRenalStress",
  "Age 65+ (CKD prevalence context)": "age65CkdContext",
  "Cardiovascular risk context (smoking or hypertension)": "cvRiskContextSmokingHtn",
  "Ferritin below reference range": "ferritinBelowRef",
  "Depressive symptom score in severe range (PHQ-9 style)": "depressionScoreSeverePhq",
  "Depressive symptom score elevated (PHQ-9 style)": "depressionScoreElevatedPhq",
  "Moderate mood burden with sleep and energy symptoms": "moderateMoodBurdenSleepEnergy",
  "Creatinine above reference range": "creatinineAboveRef",
  "ALT above reference range": "altAboveRef",
  "Smoking (hepatotoxic cofactor context)": "smokingHepatotoxicContext",
  "TSH above reference range": "tshAboveRef",
  "TSH below reference range": "tshBelowRef",
  "25-OH vitamin D below reference range": "vitaminDBelowRef",
  "Low physical activity (sunlight exposure context)": "lowActivitySunlightContext",
  "Loud snoring reported": "loudSnoringReported",
  "Observed breathing pauses during sleep": "observedSleepApneaPauses",
  "Daytime sleepiness reported": "daytimeSleepinessReported",
  "Hypertension noted on sleep questionnaire": "hypertensionOnSleepQuestionnaire",
  "Elevated BMI on sleep questionnaire": "elevatedBmiOnSleepQuestionnaire",
  "Severe thirst/polyuria reported": "severeThirstPolyuriaReported",
  "Glycemic laboratory marker elevated": "glycemicLabMarkerElevated",
};

export function translateRiskEvidence(t, text) {
  const sub = EVIDENCE_MAP[text];
  if (!sub) return text;
  return t(`detail.riskEvidence.${sub}`);
}

export function translateRiskProblemCode(t, code) {
  if (!code) return "";
  return t(`detail.riskProblems.${code}`, { defaultValue: code });
}

export function translateRiskLevel(t, level) {
  const l = String(level || "low").toLowerCase();
  return t(`detail.riskLevels.${l}`, { defaultValue: level || "low" });
}

export function translateFindingRecommendation(t, rec) {
  if (!rec) return { title: "", preliminary: "", nextSteps: "" };
  const tid = rec.template_id;
  if (tid) {
    const base = `detail.riskRecommendationTemplates.${tid}`;
    return {
      title: t(`${base}.title`, { defaultValue: rec.title || "" }),
      preliminary: t(`${base}.preliminary`, { defaultValue: rec.preliminary_conclusion || "" }),
      nextSteps: t(`${base}.nextSteps`, { defaultValue: rec.next_steps || "" }),
    };
  }
  return {
    title: rec.title || "",
    preliminary: rec.preliminary_conclusion || "",
    nextSteps: rec.next_steps || "",
  };
}
