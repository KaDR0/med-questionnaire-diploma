import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import AssignmentTurnedInRoundedIcon from "@mui/icons-material/AssignmentTurnedInRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import ScienceRoundedIcon from "@mui/icons-material/ScienceRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import LocalHospitalRoundedIcon from "@mui/icons-material/LocalHospitalRounded";
import EventAvailableRoundedIcon from "@mui/icons-material/EventAvailableRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import HealthAndSafetyRoundedIcon from "@mui/icons-material/HealthAndSafetyRounded";
import MonitorHeartRoundedIcon from "@mui/icons-material/MonitorHeartRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import CallRoundedIcon from "@mui/icons-material/CallRounded";
import PlayCircleFilledRoundedIcon from "@mui/icons-material/PlayCircleFilledRounded";

import api from "../api/axios";
import { useTranslation } from "react-i18next";
import { localizedAssignmentSummaryPreview } from "../utils/assessmentInterpretation";

import PageHeader from "../components/ui/PageHeader";
import KpiCard from "../components/ui/KpiCard";
import EmptyState from "../components/ui/EmptyState";
import DataTable from "../components/ui/DataTable";
import { CardSkeleton } from "../components/ui/LoadingSkeleton";

/** True when due_date (YYYY-MM-DD) is strictly before today in local calendar. */
function isAssignmentDuePast(dueStr) {
  if (!dueStr) return false;
  const parts = String(dueStr).split("-");
  if (parts.length !== 3) return false;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return false;
  const due = new Date(y, m - 1, d);
  const t = new Date();
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return due < today;
}

