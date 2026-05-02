/** Shared localization for assessment-like payloads (detail API + assignment assessment_summary). */

export function normalizeInterpretationKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function localizeInterpretationTitle(t, assessmentLike) {
  const rawTitle = assessmentLike?.interpretation?.title || "";
  const labelKey = normalizeInterpretationKey(assessmentLike?.interpretation?.label);
  if (labelKey) {
    return t(`result.interpretationLabels.${labelKey}`, { defaultValue: rawTitle || t("common.noData") });
  }
  const titleKey = normalizeInterpretationKey(rawTitle);
  if (titleKey) {
    return t(`result.interpretationTitles.${titleKey}`, { defaultValue: rawTitle || t("common.noData") });
  }
  return rawTitle || t("common.noData");
}

export function localizeInterpretationRecommendation(t, assessmentLike) {
  const rawRecommendation = assessmentLike?.interpretation?.recommendation || "";
  const labelKey = normalizeInterpretationKey(assessmentLike?.interpretation?.label);
  if (labelKey) {
    return t(`result.interpretationRecommendations.${labelKey}`, {
      defaultValue: rawRecommendation || t("common.noData"),
    });
  }
  return rawRecommendation || t("common.noData");
}

/**
 * Same priority as AssessmentResultPage: localized interpretation first, then stored conclusion, then score fallbacks.
 */
export function getLocalizedAssessmentSummaryLine(t, assessmentLike) {
  if (!assessmentLike) return t("common.noData");
  const localizedTitle = localizeInterpretationTitle(t, assessmentLike);
  const localizedRecommendation = localizeInterpretationRecommendation(t, assessmentLike);
  if (localizedTitle !== t("common.noData") || localizedRecommendation !== t("common.noData")) {
    return [localizedTitle, localizedRecommendation]
      .filter((part) => part && part !== t("common.noData"))
      .join(". ");
  }
  if (assessmentLike.conclusion) return assessmentLike.conclusion;
  const score = Number(assessmentLike.total_score);
  if (!Number.isNaN(score) && score >= 3) return t("result.highRiskFallback");
  if (!Number.isNaN(score) && score >= 1) return t("result.mediumRiskFallback");
  return t("result.lowRiskFallback");
}

/** Short preview for assignment lists (truncate like PatientPortalPage). */
export function localizedAssignmentSummaryPreview(t, summary) {
  if (!summary) return null;
  const line = getLocalizedAssessmentSummaryLine(t, summary).trim();
  if (!line || line === t("common.noData")) {
    if (summary.total_score !== undefined && summary.total_score !== null) {
      return t("patientPortal.questionnaires.scoreSummary", { score: summary.total_score });
    }
    return null;
  }
  return line.length > 160 ? `${line.slice(0, 157)}…` : line;
}
