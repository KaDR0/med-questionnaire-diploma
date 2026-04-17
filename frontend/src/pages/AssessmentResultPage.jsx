import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/axios";
import { useTranslation } from "react-i18next";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Button,
  Chip,
  Divider,
  Grid,
  Stack,
  Container,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import PageHeader from "../components/ui/PageHeader";
import SectionCard from "../components/ui/SectionCard";
import {
  translateFindingRecommendation,
  translateRiskEvidence,
  translateRiskLevel,
  translateRiskProblemCode,
} from "../utils/riskFindingLabels";

function AssessmentResultPage() {
  const { id, assessmentId } = useParams();
  const { t } = useTranslation();

  const [assessment, setAssessment] = useState(null);
  const [riskProfile, setRiskProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleDownloadPdf = async () => {
    try {
      const response = await api.get(`assessments/${assessmentId}/pdf/`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `assessment_${assessmentId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading PDF:", error);
    }
  };

  useEffect(() => {
    Promise.all([api.get(`assessments/${assessmentId}/`), api.get(`assessments/${assessmentId}/risk/`)])
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

  const formatDate = (value) => {
    if (!value) return t("common.noData");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const getScoreColor = (score) => {
    if (score >= 3) return "error";
    if (score >= 1) return "warning";
    return "success";
  };

  const getConclusionText = () => {
    if (!assessment) return t("common.noData");
    if (assessment.conclusion) return assessment.conclusion;
    if (assessment.total_score >= 3) return t("result.highRiskFallback");
    if (assessment.total_score >= 1) return t("result.mediumRiskFallback");
    return t("result.lowRiskFallback");
  };

  const interpretationTitle = assessment?.interpretation?.title || t("common.noData");
  const interpretationRecommendation = assessment?.interpretation?.recommendation || t("common.noData");
  const getLocalizedUrgency = (value) => {
    const normalized = String(value || "").toLowerCase();
    return t(`result.urgencyLevels.${normalized}`, { defaultValue: value || t("common.noData") });
  };
  const getLocalizedTriggerSign = (value) => {
    const key = `result.redFlagTriggers.${String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")}`;
    return t(key, { defaultValue: value || t("common.noData") });
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
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          bgcolor: "background.default",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!assessment) {
    return (
      <Container sx={{ py: 2 }}>
        <Typography>{t("result.notFound")}</Typography>
      </Container>
    );
  }

  const resolvedInterpretationTitle = interpretationTitle === t("common.noData")
    ? getConclusionText()
    : interpretationTitle;

  return (
    <Box sx={{ maxWidth: 1320, mx: "auto" }}>
      <PageHeader
        title={t("result.title")}
        subtitle={t("result.subtitle")}
        actions={
          <Stack direction="row" spacing={1}>
            <Chip label={`${t("result.assessmentId")}: ${assessment.id}`} color="primary" variant="outlined" />
            <Chip label={`${t("result.patientId")}: ${id}`} color="primary" variant="outlined" />
          </Stack>
        }
      />

        <Grid container spacing={2.5}>
          <Grid item xs={12} lg={4}>
            <Card sx={{ mb: 2.5, borderRadius: 4, border: "1px solid", borderColor: "divider" }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  {t("result.summary")}
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Box sx={{ display: "grid", gap: 1.5 }}>
                  <Typography>
                    <strong>{t("result.questionnaire")}:</strong>{" "}
                    {assessment.questionnaire_title ||
                      `Questionnaire #${assessment.questionnaire}`}
                  </Typography>

                  <Typography>
                    <strong>{t("result.date")}:</strong> {formatDate(assessment.created_at)}
                  </Typography>

                  <Typography>
                    <strong>{t("result.conclusion")}:</strong> {getConclusionText()}
                  </Typography>
                  <Typography>
                    <strong>{t("result.quality")}:</strong>{" "}
                    {assessment.quality_flag_label || t("common.noData")}
                    {assessment.completion_percent !== undefined
                      ? ` (${assessment.completion_percent}%)`
                      : ""}
                  </Typography>

                  <Typography>
                    <strong>{t("result.doctor")}:</strong>{" "}
                    {assessment.doctor_full_name || assessment.doctor_username || t("common.noData")}
                  </Typography>
                </Box>

                <Box sx={{ mt: 3 }}>
                  <Chip
                    label={`${t("result.totalScore")}: ${assessment.total_score}`}
                    color={getScoreColor(assessment.total_score)}
                    sx={{ fontSize: 16, py: 2.5 }}
                  />
                </Box>
              </CardContent>
            </Card>

            <Card sx={{ borderRadius: 4, border: "1px solid", borderColor: "divider" }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  {t("result.interpretation")}
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                  {resolvedInterpretationTitle}
                </Typography>
                <Typography color="text.secondary">{interpretationRecommendation}</Typography>
              </CardContent>
            </Card>

            <Card sx={{ mt: 2.5, borderRadius: 4, border: "1px solid", borderColor: "divider" }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  {t("result.navigation")}
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Stack spacing={1.5}>
                  <Button variant="outlined" fullWidth onClick={handleDownloadPdf}>
                    {t("result.downloadPdf")}
                  </Button>
                  <Button
                    component={Link}
                    to={`/patients/${id}`}
                    variant="contained"
                    fullWidth
                  >
                    {t("result.backToPatient")}
                  </Button>

                  <Button
                    component={Link}
                    to={`/patients/${id}/questionnaires`}
                    variant="outlined"
                    fullWidth
                  >
                    {t("result.openQuestionnaires")}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={8}>
            <Card sx={{ borderRadius: 4, border: "1px solid", borderColor: "divider" }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h5" gutterBottom>
                  {t("result.submittedAnswers")}
                </Typography>
                <Divider sx={{ mb: 2 }} />

                {!assessment.answers || assessment.answers.length === 0 ? (
                  <Typography color="text.secondary">
                    {t("result.noAnswers")}
                  </Typography>
                ) : (
                  <Grid container spacing={2}>
                    {assessment.answers.map((answer, index) => (
                      <Grid item xs={12} key={answer.id}>
                        <Card
                          variant="outlined"
                          sx={{
                            borderRadius: 4,
                            boxShadow: "none",
                            border: "1px solid",
                            borderColor: "divider",
                          }}
                        >
                          <CardContent>
                            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                              {index + 1}. {answer.question_text || `Question #${answer.question}`}
                            </Typography>

                            <Typography sx={{ mb: 1 }}>
                              <strong>{t("result.answer")}:</strong> {answer.value || t("common.noData")}
                            </Typography>

                            <Typography color="text.secondary">
                              <strong>{t("result.score")}:</strong> {answer.score}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </CardContent>
            </Card>

            <Card sx={{ mt: 2.5, borderRadius: 4, border: "1px solid", borderColor: "divider" }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h5" gutterBottom>
                  {t("result.riskSummaryTitle")}
                </Typography>
                <Divider sx={{ mb: 2 }} />

                {!riskProfile ? (
                  <Typography color="text.secondary">{t("common.noData")}</Typography>
                ) : (
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                      <Chip
                        label={`${t("result.riskLevel")}: ${translateRiskLevel(t, riskProfile.overall_risk_level || "low")}`}
                        color="primary"
                      />
                      <Chip label={`${t("result.problemsDetected")}: ${(riskProfile.findings || []).length}`} variant="outlined" />
                    </Stack>
                    {(riskProfile.findings || []).map((finding) => (
                      <Card key={finding.id} variant="outlined" sx={{ borderRadius: 3 }}>
                        <CardContent>
                          <Typography variant="subtitle1" fontWeight={700}>
                            {translateRiskProblemCode(t, finding.problem_code)}
                          </Typography>
                          <Typography sx={{ my: 1 }}>
                            <strong>{t("result.evidence")}:</strong>{" "}
                            {(finding.evidence || []).map((line) => translateRiskEvidence(t, line)).join("; ")}
                          </Typography>
                          {finding.recommendation ? (
                            <Typography color="text.secondary">
                              <strong>{t("result.recommendations")}:</strong>{" "}
                              {(() => {
                                const loc = translateFindingRecommendation(t, finding.recommendation);
                                return `${loc.preliminary} ${loc.nextSteps}`.trim();
                              })()}
                            </Typography>
                          ) : null}
                        </CardContent>
                      </Card>
                    ))}
                    {(riskProfile.red_flags || []).map((flag) => (
                      <Card
                        key={flag.id}
                        variant="outlined"
                        sx={(theme) => ({
                          borderRadius: 3,
                          border: `1px solid ${alpha(theme.palette.error.main, 0.4)}`,
                          bgcolor: alpha(theme.palette.error.main, 0.04),
                        })}
                      >
                        <CardContent>
                          <Typography variant="subtitle1" fontWeight={700} color="error.main">
                            {t("result.redFlag")} - {getLocalizedUrgency(flag.urgency_level)}
                          </Typography>
                          <Typography>{(flag.trigger_signs || []).map((item) => getLocalizedTriggerSign(item)).join(", ")}</Typography>
                          <Typography color="text.secondary">{getLocalizedRedFlagAction(flag.recommended_action)}</Typography>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
    </Box>
  );
}

export default AssessmentResultPage;