function PatientPortalPage({ section = "home" }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [patient, setPatient] = useState(null);
  const [labs, setLabs] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [doctorOrder, setDoctorOrder] = useState(null);
  const [riskProfile, setRiskProfile] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [engineRecommendations, setEngineRecommendations] = useState(null);

  const patientId = patient?.id;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const patientsRes = await api.get("patients/");
        const myPatient = Array.isArray(patientsRes.data) ? patientsRes.data[0] : null;
        if (!myPatient?.id) {
          setPatient(null);
          return;
        }
        setPatient(myPatient);

        const [labsRes, assessmentsRes, orderRes, riskRes, assignmentsRes] = await Promise.all([
          api.get(`patients/${myPatient.id}/labs/?period=all`),
          api.get(`patients/${myPatient.id}/assessments/`),
          api.get(`patients/${myPatient.id}/doctor-order/`),
          api.get(`patients/${myPatient.id}/risk-profile/`),
          api.get("patient/questionnaire-assignments/"),
        ]);
        setLabs(Array.isArray(labsRes.data) ? labsRes.data : []);
        setAssessments(Array.isArray(assessmentsRes.data) ? assessmentsRes.data : []);
        setDoctorOrder(orderRes.data || null);
        setRiskProfile(riskRes.data || null);
        setAssignments(Array.isArray(assignmentsRes.data) ? assignmentsRes.data : []);
      } catch (e) {
        setError(e?.response?.data?.error || t("patientPortal.loadError"));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [t]);

  useEffect(() => {
    if (!patientId || section !== "recommendations") return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`patients/${patientId}/recommendations/`);
        if (!cancelled) setEngineRecommendations(data);
      } catch {
        if (!cancelled) setEngineRecommendations(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId, section]);

  const notifications = useMemo(() => {
    const records = [];
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * oneDayMs;

    const pushRecord = ({ key, title, text, date, importance = "normal" }) => {
      let status = "viewed";
      if (date) {
        const ts = Date.parse(date);
        if (!Number.isNaN(ts) && now - ts <= sevenDaysMs) {
          status = "new";
        }
      }
      records.push({
        key,
        title,
        text,
        date: date || t("patientPortal.none"),
        status,
        importance,
      });
    };

    if (patient?.next_visit_date) {
      pushRecord({
        key: "upcoming-visit",
        title: t("patientPortal.notifications.upcomingVisitTitle"),
        text: t("patientPortal.notifications.upcomingVisitText", { date: patient.next_visit_date }),
        date: patient.next_visit_date,
        importance: "normal",
      });
    }

    if (!assessments.length) {
      pushRecord({
        key: "questionnaire-pending",
        title: t("patientPortal.notifications.questionnaireTitle"),
        text: t("patientPortal.notifications.questionnaireText"),
        date: null,
        importance: "normal",
      });
    } else {
      pushRecord({
        key: "questionnaire-latest",
        title: t("patientPortal.notifications.lastQuestionnaireTitle"),
        text: t("patientPortal.notifications.lastQuestionnaireText", {
          date: assessments[0]?.created_at || "-",
        }),
        date: assessments[0]?.created_at || null,
        importance: "normal",
      });
    }

    if (labs.length) {
      pushRecord({
        key: "new-labs",
        title: t("patientPortal.notifications.newLabsTitle"),
        text: t("patientPortal.notifications.newLabsText", { date: labs[0]?.date || "-" }),
        date: labs[0]?.date || null,
        importance: "normal",
      });
    }

    if ((doctorOrder?.order_text || "").trim()) {
      pushRecord({
        key: "recommendations",
        title: t("patientPortal.notifications.newRecommendationsTitle"),
        text: t("patientPortal.notifications.newRecommendationsText"),
        date: doctorOrder?.updated_at || null,
        importance: "normal",
      });
    }

    const flags = riskProfile?.red_flags || [];
    for (const [index, flag] of flags.entries()) {
      pushRecord({
        key: `risk-${index}`,
        title: t("patientPortal.notifications.riskTitle"),
        text: flag?.message || flag?.title || t("patientPortal.notifications.riskTextFallback"),
        date: riskProfile?.created_at || null,
        importance: "high",
      });
    }

    return records.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  }, [patient?.next_visit_date, assessments, labs, doctorOrder, riskProfile, t]);

  const latestLabDate = labs[0]?.date || null;
  const latestAssessmentDate = assessments[0]?.created_at || null;
  const hasRecommendations = Boolean((doctorOrder?.order_text || "").trim());
  const riskFlagsCount = Array.isArray(riskProfile?.red_flags) ? riskProfile.red_flags.length : 0;
  const hasUpcomingVisit = Boolean(patient?.next_visit_date);

  const labRows = useMemo(() => {
    const rows = [];
    for (const lab of labs) {
      for (const value of lab?.values || []) {
        rows.push({
          id: `${lab.id}-${value.id}`,
          date: lab?.date || "-",
          indicator: value?.indicator_name || "-",
          unit: value?.indicator_unit || "",
          value: value?.value,
          minNorm: value?.min_norm,
          maxNorm: value?.max_norm,
          status: value?.status || "normal",
          statusText: value?.status_text || t("patientPortal.labs.status.normal"),
        });
      }
    }
    return rows;
  }, [labs, t]);

  const openAssignmentsCount = useMemo(
    () =>
      assignments.filter(
        (a) =>
          (a.status === "assigned" || a.status === "in_progress") && !isAssignmentDuePast(a.due_date)
      ).length,
    [assignments]
  );

  const ongoingAssignments = useMemo(
    () =>
      assignments.filter((a) =>
        ["assigned", "in_progress", "expired", "cancelled"].includes(a.status)
      ),
    [assignments]
  );

  const completedAssignments = useMemo(
    () => assignments.filter((a) => a.status === "completed"),
    [assignments]
  );

  const newNotificationsCount = useMemo(
    () => notifications.filter((n) => n.status === "new").length,
    [notifications]
  );

  const formatPortalDateTime = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  };

  const formatPortalDateOnly = (value) => {
    if (!value) return "—";
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString();
  };

  const assignmentStatusLabel = (row) =>
    t(`patientPortal.assignmentStatus.${row.status}`, {
      defaultValue: row.status_label || row.status,
    });

  const assignmentOngoingStatusChip = (row) => {
    const label = assignmentStatusLabel(row);
    const s = row?.status;
    const color =
      s === "assigned"
        ? "primary"
        : s === "in_progress"
          ? "info"
          : s === "expired"
            ? "warning"
            : s === "cancelled"
              ? "default"
              : "default";
    return <Chip size="small" label={label} color={color} variant="outlined" sx={{ fontWeight: 600 }} />;
  };

  const recommendationSections = useMemo(() => {
    const sections = {
      general: [],
      monitor: [],
      repeat: [],
      contact: [],
    };

    const addUnique = (target, text) => {
      if (!text) return;
      if (!target.includes(text)) {
        target.push(text);
      }
    };

    const rawDoctorOrder = (doctorOrder?.order_text || "").trim();
    if (rawDoctorOrder) {
      for (const line of rawDoctorOrder.split("\n")) {
        const clean = line.replace(/^[\s\-*•]+/, "").trim();
        if (clean) {
          addUnique(sections.general, clean);
        }
      }
    }

    const abnormalRows = labRows.filter((row) => row.status === "above" || row.status === "below");
    const abnormalIndicators = [...new Set(abnormalRows.map((row) => row.indicator).filter(Boolean))];
    for (const indicator of abnormalIndicators) {
      addUnique(sections.monitor, t("patientPortal.recommendations.monitorIndicator", { indicator }));
      addUnique(sections.repeat, t("patientPortal.recommendations.repeatIndicator", { indicator }));
    }

    if (!abnormalIndicators.length && labRows.length) {
      addUnique(sections.general, t("patientPortal.recommendations.labsStable"));
    }
    if (!labRows.length) {
      addUnique(sections.repeat, t("patientPortal.recommendations.repeatNoLabs"));
    }

    const findings = Array.isArray(riskProfile?.findings) ? riskProfile.findings : [];
    for (const finding of findings.slice(0, 5)) {
      addUnique(sections.monitor, finding?.message || finding?.title || finding?.description || "");
    }

    const redFlags = Array.isArray(riskProfile?.red_flags) ? riskProfile.red_flags : [];
    for (const redFlag of redFlags.slice(0, 5)) {
      addUnique(
        sections.contact,
        redFlag?.message || redFlag?.title || t("patientPortal.recommendations.contactRiskFlag")
      );
    }

    if (openAssignmentsCount) {
      addUnique(
        sections.monitor,
        t("patientPortal.recommendations.pendingAssignments", { count: openAssignmentsCount })
      );
    }
    if (!assessments.length) {
      addUnique(sections.repeat, t("patientPortal.recommendations.repeatQuestionnaire"));
    }

    if (patient?.next_visit_date) {
      addUnique(
        sections.contact,
        t("patientPortal.recommendations.upcomingVisit", { date: patient.next_visit_date })
      );
    } else {
      addUnique(sections.contact, t("patientPortal.recommendations.planVisit"));
    }

    if (!sections.general.length) addUnique(sections.general, t("patientPortal.recommendations.defaultGeneral"));
    if (!sections.monitor.length) addUnique(sections.monitor, t("patientPortal.recommendations.defaultMonitor"));
    if (!sections.repeat.length) addUnique(sections.repeat, t("patientPortal.recommendations.defaultRepeat"));
    if (!sections.contact.length) addUnique(sections.contact, t("patientPortal.recommendations.defaultContact"));

    return sections;
  }, [
    doctorOrder?.order_text,
    labRows,
    riskProfile,
    openAssignmentsCount,
    assessments.length,
    patient?.next_visit_date,
    t,
  ]);

  const statusItems = useMemo(() => {
    const items = [];
    if (hasRecommendations) items.push(t("patientPortal.status.newRecommendations"));
    if (openAssignmentsCount) {
      items.push(t("patientPortal.status.questionnaireAssignedPending"));
    } else if (!assessments.length) {
      items.push(t("patientPortal.status.questionnairePending"));
    }
    if (hasUpcomingVisit) items.push(t("patientPortal.status.upcomingVisit", { date: patient?.next_visit_date }));
    if (!items.length) items.push(t("patientPortal.status.noNewNotifications"));
    return items;
  }, [
    hasRecommendations,
    assessments.length,
    hasUpcomingVisit,
    patient?.next_visit_date,
    openAssignmentsCount,
    t,
  ]);

  const todoItems = useMemo(() => {
    const items = [];
    if (openAssignmentsCount) items.push(t("patientPortal.todo.takeAssignedQuestionnaire"));
    if (hasRecommendations) items.push(t("patientPortal.todo.reviewRecommendations"));
    if (latestLabDate) items.push(t("patientPortal.todo.reviewLabs", { date: latestLabDate }));
    if (hasUpcomingVisit) items.push(t("patientPortal.todo.prepareVisit", { date: patient?.next_visit_date }));
    if (!items.length) items.push(t("patientPortal.todo.noActions"));
    return items;
  }, [
    openAssignmentsCount,
    hasRecommendations,
    latestLabDate,
    hasUpcomingVisit,
    patient?.next_visit_date,
    t,
  ]);

  const firstActionableAssignment = useMemo(() => {
    return ongoingAssignments.find(
      (row) =>
        (row.status === "assigned" || row.status === "in_progress") &&
        !isAssignmentDuePast(row.due_date)
    );
  }, [ongoingAssignments]);

  const heroPrimaryAction = useMemo(() => {
    if (firstActionableAssignment && patientId) {
      return {
        label: t("patientPortal.heroCtaTake"),
        to: `/patient/questionnaires/${patientId}/${firstActionableAssignment.questionnaire}`,
        icon: <PlayCircleFilledRoundedIcon />,
      };
    }
    if (labs.length) {
      return {
        label: t("patientPortal.heroCtaLabs"),
        to: "/patient/labs",
        icon: <ScienceRoundedIcon />,
      };
    }
    return null;
  }, [firstActionableAssignment, patientId, labs.length, t]);

  if (loading) {
    return (
      <Box>
        <CardSkeleton />
        <Grid container spacing={2.25} sx={{ mb: 2.5 }}>
          {[0, 1, 2, 3].map((idx) => (
            <Grid key={idx} item xs={12} sm={6} md={3}>
              <CardSkeleton />
            </Grid>
          ))}
        </Grid>
        <CardSkeleton />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!patientId) {
    return (
      <Box>
        <PageHeader title={t("patientPortal.title")} />
        <EmptyState
          title={t("patientPortal.noPatientCard")}
          description={t("patientPortal.headers.home.subtitle")}
        />
      </Box>
    );
  }

  const sectionHeaders = {
    home: t("patientPortal.headers.home", { returnObjects: true }),
    questionnaires: t("patientPortal.headers.questionnaires", { returnObjects: true }),
    labs: t("patientPortal.headers.labs", { returnObjects: true }),
    recommendations: t("patientPortal.headers.recommendations", { returnObjects: true }),
    notifications: t("patientPortal.headers.notifications", { returnObjects: true }),
  };
  const header = sectionHeaders[section] || sectionHeaders.home;

  const renderHome = () => (
    <Stack spacing={2.5}>
      <Card
        sx={{
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(
            theme.palette.primary.main,
            0.02
          )} 70%)`,
          border: "1px solid",
          borderColor: alpha(theme.palette.primary.main, 0.18),
        }}
      >
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2.5}
            alignItems={{ md: "center" }}
            justifyContent="space-between"
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="overline" sx={{ color: "primary.dark", fontWeight: 700, letterSpacing: "0.08em" }}>
                {t("patientPortal.welcome")}
              </Typography>
              <Typography variant="h5" sx={{ mt: 0.25, mb: 0.75, fontWeight: 700 }}>
                {t("patientPortal.heroGreeting", { name: patient.full_name || "" })}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: heroPrimaryAction ? 2 : 0 }}>
                {heroPrimaryAction ? t("patientPortal.heroSubtitle") : t("patientPortal.heroNoActions")}
              </Typography>
              {heroPrimaryAction ? (
                <Button
                  variant="contained"
                  size="large"
                  startIcon={heroPrimaryAction.icon}
                  component={RouterLink}
                  to={heroPrimaryAction.to}
                >
                  {heroPrimaryAction.label}
                </Button>
              ) : null}
            </Box>
            {hasUpcomingVisit ? (
              <Card
                variant="outlined"
                sx={{
                  bgcolor: "background.paper",
                  borderColor: alpha(theme.palette.primary.main, 0.22),
                  minWidth: { md: 240 },
                }}
              >
                <CardContent sx={{ py: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <EventAvailableRoundedIcon color="primary" />
                    <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                      {t("patientPortal.notifications.upcomingVisitTitle")}
                    </Typography>
                  </Stack>
                  <Typography variant="h6" sx={{ mt: 0.5, fontWeight: 700 }}>
                    {formatPortalDateOnly(patient.next_visit_date)}
                  </Typography>
                </CardContent>
              </Card>
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      <Box
        sx={{
          display: "grid",
          gap: 2.25,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
        }}
      >
        <KpiCard
          label={t("patientPortal.kpi.openTasks")}
          value={openAssignmentsCount}
          icon={<AssignmentTurnedInRoundedIcon />}
          tone={openAssignmentsCount > 0 ? "warning" : "success"}
          to="/patient/questionnaires"
          emphasised={openAssignmentsCount > 0}
        />
        <KpiCard
          label={t("patientPortal.kpi.completed")}
          value={assessments.length}
          icon={<TaskAltRoundedIcon />}
          tone="primary"
        />
        <KpiCard
          label={t("patientPortal.kpi.labResults")}
          value={labs.length}
          icon={<ScienceRoundedIcon />}
          tone="info"
          to="/patient/labs"
        />
        <KpiCard
          label={t("patientPortal.kpi.notifications")}
          value={notifications.length}
          icon={<NotificationsActiveRoundedIcon />}
          tone={newNotificationsCount > 0 ? "warning" : "info"}
          hint={
            newNotificationsCount > 0
              ? t("patientPortal.notificationStatus.new")
              : undefined
          }
          to="/patient/notifications"
          emphasised={newNotificationsCount > 0}
        />
      </Box>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: { xs: 2.25, md: 2.75 } }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <TaskAltRoundedIcon color="primary" />
                <Typography variant="h6">{t("patientPortal.todoCard")}</Typography>
              </Stack>
              <Divider sx={{ mb: 1.5 }} />
              <List dense disablePadding>
                {todoItems.map((item, idx) => (
                  <ListItem key={`todo-${idx}`} disableGutters sx={{ py: 0.5 }}>
                    <ListItemText
                      primary={item}
                      slotProps={{
                        primary: { variant: "body2", sx: { fontWeight: 500 } },
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: { xs: 2.25, md: 2.75 } }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <HealthAndSafetyRoundedIcon color="primary" />
                <Typography variant="h6">{t("patientPortal.statusCard")}</Typography>
              </Stack>
              <Divider sx={{ mb: 1.5 }} />
              <List dense disablePadding>
                {statusItems.map((item, idx) => (
                  <ListItem key={`status-${idx}`} disableGutters sx={{ py: 0.5 }}>
                    <ListItemText
                      primary={item}
                      slotProps={{
                        primary: { variant: "body2", sx: { fontWeight: 500 } },
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent sx={{ p: { xs: 2.25, md: 2.75 } }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <LocalHospitalRoundedIcon color="primary" />
            <Typography variant="h6">{t("patientPortal.summaryCard")}</Typography>
          </Stack>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="caption" color="text.secondary">
                {t("patientPortal.lastLabDate")}
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {latestLabDate || t("patientPortal.none")}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="caption" color="text.secondary">
                {t("patientPortal.lastQuestionnaireDate")}
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {latestAssessmentDate || t("patientPortal.none")}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="caption" color="text.secondary">
                {t("patientPortal.hasRecommendations")}
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {hasRecommendations ? t("patientPortal.yes") : t("patientPortal.no")}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="caption" color="text.secondary">
                {t("patientPortal.riskFlags")}
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {riskFlagsCount ? String(riskFlagsCount) : t("patientPortal.none")}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: { xs: 2.25, md: 2.75 } }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            {t("patientPortal.profileCard")}
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={0.75}>
            <Typography sx={{ fontWeight: 700 }}>{patient.full_name}</Typography>
            <Typography color="text.secondary" variant="body2">
              {t("patientPortal.patientCode")}: {patient.patient_code || "-"}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {t("patientPortal.treatingDoctor")}:{" "}
              {patient.assigned_doctor
                ? `ID ${patient.assigned_doctor}`
                : t("patientPortal.noDoctorAssigned")}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: { xs: 2.25, md: 2.75 } }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>
            {t("patientPortal.quickActions")}
          </Typography>
          <Stack direction="row" spacing={1.25} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Button
              variant="outlined"
              startIcon={<AssignmentTurnedInRoundedIcon />}
              component={RouterLink}
              to="/patient/questionnaires"
            >
              {t("patientPortal.openQuestionnairesAction")}
            </Button>
            <Button
              variant="outlined"
              startIcon={<ScienceRoundedIcon />}
              component={RouterLink}
              to="/patient/labs"
            >
              {t("patientPortal.openLabsAction")}
            </Button>
            <Button
              variant="outlined"
              startIcon={<HealthAndSafetyRoundedIcon />}
              component={RouterLink}
              to="/patient/recommendations"
            >
              {t("patientPortal.openRecommendationsAction")}
            </Button>
            <Button
              variant="outlined"
              startIcon={<NotificationsActiveRoundedIcon />}
              component={RouterLink}
              to="/patient/notifications"
            >
              {t("patientPortal.openNotificationsAction")}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );

  const renderQuestionnaires = () => (
    <Stack spacing={2.5}>
      <Card>
        <CardContent sx={{ p: { xs: 2.25, md: 2.75 } }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <AssignmentTurnedInRoundedIcon color="primary" />
            <Typography variant="h6">{t("patientPortal.questionnaires.availableTitle")}</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t("patientPortal.questionnaires.availableSubtitle")}
          </Typography>
          {!ongoingAssignments.length ? (
            <EmptyState
              dense
              title={t("patientPortal.questionnaires.noAssigned")}
            />
          ) : (
            <Stack spacing={1.5}>
              {ongoingAssignments.map((row) => {
                const statusAllowsTake = row.status === "assigned" || row.status === "in_progress";
                const canTake = statusAllowsTake && !isAssignmentDuePast(row.due_date);
                const takeHref =
                  patientId && row.questionnaire != null
                    ? `/patient/questionnaires/${patientId}/${row.questionnaire}`
                    : "#";
                const overdue = statusAllowsTake && isAssignmentDuePast(row.due_date);
                return (
                  <Card
                    key={row.id}
                    variant="outlined"
                    sx={{
                      borderRadius: 2,
                      borderColor: canTake
                        ? alpha(theme.palette.primary.main, 0.25)
                        : "divider",
                      bgcolor: canTake ? alpha(theme.palette.primary.main, 0.03) : "background.paper",
                    }}
                  >
                    <CardContent sx={{ p: { xs: 2, md: 2.25 } }}>
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={2}
                        alignItems={{ md: "center" }}
                        justifyContent="space-between"
                      >
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>
                            {row.questionnaire_title ||
                              t("detail.questionnaireFallback", { id: row.questionnaire })}
                          </Typography>
                          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 0.5 }}>
                            {assignmentOngoingStatusChip(row)}
                            <Chip
                              size="small"
                              variant="outlined"
                              label={`${t("patientPortal.questionnaires.assignedOn")}: ${formatPortalDateTime(row.assigned_at)}`}
                            />
                            {row.due_date ? (
                              <Chip
                                size="small"
                                variant="outlined"
                                color={overdue ? "warning" : undefined}
                                label={`${t("patientPortal.questionnaires.due")}: ${formatPortalDateOnly(row.due_date)}`}
                              />
                            ) : null}
                          </Stack>
                          {(row.note || "").trim() ? (
                            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
                              <strong>{t("patientPortal.questionnaires.doctorNote")}:</strong> {row.note}
                            </Typography>
                          ) : null}
                        </Box>
                        <Box sx={{ flexShrink: 0 }}>
                          {canTake ? (
                            <Button
                              component={RouterLink}
                              to={takeHref}
                              variant="contained"
                              startIcon={<PlayCircleFilledRoundedIcon />}
                            >
                              {t("patientPortal.questionnaires.takeButton")}
                            </Button>
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              {overdue || row.status === "expired"
                                ? t("patientPortal.questionnaires.takeDisabledExpired")
                                : row.status === "cancelled"
                                  ? t("patientPortal.questionnaires.takeDisabledCancelled")
                                  : "—"}
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: { xs: 2.25, md: 2.75 } }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <HistoryRoundedIcon color="primary" />
            <Typography variant="h6">
              {t("patientPortal.questionnaires.completedAssignmentsTitle")}
            </Typography>
          </Stack>
          <DataTable
            ariaLabel={t("patientPortal.questionnaires.completedAssignmentsTitle")}
            density="comfortable"
            rows={completedAssignments}
            getRowKey={(row) => row.id}
            empty={
              <EmptyState
                dense
                title={t("patientPortal.questionnaires.noCompletedAssignments")}
              />
            }
            columns={[
              {
                id: "title",
                label: t("patientPortal.questionnaires.columnQuestionnaire"),
                render: (row) => (
                  <Typography sx={{ fontWeight: 600 }}>
                    {row.questionnaire_title ||
                      t("detail.questionnaireFallback", { id: row.questionnaire })}
                  </Typography>
                ),
              },
              {
                id: "completed",
                label: t("patientPortal.questionnaires.columnCompletedAt"),
                render: (row) =>
                  formatPortalDateTime(row.completed_at || row.assessment_summary?.created_at),
              },
              {
                id: "status",
                label: t("patientPortal.questionnaires.columnStatus"),
                render: (row) => (
                  <Chip
                    size="small"
                    label={assignmentStatusLabel(row)}
                    color="success"
                    variant="outlined"
                    sx={{ fontWeight: 600 }}
                  />
                ),
              },
              {
                id: "summary",
                label: t("patientPortal.questionnaires.columnSummary"),
                render: (row) => (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.25 }}>
                      {localizedAssignmentSummaryPreview(t, row.assessment_summary) || "—"}
                    </Typography>
                    {row.assessment_summary?.id && patientId ? (
                      <Button
                        component={RouterLink}
                        size="small"
                        variant="text"
                        startIcon={<VisibilityRoundedIcon />}
                        to={`/patient/assessments/${patientId}/${row.assessment_summary.id}`}
                      >
                        {t("patientPortal.questionnaires.viewFullResult")}
                      </Button>
                    ) : null}
                  </Box>
                ),
              },
              {
                id: "note",
                label: t("patientPortal.questionnaires.doctorNote"),
                render: (row) =>
                  (row.note || "").trim() ? (
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {row.note}
                    </Typography>
                  ) : (
                    "—"
                  ),
              },
            ]}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
            {t("patientPortal.questionnaires.completedAssignmentFootnote")}
          </Typography>
        </CardContent>
      </Card>

      {assessments.length > 0 ? (
        <Card>
          <CardContent sx={{ p: { xs: 2.25, md: 2.75 } }}>
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 700 }}>
              {t("patientPortal.questionnaires.allResultsTitle")}
            </Typography>
            <List dense disablePadding>
              {assessments.map((a, idx) => (
                <ListItem
                  key={a.id}
                  disableGutters
                  sx={{
                    py: 1,
                    borderBottom: idx === assessments.length - 1 ? "none" : "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <ListItemText
                    primary={a.questionnaire_title || "-"}
                    secondary={`${t("patientPortal.questionnaires.completedAt")}: ${formatPortalDateTime(a.created_at)}`}
                    slotProps={{ primary: { sx: { fontWeight: 600 } } }}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );

  const renderLabs = () => (
    <Card>
      <CardContent sx={{ p: { xs: 2.25, md: 2.75 } }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
          <ScienceRoundedIcon color="primary" />
          <Typography variant="h6">{t("patientPortal.menu.labs")}</Typography>
        </Stack>
        <DataTable
          ariaLabel={t("patientPortal.menu.labs")}
          rows={labRows}
          getRowKey={(row) => row.id}
          empty={<EmptyState dense title={t("patientPortal.noLabs")} />}
          columns={[
            {
              id: "date",
              label: t("patientPortal.labs.table.date"),
              render: (row) => row.date,
              width: 130,
            },
            {
              id: "indicator",
              label: t("patientPortal.labs.table.indicator"),
              render: (row) => (
                <Typography sx={{ fontWeight: 600 }}>{row.indicator}</Typography>
              ),
            },
            {
              id: "value",
              label: t("patientPortal.labs.table.value"),
              render: (row) =>
                row.value !== null && row.value !== undefined
                  ? `${row.value}${row.unit ? ` ${row.unit}` : ""}`
                  : "—",
            },
            {
              id: "reference",
              label: t("patientPortal.labs.table.reference"),
              render: (row) =>
                row.minNorm != null || row.maxNorm != null
                  ? `${row.minNorm ?? "-"} – ${row.maxNorm ?? "-"}${row.unit ? ` ${row.unit}` : ""}`
                  : t("patientPortal.none"),
            },
            {
              id: "status",
              label: t("patientPortal.labs.table.status"),
              render: (row) => (
                <Chip
                  size="small"
                  color={
                    row.status === "above"
                      ? "warning"
                      : row.status === "below"
                        ? "info"
                        : "success"
                  }
                  label={
                    row.status === "above"
                      ? t("patientPortal.labs.status.above")
                      : row.status === "below"
                        ? t("patientPortal.labs.status.below")
                        : t("patientPortal.labs.status.normal")
                  }
                  variant="outlined"
                  sx={{ fontWeight: 600 }}
                />
              ),
              width: 140,
            },
          ]}
        />
      </CardContent>
    </Card>
  );

  const renderRecommendationsSection = (icon, title, items, keyPrefix) => (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ p: { xs: 2.25, md: 2.5 } }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
          {icon}
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
        </Stack>
        <Divider sx={{ mb: 1.5 }} />
        <List dense disablePadding>
          {items.map((item, idx) => (
            <ListItem key={`${keyPrefix}-${idx}`} disableGutters sx={{ py: 0.4 }}>
              <ListItemText
                primary={item}
                slotProps={{
                  primary: { variant: "body2", sx: { fontWeight: 500 } },
                }}
              />
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );

  const renderRecommendations = () => (
    <Stack spacing={2.5}>
      {engineRecommendations ? (
        <Card
          sx={{
            border: "1px solid",
            borderColor: alpha(theme.palette.primary.main, 0.22),
            bgcolor: alpha(theme.palette.primary.main, 0.04),
          }}
        >
          <CardContent sx={{ p: { xs: 2.25, md: 2.5 } }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <HealthAndSafetyRoundedIcon color="primary" />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {t("patientPortal.recommendations.engineSummaryTitle")}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 1.5 }}>
              <Chip
                size="small"
                label={`${t("patientPortal.recommendations.engineOverallStatus")}: ${engineRecommendations.overall_status || "—"}`}
                color={
                  engineRecommendations.overall_status === "urgent_review"
                    ? "error"
                    : engineRecommendations.overall_status === "elevated_risk"
                      ? "warning"
                      : "default"
                }
                sx={{ fontWeight: 700 }}
              />
            </Stack>
            {engineRecommendations.overall_status_patient_ru ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {engineRecommendations.overall_status_patient_ru}
              </Typography>
            ) : null}
            {Array.isArray(engineRecommendations.red_flags) && engineRecommendations.red_flags.length ? (
              <Alert severity="warning" sx={{ mb: 1.25 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  {t("patientPortal.recommendations.engineRedFlags")}
                </Typography>
                <List dense disablePadding>
                  {engineRecommendations.red_flags.slice(0, 5).map((rf, idx) => (
                    <ListItem key={rf.source_item_id || idx} disableGutters sx={{ py: 0.25 }}>
                      <ListItemText
                        primary={rf.title}
                        secondary={(rf.patient_summary || "").slice(0, 240)}
                      />
                    </ListItem>
                  ))}
                </List>
              </Alert>
            ) : null}
            <Typography variant="caption" color="text.secondary">
              {t("patientPortal.recommendations.engineDisclaimer")}
            </Typography>
          </CardContent>
        </Card>
      ) : null}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 6 }}>
          {renderRecommendationsSection(
            <HealthAndSafetyRoundedIcon color="primary" />,
            t("patientPortal.sectionGeneralTitle"),
            recommendationSections.general,
            "rec-general"
          )}
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          {renderRecommendationsSection(
            <MonitorHeartRoundedIcon color="primary" />,
            t("patientPortal.sectionMonitorTitle"),
            recommendationSections.monitor,
            "rec-monitor"
          )}
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          {renderRecommendationsSection(
            <HistoryRoundedIcon color="primary" />,
            t("patientPortal.sectionRepeatTitle"),
            recommendationSections.repeat,
            "rec-repeat"
          )}
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          {renderRecommendationsSection(
            <CallRoundedIcon color="primary" />,
            t("patientPortal.sectionContactTitle"),
            recommendationSections.contact,
            "rec-contact"
          )}
        </Grid>
      </Grid>
    </Stack>
  );

  const renderNotifications = () => (
    <Card>
      <CardContent sx={{ p: { xs: 2.25, md: 2.75 } }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <NotificationsActiveRoundedIcon color="primary" />
          <Typography variant="h6">{t("patientPortal.menu.notifications")}</Typography>
        </Stack>
        {!notifications.length ? (
          <EmptyState dense title={t("patientPortal.noNotifications")} />
        ) : (
          <Stack spacing={1.25}>
            {notifications.map((item) => {
              const isNew = item.status === "new";
              const isHigh = item.importance === "high";
              const accent = isHigh
                ? theme.palette.warning.main
                : isNew
                  ? theme.palette.primary.main
                  : theme.palette.divider;
              return (
                <Box
                  key={item.key}
                  sx={{
                    display: "flex",
                    gap: 1.5,
                    p: 1.75,
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: alpha(accent, isHigh || isNew ? 0.4 : 1),
                    bgcolor: isHigh
                      ? alpha(theme.palette.warning.main, 0.05)
                      : isNew
                        ? alpha(theme.palette.primary.main, 0.04)
                        : "background.paper",
                  }}
                >
                  <Box
                    sx={{
                      flexShrink: 0,
                      width: 4,
                      borderRadius: 1,
                      bgcolor: accent,
                    }}
                  />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5, flexWrap: "wrap" }}>
                      <Typography sx={{ fontWeight: 700 }}>{item.title}</Typography>
                      <Chip
                        label={
                          isNew
                            ? t("patientPortal.notificationStatus.new")
                            : t("patientPortal.notificationStatus.viewed")
                        }
                        color={isNew ? "primary" : "default"}
                        size="small"
                        variant={isNew ? "filled" : "outlined"}
                        sx={{ fontWeight: 700 }}
                      />
                      {isHigh ? (
                        <Chip
                          label={t("patientPortal.notificationPriority.high")}
                          color="warning"
                          size="small"
                          variant="outlined"
                          sx={{ fontWeight: 700 }}
                        />
                      ) : null}
                    </Stack>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                      {item.text}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t("patientPortal.notificationDate")}: {item.date}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Stack>
        )}
      </CardContent>
    </Card>
  );

  const renderSection = () => {
    switch (section) {
      case "labs":
        return renderLabs();
      case "questionnaires":
        return renderQuestionnaires();
      case "recommendations":
        return renderRecommendations();
      case "notifications":
        return renderNotifications();
      case "home":
      default:
        return renderHome();
    }
  };

  return (
    <Box>
      <PageHeader title={header.title} subtitle={header.subtitle} />
      {renderSection()}
    </Box>
  );
}

export default PatientPortalPage;
