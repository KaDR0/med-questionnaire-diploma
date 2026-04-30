import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Grid, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import api from "../api/axios";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function DashboardPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);
  const isChiefDoctor = user?.role === "chief_doctor";

  useEffect(() => {
    api
      .get("dashboard/stats/")
      .then((response) => setStats(response.data))
      .catch((err) => setError(err?.response?.data?.detail || t("dashboard.loadError")))
      .finally(() => setLoading(false));
  }, [t]);

  const cards = useMemo(() => {
    const highRisk = stats?.high_risk_patients ?? 0;
    return [
      { label: t("dashboard.totalPatients"), value: stats?.total_patients ?? 0, accent: "primary.main" },
      { label: t("dashboard.completedAssessments"), value: stats?.completed_assessments ?? 0, accent: "success.main" },
      { label: t("dashboard.pendingQuestionnaires"), value: stats?.pending_questionnaires ?? 0, accent: "warning.main" },
      {
        label: t("dashboard.highRiskPatients"),
        value: highRisk,
        accent: "error.main",
        chipColor: highRisk > 0 ? "warning" : "success",
        chipLabel: highRisk > 0 ? t("detail.statusOptions.attention") : t("detail.statusOptions.stable"),
      },
    ];
  }, [stats, t]);

  const actionLabel = (item) => {
    const action = String(item?.action || "");
    const objectId = item?.object_id || "";
    const details = item?.details || {};
    const patientId = details?.patient_id || "";

    const byId = objectId ? ` #${objectId}` : "";
    const patientRef = patientId ? ` #${patientId}` : "";

    const labels = {
      patient_created: t("dashboard.activityMap.patientCreated", { id: byId }),
      questionnaire_created: t("dashboard.activityMap.questionnaireCreated", { id: byId }),
      questionnaire_archived: t("dashboard.activityMap.questionnaireArchived", { id: byId }),
      questionnaire_restored: t("dashboard.activityMap.questionnaireRestored", { id: byId }),
      questionnaire_submitted_for_approval: t("dashboard.activityMap.questionnaireSubmitted", { id: byId }),
      questionnaire_approved: t("dashboard.activityMap.questionnaireApproved", { id: byId }),
      questionnaire_rejected: t("dashboard.activityMap.questionnaireRejected", { id: byId }),
      questionnaire_changes_requested: t("dashboard.activityMap.questionnaireChangesRequested", { id: byId }),
      questionnaire_session_created: t("dashboard.activityMap.questionnaireSessionCreated", { patientId: patientRef }),
      assessment_submitted: t("dashboard.activityMap.assessmentSubmitted", { patientId: patientRef }),
      public_questionnaire_completed: t("dashboard.activityMap.publicQuestionnaireCompleted", { patientId: patientRef }),
    };

    return labels[action] || t("dashboard.activityMap.defaultAction");
  };

  const actorLabel = (item) => {
    if (item?.user_email) return item.user_email;
    return t("dashboard.systemActor");
  };

  const timeLabel = (value) => {
    if (!value) return t("dashboard.timeUnknown");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t("dashboard.timeUnknown");
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startYesterday = new Date(startToday);
    startYesterday.setDate(startYesterday.getDate() - 1);
    const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (date >= startToday) return `${t("dashboard.today")} ${time}`;
    if (date >= startYesterday && date < startToday) return `${t("dashboard.yesterday")} ${time}`;
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        {t("dashboard.title")}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {t("dashboard.subtitle")}
      </Typography>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      <Grid container spacing={2.25}>
        {cards.map((card) => (
          <Grid item xs={12} sm={6} md={3} key={card.label}>
            <Card
              sx={{
                height: "100%",
                border: "1px solid",
                borderColor: alpha(theme.palette[card.chipColor === "warning" ? "warning" : "primary"].main, 0.16),
              }}
            >
              <CardContent sx={{ p: 2.25 }}>
                <Typography color="text.secondary" variant="body2" sx={{ mb: 0.75 }}>
                  {card.label}
                </Typography>
                <Typography variant="h4" sx={{ mt: 0.25, mb: 1.25 }}>
                  {card.value}
                </Typography>
                {card.chipLabel ? <Chip size="small" color={card.chipColor} label={card.chipLabel} variant="outlined" /> : null}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Card
        sx={{
          mt: 3,
          border: "1px solid",
          borderColor: alpha(theme.palette.primary.main, 0.16),
          background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.04)} 0%, ${theme.palette.background.paper} 52%)`,
        }}
      >
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700 }}>
            {t("dashboard.historyTitle")}
          </Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
            {t("dashboard.historySubtitle")}
          </Typography>
          {(stats?.recent_activity || []).length === 0 ? (
            <Stack spacing={0.5}>
              <Typography color="text.secondary">{t("dashboard.noData")}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t("dashboard.subtitle")}
              </Typography>
            </Stack>
          ) : (
            <Stack spacing={1.25}>
              {stats.recent_activity.slice(0, 8).map((item) => (
                <Stack
                  key={item.id}
                  spacing={0.25}
                  sx={{ py: 0.9, borderBottom: "1px solid", borderColor: "divider" }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {actionLabel(item)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t("dashboard.activityBy", {
                      actor: actorLabel(item),
                      time: timeLabel(item.created_at),
                    })}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
          {isChiefDoctor ? (
            <Box sx={{ mt: 2 }}>
              <Button component={Link} to="/audit-log" variant="text" size="small">
                {t("dashboard.viewAllActions")}
              </Button>
            </Box>
          ) : null}
        </CardContent>
      </Card>
    </Box>
  );
}

export default DashboardPage;
