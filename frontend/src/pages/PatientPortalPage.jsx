import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Grid, List, ListItem, ListItemText, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import api from "../api/axios";
import { useTranslation } from "react-i18next";
import { localizedAssignmentSummaryPreview } from "../utils/assessmentInterpretation";

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
        text: t("patientPortal.notifications.lastQuestionnaireText", { date: assessments[0]?.created_at || "-" }),
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
          (a.status === "assigned" || a.status === "in_progress") &&
          !isAssignmentDuePast(a.due_date)
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
    return <Chip size="small" label={label} color={color} variant="outlined" />;
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
      addUnique(
        sections.monitor,
        t("patientPortal.recommendations.monitorIndicator", { indicator })
      );
      addUnique(
        sections.repeat,
        t("patientPortal.recommendations.repeatIndicator", { indicator })
      );
    }

    if (!abnormalIndicators.length && labRows.length) {
      addUnique(sections.general, t("patientPortal.recommendations.labsStable"));
    }
    if (!labRows.length) {
      addUnique(sections.repeat, t("patientPortal.recommendations.repeatNoLabs"));
    }

    const findings = Array.isArray(riskProfile?.findings) ? riskProfile.findings : [];
    for (const finding of findings.slice(0, 5)) {
      addUnique(
        sections.monitor,
        finding?.message || finding?.title || finding?.description || ""
      );
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
  }, [doctorOrder?.order_text, labRows, riskProfile, openAssignmentsCount, assessments.length, patient?.next_visit_date, t]);

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
  }, [hasRecommendations, assessments.length, hasUpcomingVisit, patient?.next_visit_date, openAssignmentsCount, t]);

  const todoItems = useMemo(() => {
    const items = [];
    if (openAssignmentsCount) items.push(t("patientPortal.todo.takeAssignedQuestionnaire"));
    if (hasRecommendations) items.push(t("patientPortal.todo.reviewRecommendations"));
    if (latestLabDate) items.push(t("patientPortal.todo.reviewLabs", { date: latestLabDate }));
    if (hasUpcomingVisit) items.push(t("patientPortal.todo.prepareVisit", { date: patient?.next_visit_date }));
    if (!items.length) items.push(t("patientPortal.todo.noActions"));
    return items;
  }, [openAssignmentsCount, hasRecommendations, latestLabDate, hasUpcomingVisit, patient?.next_visit_date, t]);

  if (loading) {
    return (
      <Box sx={{ minHeight: "45vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!patientId) {
    return <Alert severity="info">{t("patientPortal.noPatientCard")}</Alert>;
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>{t("patientPortal.title")}</Typography>
      {section === "home" && (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Card><CardContent>
              <Typography variant="h6" sx={{ mb: 0.75 }}>{t("patientPortal.profileCard")}</Typography>
              <Typography sx={{ fontWeight: 600 }}>{patient.full_name}</Typography>
              <Typography color="text.secondary">{t("patientPortal.patientCode")}: {patient.patient_code || "-"}</Typography>
              <Typography color="text.secondary">
                {t("patientPortal.treatingDoctor")}: {patient.assigned_doctor ? `ID ${patient.assigned_doctor}` : t("patientPortal.noDoctorAssigned")}
              </Typography>
            </CardContent></Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card><CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>{t("patientPortal.statusCard")}</Typography>
              <List dense>
                {statusItems.map((item, idx) => (
                  <ListItem key={`status-${idx}`} disableGutters>
                    <ListItemText primary={item} />
                  </ListItem>
                ))}
              </List>
            </CardContent></Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card><CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>{t("patientPortal.todoCard")}</Typography>
              <List dense>
                {todoItems.map((item, idx) => (
                  <ListItem key={`todo-${idx}`} disableGutters>
                    <ListItemText primary={item} />
                  </ListItem>
                ))}
              </List>
            </CardContent></Card>
          </Grid>
          <Grid item xs={12}>
            <Card><CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>{t("patientPortal.summaryCard")}</Typography>
              <Typography color="text.secondary">
                {t("patientPortal.lastLabDate")}: {latestLabDate || t("patientPortal.none")}
              </Typography>
              <Typography color="text.secondary">
                {t("patientPortal.lastQuestionnaireDate")}: {latestAssessmentDate || t("patientPortal.none")}
              </Typography>
              <Typography color="text.secondary">
                {t("patientPortal.hasRecommendations")}: {hasRecommendations ? t("patientPortal.yes") : t("patientPortal.no")}
              </Typography>
              <Typography color="text.secondary">
                {t("patientPortal.riskFlags")}: {riskFlagsCount ? String(riskFlagsCount) : t("patientPortal.none")}
              </Typography>
            </CardContent></Card>
          </Grid>
        </Grid>
      )}

      {section === "labs" && (
        <Card><CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>{t("patientPortal.menu.labs")}</Typography>
          {!labRows.length ? <Typography color="text.secondary">{t("patientPortal.noLabs")}</Typography> : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("patientPortal.labs.table.date")}</TableCell>
                  <TableCell>{t("patientPortal.labs.table.indicator")}</TableCell>
                  <TableCell>{t("patientPortal.labs.table.value")}</TableCell>
                  <TableCell>{t("patientPortal.labs.table.reference")}</TableCell>
                  <TableCell>{t("patientPortal.labs.table.status")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {labRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.date}</TableCell>
                    <TableCell>{row.indicator}</TableCell>
                    <TableCell>{row.value}{row.unit ? ` ${row.unit}` : ""}</TableCell>
                    <TableCell>
                      {row.minNorm != null || row.maxNorm != null
                        ? `${row.minNorm ?? "-"} - ${row.maxNorm ?? "-"}`
                        : t("patientPortal.none")}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={row.status === "above" ? "warning" : row.status === "below" ? "info" : "success"}
                        label={
                          row.status === "above"
                            ? t("patientPortal.labs.status.above")
                            : row.status === "below"
                              ? t("patientPortal.labs.status.below")
                              : t("patientPortal.labs.status.normal")
                        }
                        variant="outlined"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent></Card>
      )}

      {section === "questionnaires" && (
        <Stack spacing={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 0.5 }}>
                {t("patientPortal.questionnaires.availableTitle")}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t("patientPortal.questionnaires.availableSubtitle")}
              </Typography>
              {!ongoingAssignments.length ? (
                <Typography color="text.secondary">{t("patientPortal.questionnaires.noAssigned")}</Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t("patientPortal.questionnaires.columnQuestionnaire")}</TableCell>
                      <TableCell>{t("patientPortal.questionnaires.assignedOn")}</TableCell>
                      <TableCell>{t("patientPortal.questionnaires.due")}</TableCell>
                      <TableCell>{t("patientPortal.questionnaires.columnStatus")}</TableCell>
                      <TableCell>{t("patientPortal.questionnaires.doctorNote")}</TableCell>
                      <TableCell align="right">{t("patientPortal.questionnaires.columnAction")}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ongoingAssignments.map((row) => {
                      const statusAllowsTake = row.status === "assigned" || row.status === "in_progress";
                      const canTake = statusAllowsTake && !isAssignmentDuePast(row.due_date);
                      const takeHref =
                        patientId && row.questionnaire != null
                          ? `/patient/questionnaires/${patientId}/${row.questionnaire}`
                          : "#";
                      return (
                        <TableRow key={row.id}>
                          <TableCell sx={{ fontWeight: 600 }}>
                            {row.questionnaire_title ||
                              t("detail.questionnaireFallback", { id: row.questionnaire })}
                          </TableCell>
                          <TableCell>{formatPortalDateTime(row.assigned_at)}</TableCell>
                          <TableCell>{formatPortalDateOnly(row.due_date)}</TableCell>
                          <TableCell>{assignmentOngoingStatusChip(row)}</TableCell>
                          <TableCell sx={{ maxWidth: 200, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                            {(row.note || "").trim() ? row.note : "—"}
                          </TableCell>
                          <TableCell align="right">
                            {canTake ? (
                              <Button component={Link} to={takeHref} size="small" variant="contained">
                                {t("patientPortal.questionnaires.takeButton")}
                              </Button>
                            ) : statusAllowsTake && isAssignmentDuePast(row.due_date) ? (
                              <Typography variant="caption" color="text.secondary" display="block" sx={{ maxWidth: 220 }}>
                                {t("patientPortal.questionnaires.takeDisabledExpired")}
                              </Typography>
                            ) : row.status === "expired" ? (
                              <Typography variant="caption" color="text.secondary" display="block" sx={{ maxWidth: 220 }}>
                                {t("patientPortal.questionnaires.takeDisabledExpired")}
                              </Typography>
                            ) : row.status === "cancelled" ? (
                              <Typography variant="caption" color="text.secondary" display="block" sx={{ maxWidth: 220 }}>
                                {t("patientPortal.questionnaires.takeDisabledCancelled")}
                              </Typography>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                {t("patientPortal.questionnaires.completedAssignmentsTitle")}
              </Typography>
              {!completedAssignments.length ? (
                <Typography color="text.secondary">{t("patientPortal.questionnaires.noCompletedAssignments")}</Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t("patientPortal.questionnaires.columnQuestionnaire")}</TableCell>
                      <TableCell>{t("patientPortal.questionnaires.assignedOn")}</TableCell>
                      <TableCell>{t("patientPortal.questionnaires.due")}</TableCell>
                      <TableCell>{t("patientPortal.questionnaires.columnCompletedAt")}</TableCell>
                      <TableCell>{t("patientPortal.questionnaires.columnStatus")}</TableCell>
                      <TableCell>{t("patientPortal.questionnaires.columnSummary")}</TableCell>
                      <TableCell>{t("patientPortal.questionnaires.doctorNote")}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {completedAssignments.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell sx={{ fontWeight: 600 }}>
                          {row.questionnaire_title ||
                            t("detail.questionnaireFallback", { id: row.questionnaire })}
                        </TableCell>
                        <TableCell>{formatPortalDateTime(row.assigned_at)}</TableCell>
                        <TableCell>{formatPortalDateOnly(row.due_date)}</TableCell>
                        <TableCell>
                          {formatPortalDateTime(row.completed_at || row.assessment_summary?.created_at)}
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={assignmentStatusLabel(row)} color="success" variant="outlined" />
                        </TableCell>
                        <TableCell sx={{ maxWidth: 260 }}>
                          {row.assessment_summary?.id && patientId ? (
                            <Stack spacing={0.75} alignItems="flex-start">
                              <Typography variant="body2" color="text.secondary">
                                {localizedAssignmentSummaryPreview(t, row.assessment_summary) || "—"}
                              </Typography>
                              <Button
                                component={Link}
                                size="small"
                                variant="text"
                                to={`/patient/assessments/${patientId}/${row.assessment_summary.id}`}
                              >
                                {t("patientPortal.questionnaires.viewFullResult")}
                              </Button>
                            </Stack>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              {localizedAssignmentSummaryPreview(t, row.assessment_summary) || "—"}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ maxWidth: 200, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {(row.note || "").trim() ? row.note : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
                {t("patientPortal.questionnaires.completedAssignmentFootnote")}
              </Typography>
            </CardContent>
          </Card>

          {assessments.length > 0 ? (
            <Card>
              <CardContent>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  {t("patientPortal.questionnaires.allResultsTitle")}
                </Typography>
                <List dense>
                  {assessments.map((a) => (
                    <ListItem key={a.id} divider>
                      <ListItemText
                        primary={a.questionnaire_title || "-"}
                        secondary={`${t("patientPortal.questionnaires.completedAt")}: ${a.created_at || "-"}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          ) : null}
        </Stack>
      )}

      {section === "recommendations" && (
        <Stack spacing={2}>
          {engineRecommendations ? (
            <Card>
              <CardContent>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  {t("patientPortal.recommendations.engineSummaryTitle")}
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 1 }}>
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
                  />
                </Stack>
                {engineRecommendations.overall_status_patient_ru ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {engineRecommendations.overall_status_patient_ru}
                  </Typography>
                ) : null}
                {Array.isArray(engineRecommendations.red_flags) && engineRecommendations.red_flags.length ? (
                  <Alert severity="warning" sx={{ mb: 1 }}>
                    <Typography variant="subtitle2">{t("patientPortal.recommendations.engineRedFlags")}</Typography>
                    <List dense>
                      {engineRecommendations.red_flags.slice(0, 5).map((rf, idx) => (
                        <ListItem key={rf.source_item_id || idx} disableGutters>
                          <ListItemText primary={rf.title} secondary={(rf.patient_summary || "").slice(0, 240)} />
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
          <Card><CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>{t("patientPortal.menu.recommendations")}</Typography>
            <Typography color="text.secondary">{t("patientPortal.recommendations.subtitle")}</Typography>
          </CardContent></Card>
          <Card><CardContent>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>{t("patientPortal.recommendations.generalTitle")}</Typography>
            <List dense>
              {recommendationSections.general.map((item, idx) => (
                <ListItem key={`rec-general-${idx}`} disableGutters>
                  <ListItemText primary={item} />
                </ListItem>
              ))}
            </List>
          </CardContent></Card>
          <Card><CardContent>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>{t("patientPortal.recommendations.monitorTitle")}</Typography>
            <List dense>
              {recommendationSections.monitor.map((item, idx) => (
                <ListItem key={`rec-monitor-${idx}`} disableGutters>
                  <ListItemText primary={item} />
                </ListItem>
              ))}
            </List>
          </CardContent></Card>
          <Card><CardContent>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>{t("patientPortal.recommendations.repeatTitle")}</Typography>
            <List dense>
              {recommendationSections.repeat.map((item, idx) => (
                <ListItem key={`rec-repeat-${idx}`} disableGutters>
                  <ListItemText primary={item} />
                </ListItem>
              ))}
            </List>
          </CardContent></Card>
          <Card><CardContent>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>{t("patientPortal.recommendations.contactTitle")}</Typography>
            <List dense>
              {recommendationSections.contact.map((item, idx) => (
                <ListItem key={`rec-contact-${idx}`} disableGutters>
                  <ListItemText primary={item} />
                </ListItem>
              ))}
            </List>
          </CardContent></Card>
        </Stack>
      )}

      {section === "notifications" && (
        <Card><CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>{t("patientPortal.menu.notifications")}</Typography>
          {!notifications.length ? <Typography color="text.secondary">{t("patientPortal.noNotifications")}</Typography> : (
            <List>
              {notifications.map((item) => (
                <ListItem key={item.key} divider alignItems="flex-start">
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <Typography sx={{ fontWeight: 600 }}>{item.title}</Typography>
                        <Chip
                          label={item.status === "new" ? t("patientPortal.notificationStatus.new") : t("patientPortal.notificationStatus.viewed")}
                          color={item.status === "new" ? "primary" : "default"}
                          size="small"
                          variant={item.status === "new" ? "filled" : "outlined"}
                        />
                        {item.importance === "high" ? (
                          <Chip label={t("patientPortal.notificationPriority.high")} color="warning" size="small" variant="outlined" />
                        ) : null}
                      </Stack>
                    }
                    secondary={
                      <>
                        <Typography component="span" variant="body2" sx={{ display: "block" }}>
                          {item.text}
                        </Typography>
                        <Typography component="span" variant="caption" color="text.secondary">
                          {t("patientPortal.notificationDate")}: {item.date}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent></Card>
      )}
    </Box>
  );
}

export default PatientPortalPage;

