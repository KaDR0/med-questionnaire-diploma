import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Card, CardContent, Chip, CircularProgress, Grid, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import api from "../api/axios";
import { useTranslation } from "react-i18next";

function DashboardPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);

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
            {t("dashboard.recentActivity")}
          </Typography>
          {(stats?.recent_activity || []).length === 0 ? (
            <Stack spacing={0.5}>
              <Typography color="text.secondary">{t("dashboard.noData")}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t("dashboard.subtitle")}
              </Typography>
            </Stack>
          ) : (
            <Stack spacing={1}>
              {stats.recent_activity.map((item) => (
                <Stack
                  key={item.id}
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ py: 0.6, borderBottom: "1px solid", borderColor: "divider" }}
                >
                  <Chip size="small" label={item.object_type} variant="outlined" />
                  <Typography variant="body2">
                    {item.action} #{item.object_id || "-"}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default DashboardPage;
