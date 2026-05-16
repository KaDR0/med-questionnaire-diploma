import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import AssignmentTurnedInRoundedIcon from "@mui/icons-material/AssignmentTurnedInRounded";
import RuleRoundedIcon from "@mui/icons-material/RuleRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";

import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import KpiCard from "../components/ui/KpiCard";
import EmptyState from "../components/ui/EmptyState";
import { DashboardSkeleton } from "../components/ui/LoadingSkeleton";

/**
 * Role-aware clinical dashboard.
 *
 * For both `doctor` and `chief_doctor` the page consumes the same `dashboard/stats/`
 * endpoint (which already filters payload server-side by role). The visual layout
 * differs only in tone of voice (chief overview vs. daily workspace) and in which
 * cards become clickable shortcuts (e.g. the pending-questionnaires KPI only links
 * to `/questionnaires/pending` for chief).
 */
function DashboardPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { user } = useAuth();
  const role = user?.role || "doctor";
  const isChief = role === "chief_doctor";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    // Reset loading/error state synchronously so we render a skeleton (not stale data)
    // while the request resolves; cancellation guard prevents races on unmount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    api
      .get("dashboard/stats/")
      .then((response) => {
        if (cancelled) return;
        setStats(response.data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.detail || t("dashboard.loadError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const displayName = useMemo(() => {
    if (!user) return "";
    return (
      (user.first_name && user.first_name.trim()) ||
      (user.last_name && user.last_name.trim()) ||
      user.username ||
      ""
    );
  }, [user]);

  const cards = useMemo(() => {
    const totalPatients = stats?.total_patients ?? 0;
    const completed = stats?.completed_assessments ?? 0;
    const pending = stats?.pending_questionnaires ?? 0;
    const highRisk = stats?.high_risk_patients ?? 0;

    return [
      {
        id: "patients",
        label: t("dashboard.totalPatients"),
        value: totalPatients,
        tone: "primary",
        icon: <PeopleAltRoundedIcon />,
        to: "/patients",
      },
      {
        id: "completed",
        label: t("dashboard.completedAssessments"),
        value: completed,
        tone: "success",
        icon: <AssignmentTurnedInRoundedIcon />,
      },
      {
        id: "pending",
        label: t("dashboard.pendingQuestionnaires"),
        value: pending,
        tone: pending > 0 ? "warning" : "info",
        icon: <RuleRoundedIcon />,
        to: isChief ? "/questionnaires/pending" : "/questionnaires/my",
        hint: pending > 0 ? t("dashboard.viewQueue") : undefined,
        emphasised: pending > 0,
      },
      {
        id: "highRisk",
        label: t("dashboard.highRiskPatients"),
        value: highRisk,
        tone: highRisk > 0 ? "error" : "success",
        icon: <WarningAmberRoundedIcon />,
        to: "/patients",
        hint: highRisk > 0 ? t("dashboard.attentionNeeded") : t("dashboard.allStable"),
        emphasised: highRisk > 0,
      },
    ];
  }, [stats, t, isChief]);

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
      questionnaire_session_created: t("dashboard.activityMap.legacyAuditEntry", { patientId: patientRef }),
      assessment_submitted: t("dashboard.activityMap.assessmentSubmitted", { patientId: patientRef }),
      public_questionnaire_completed: t("dashboard.activityMap.legacyAuditEntry", { patientId: patientRef }),
    };

    return labels[action] || t("dashboard.activityMap.defaultAction");
  };

  const actorLabel = (item) => item?.user_email || t("dashboard.systemActor");

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
    return <DashboardSkeleton />;
  }

  const recent = (stats?.recent_activity || []).slice(0, 8);
  const welcomeKey = isChief ? "dashboard.chiefWelcome" : "dashboard.welcomeBack";
  const tagline = isChief ? t("dashboard.roleChief") : t("dashboard.roleDoctor");

  return (
    <Box>
      <Box sx={{ mb: { xs: 2.5, md: 3 } }}>
        <Typography
          variant="overline"
          sx={{
            color: "text.secondary",
            letterSpacing: "0.08em",
            fontWeight: 700,
          }}
        >
          {t("dashboard.title")}
        </Typography>
        <Typography variant="h4" sx={{ mt: 0.5, mb: 0.5 }}>
          {displayName ? t(welcomeKey, { name: displayName }) : t("dashboard.title")}
        </Typography>
        <Typography color="text.secondary">{tagline}</Typography>
      </Box>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <Grid container spacing={2.25} sx={{ mb: 3 }}>
        {cards.map((card) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={card.id}>
            <KpiCard
              label={card.label}
              value={card.value}
              icon={card.icon}
              tone={card.tone}
              hint={card.hint}
              to={card.to}
              emphasised={card.emphasised}
            />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2.25}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Box
                    aria-hidden
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 999,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: "primary.dark",
                    }}
                  >
                    <HistoryRoundedIcon fontSize="small" />
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                      {t("dashboard.historyTitle")}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t("dashboard.historySubtitle")}
                    </Typography>
                  </Box>
                </Stack>
                {isChief ? (
                  <Button
                    component={Link}
                    to="/audit-log"
                    size="small"
                    variant="text"
                    endIcon={<ArrowForwardRoundedIcon fontSize="small" />}
                  >
                    {t("dashboard.viewAllActions")}
                  </Button>
                ) : null}
              </Stack>
              <Divider sx={{ my: 1.5 }} />
              {recent.length === 0 ? (
                <EmptyState
                  dense
                  title={t("dashboard.noData")}
                  description={t("dashboard.subtitle")}
                />
              ) : (
                <Stack divider={<Divider />} spacing={0}>
                  {recent.map((item) => (
                    <Stack
                      key={item.id}
                      spacing={0.25}
                      sx={{
                        py: 1.25,
                        "&:first-of-type": { pt: 0 },
                        "&:last-of-type": { pb: 0 },
                      }}
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
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                {t("navbar.patients")}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t("patients.dashboardText")}
              </Typography>

              <Stack spacing={1.25}>
                <Button
                  component={Link}
                  to="/patients"
                  variant="contained"
                  startIcon={<PeopleAltRoundedIcon />}
                  fullWidth
                >
                  {t("dashboard.viewPatients")}
                </Button>
                <Button
                  component={Link}
                  to="/questionnaires/my"
                  variant="outlined"
                  startIcon={<AssignmentTurnedInRoundedIcon />}
                  fullWidth
                >
                  {t("navbar.myQuestionnaires")}
                </Button>
                {isChief ? (
                  <Button
                    component={Link}
                    to="/questionnaires/pending"
                    variant="outlined"
                    startIcon={<RuleRoundedIcon />}
                    fullWidth
                  >
                    {t("navbar.pendingQuestionnaires")}
                  </Button>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default DashboardPage;
