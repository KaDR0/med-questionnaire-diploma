import { useEffect, useState } from "react";
import { useParams, Link as RouterLink, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import AssignmentTurnedInRoundedIcon from "@mui/icons-material/AssignmentTurnedInRounded";
import ReportProblemRoundedIcon from "@mui/icons-material/ReportProblemRounded";
import ScoreboardRoundedIcon from "@mui/icons-material/ScoreboardRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";

import api from "../api/axios";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import useToast from "../utils/useToast";
import PageHeader from "../components/ui/PageHeader";
import KpiCard from "../components/ui/KpiCard";
import { CardSkeleton } from "../components/ui/LoadingSkeleton";
import EmptyState from "../components/ui/EmptyState";
import {
  translateFindingRecommendation,
  translateRiskEvidence,
  translateRiskLevel,
  translateRiskProblemCode,
} from "../utils/riskFindingLabels";
import {
  getLocalizedAssessmentSummaryLine,
  localizeInterpretationRecommendation,
  localizeInterpretationTitle,
  normalizeInterpretationKey,
} from "../utils/assessmentInterpretation";

function AssessmentResultPage() {
  const { id, assessmentId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const theme = useTheme();
  const isPatientViewer = user?.role === "patient";

  const [assessment, setAssessment] = useState(null);
  const [riskProfile, setRiskProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      const response = await api.get(`assessments/${assessmentId}/pdf/`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(
        new Blob([response.data], { type: "application/pdf" })
      );
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `assessment_${assessmentId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error(t("result.downloadPdf"));
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    Promise.all([
      api.get(`assessments/${assessmentId}/`),
      api.get(`assessments/${assessmentId}/risk/`),
    ])
      .then(([assessmentResponse, riskResponse]) => {
        setAssessment(assessmentResponse.data);
        setRiskProfile(riskResponse.data);
      })
      .catch((error) => {
        console.error("Error loading assessment:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [assessmentId]);

  useEffect(() => {
    if (!assessment || !isPatientViewer || assessment.patient == null) return;
    if (String(assessment.patient) !== String(id)) {
      navigate(`/patient/assessments/${assessment.patient}/${assessmentId}`, {
        replace: true,
      });
    }
  }, [assessment, assessmentId, id, isPatientViewer, navigate]);

  const formatDate = (value) => {
    if (!value) return t("common.noData");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const getScoreTone = (score) => {
    if (score >= 3) return "error";
    if (score >= 1) return "warning";
    return "success";
  };

  const getConclusionText = () => {
    if (!assessment) return t("common.noData");
    return getLocalizedAssessmentSummaryLine(t, assessment);
  };

  const interpretationTitle = localizeInterpretationTitle(t, assessment);
  const interpretationRecommendation = localizeInterpretationRecommendation(
    t,
    assessment
  );
  const getLocalizedUrgency = (value) => {
    const normalized = String(value || "").toLowerCase();
    return t(`result.urgencyLevels.${normalized}`, {
      defaultValue: value || t("common.noData"),
    });
  };
  const getLocalizedTriggerSign = (value) => {
    const key = `result.redFlagTriggers.${String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")}`;
    return t(key, { defaultValue: value || t("common.noData") });
  };
  const getLocalizedAnswerValue = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (["yes", "true", "1"].includes(normalized)) return t("form.yes");
    if (["no", "false", "0"].includes(normalized)) return t("form.no");
    return value || t("common.noData");
  };
  const getLocalizedQualityLabel = () => {
    const qualityKey = normalizeInterpretationKey(assessment?.quality_flag);
    if (!qualityKey)
      return assessment?.quality_flag_label || t("common.noData");
    return t(`result.qualityFlags.${qualityKey}`, {
      defaultValue: assessment?.quality_flag_label || qualityKey,
    });
  };
  const getLocalizedRedFlagAction = (value) => {
    const key = `result.redFlagActions.${String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")}`;
    return t(key, { defaultValue: value || t("common.noData") });
  };

  if (loading) {
    return (
      <Box sx={{ maxWidth: 1320, mx: "auto" }}>
        <PageHeader title={t("result.title")} subtitle={t("result.subtitle")} />
        <Grid container spacing={2.25} sx={{ mb: 2.5 }}>
          {[0, 1, 2, 3].map((i) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
              <CardSkeleton lines={2} />
            </Grid>
          ))}
        </Grid>
        <CardSkeleton lines={6} />
      </Box>
    );
  }

  if (!assessment) {
    return (
      <Container sx={{ py: 2 }}>
        <PageHeader title={t("result.title")} />
        <Card>
          <CardContent>
            <EmptyState
              icon={
                <HelpOutlineRoundedIcon
                  sx={{ fontSize: 48, color: "text.disabled" }}
                />
              }
              title={t("result.notFound")}
            />
          </CardContent>
        </Card>
      </Container>
    );
  }

  const resolvedInterpretationTitle =
    interpretationTitle === t("common.noData")
      ? getConclusionText()
      : interpretationTitle;

  const scoreTone = getScoreTone(assessment.total_score || 0);
  const findings = riskProfile?.findings || [];
  const redFlags = riskProfile?.red_flags || [];
  const riskLevel = riskProfile?.overall_risk_level || "low";

  const backButton = (
    <Button
      component={RouterLink}
      to={
        isPatientViewer ? "/patient/questionnaires" : `/patients/${id}`
      }
      variant="outlined"
      startIcon={<ArrowBackRoundedIcon />}
    >
      {isPatientViewer ? t("result.backToMyQuestionnaires") : t("result.backToPatient")}
    </Button>
  );

  return (
    <Box sx={{ maxWidth: 1320, mx: "auto" }}>
      <PageHeader
        title={t("result.title")}
        subtitle={t("result.subtitle")}
        actions={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<DownloadRoundedIcon />}
              onClick={handleDownloadPdf}
              disabled={downloading}
            >
              {t("result.downloadPdf")}
            </Button>
            {backButton}
          </Stack>
        }
      />

      <Grid container spacing={2.25} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label={t("result.totalScore")}
            value={assessment.total_score ?? 0}
            tone={scoreTone}
            emphasised={scoreTone !== "success"}
            icon={<ScoreboardRoundedIcon />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label={t("result.riskLevel")}
            value={translateRiskLevel(t, riskLevel)}
            tone={
              riskLevel === "high"
                ? "error"
                : riskLevel === "moderate"
                  ? "warning"
                  : "success"
            }
            emphasised={riskLevel === "high"}
            icon={<ReportProblemRoundedIcon />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label={t("result.problemsDetected")}
            value={findings.length}
            tone={findings.length > 0 ? "warning" : "info"}
            icon={<FactCheckRoundedIcon />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label={t("result.quality")}
            value={
              assessment.completion_percent !== undefined
                ? `${assessment.completion_percent}%`
                : getLocalizedQualityLabel()
            }
            tone="primary"
            icon={<AssignmentTurnedInRoundedIcon />}
            hint={getLocalizedQualityLabel()}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={2.25}>
            <Card>
              <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                <Typography variant="h6" gutterBottom>
                  {t("result.summary")}
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={1.25}>
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}
                    >
                      {t("result.questionnaire")}
                    </Typography>
                    <Typography variant="body1">
                      {assessment.questionnaire_title ||
                        t("result.questionnaireFallback", {
                          id: assessment.questionnaire,
                        })}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}
                    >
                      {t("result.date")}
                    </Typography>
                    <Typography variant="body1">
                      {formatDate(assessment.created_at)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}
                    >
                      {t("result.conclusion")}
                    </Typography>
                    <Typography variant="body1">{getConclusionText()}</Typography>
                  </Box>
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}
                    >
                      {t("result.doctor")}
                    </Typography>
                    <Typography variant="body1">
                      {assessment.doctor_full_name ||
                        assessment.doctor_username ||
                        t("common.noData")}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card
              sx={{
                borderLeft: "3px solid",
                borderLeftColor: `${scoreTone}.main`,
                background: `linear-gradient(135deg, ${alpha(
                  theme.palette[scoreTone].main,
                  0.05
                )} 0%, ${alpha(theme.palette.background.paper, 0)} 70%)`,
              }}
            >
              <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="h6">{t("result.interpretation")}</Typography>
                  <Chip
                    size="small"
                    label={translateRiskLevel(t, riskLevel)}
                    color={scoreTone}
                    sx={{ fontWeight: 700 }}
                  />
                </Stack>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                  {resolvedInterpretationTitle}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  {interpretationRecommendation}
                </Typography>
              </CardContent>
            </Card>

            <Card>
              <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                <Typography variant="h6" gutterBottom>
                  {t("result.navigation")}
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={1.25}>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadRoundedIcon />}
                    onClick={handleDownloadPdf}
                    disabled={downloading}
                    fullWidth
                  >
                    {t("result.downloadPdf")}
                  </Button>
                  {isPatientViewer ? (
                    <Button
                      component={RouterLink}
                      to="/patient/questionnaires"
                      variant="contained"
                      fullWidth
                    >
                      {t("result.backToMyQuestionnaires")}
                    </Button>
                  ) : (
                    <>
                      <Button
                        component={RouterLink}
                        to={`/patients/${id}`}
                        variant="contained"
                        fullWidth
                      >
                        {t("result.backToPatient")}
                      </Button>
                      <Button
                        component={RouterLink}
                        to={`/patients/${id}/questionnaires`}
                        variant="outlined"
                        fullWidth
                      >
                        {t("result.openQuestionnaires")}
                      </Button>
                    </>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 8 }}>
          <Stack spacing={2.5}>
            {redFlags.length > 0 ? (
              <Alert
                severity="error"
                icon={<ReportProblemRoundedIcon />}
                sx={{ fontWeight: 600 }}
              >
                {t("result.redFlag")} · {redFlags.length}
              </Alert>
            ) : null}

            <Card>
              <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                <Typography variant="h6" gutterBottom>
                  {t("result.riskSummaryTitle")}
                </Typography>
                <Divider sx={{ mb: 2 }} />

                {!riskProfile ? (
                  <Typography color="text.secondary">
                    {t("common.noData")}
                  </Typography>
                ) : (
                  <Stack spacing={2}>
                    {findings.length === 0 && redFlags.length === 0 ? (
                      <EmptyState
                        dense
                        title={t("common.noData")}
                        description={t("result.problemsDetected") + ": 0"}
                      />
                    ) : null}

                    {findings.map((finding) => (
                      <Card key={finding.id} variant="outlined" sx={{ boxShadow: "none" }}>
                        <CardContent sx={{ p: 2.25 }}>
                          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                            {translateRiskProblemCode(t, finding.problem_code)}
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            <Box component="span" sx={{ fontWeight: 600 }}>
                              {t("result.evidence")}:
                            </Box>{" "}
                            {(finding.evidence || [])
                              .map((line) => translateRiskEvidence(t, line))
                              .join("; ")}
                          </Typography>
                          {finding.recommendation ? (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ lineHeight: 1.7 }}
                            >
                              <Box component="span" sx={{ fontWeight: 600 }}>
                                {t("result.recommendations")}:
                              </Box>{" "}
                              {(() => {
                                const loc = translateFindingRecommendation(
                                  t,
                                  finding.recommendation
                                );
                                return `${loc.preliminary} ${loc.nextSteps}`.trim();
                              })()}
                            </Typography>
                          ) : null}
                        </CardContent>
                      </Card>
                    ))}

                    {redFlags.map((flag) => (
                      <Card
                        key={flag.id}
                        variant="outlined"
                        sx={{
                          borderColor: alpha(theme.palette.error.main, 0.4),
                          bgcolor: alpha(theme.palette.error.main, 0.04),
                          boxShadow: "none",
                        }}
                      >
                        <CardContent sx={{ p: 2.25 }}>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                            <ReportProblemRoundedIcon color="error" fontSize="small" />
                            <Typography
                              variant="subtitle1"
                              fontWeight={700}
                              color="error.main"
                            >
                              {t("result.redFlag")} · {getLocalizedUrgency(flag.urgency_level)}
                            </Typography>
                          </Stack>
                          <Typography variant="body2" sx={{ mb: 0.5 }}>
                            {(flag.trigger_signs || [])
                              .map((item) => getLocalizedTriggerSign(item))
                              .join(", ")}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {getLocalizedRedFlagAction(flag.recommended_action)}
                          </Typography>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                <Typography variant="h6" gutterBottom>
                  {t("result.submittedAnswers")}
                </Typography>
                <Divider sx={{ mb: 2 }} />

                {!assessment.answers || assessment.answers.length === 0 ? (
                  <EmptyState dense title={t("result.noAnswers")} />
                ) : (
                  <Stack spacing={1.5}>
                    {assessment.answers.map((answer, index) => (
                      <Box
                        key={answer.id}
                        sx={{
                          p: 2,
                          borderRadius: 1,
                          border: "1px solid",
                          borderColor: "divider",
                          bgcolor: "background.default",
                        }}
                      >
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1.5}
                          alignItems={{ sm: "flex-start" }}
                        >
                          <Box
                            sx={{
                              width: 28,
                              height: 28,
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              color: "primary.main",
                              fontWeight: 700,
                              fontSize: 13,
                            }}
                          >
                            {index + 1}
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                              variant="subtitle2"
                              sx={{ fontWeight: 600, mb: 0.5 }}
                            >
                              {answer.question_text ||
                                t("result.questionFallback", { id: answer.question })}
                            </Typography>
                            <Stack
                              direction="row"
                              spacing={1}
                              useFlexGap
                              sx={{ flexWrap: "wrap" }}
                            >
                              <Chip
                                size="small"
                                label={`${t("result.answer")}: ${getLocalizedAnswerValue(answer.value)}`}
                                variant="outlined"
                              />
                              <Chip
                                size="small"
                                label={`${t("result.score")}: ${answer.score}`}
                                color={answer.score > 0 ? "warning" : "default"}
                                variant={answer.score > 0 ? "filled" : "outlined"}
                              />
                            </Stack>
                          </Box>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}

export default AssessmentResultPage;
