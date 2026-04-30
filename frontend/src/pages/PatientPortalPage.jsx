import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Grid, List, ListItem, ListItemText, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import api from "../api/axios";
import { useTranslation } from "react-i18next";

function PatientPortalPage({ section = "home" }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [patient, setPatient] = useState(null);
  const [labs, setLabs] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [doctorOrder, setDoctorOrder] = useState(null);
  const [riskProfile, setRiskProfile] = useState(null);
  const [availableQuestionnaires, setAvailableQuestionnaires] = useState([]);

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

        const [labsRes, assessmentsRes, orderRes, riskRes] = await Promise.all([
          api.get(`patients/${myPatient.id}/labs/?period=all`),
          api.get(`patients/${myPatient.id}/assessments/`),
          api.get(`patients/${myPatient.id}/doctor-order/`),
          api.get(`patients/${myPatient.id}/risk-profile/`),
        ]);
        const questionnairesRes = await api.get("questionnaires/");
        setLabs(Array.isArray(labsRes.data) ? labsRes.data : []);
        setAssessments(Array.isArray(assessmentsRes.data) ? assessmentsRes.data : []);
        setDoctorOrder(orderRes.data || null);
        setRiskProfile(riskRes.data || null);
        setAvailableQuestionnaires(Array.isArray(questionnairesRes.data) ? questionnairesRes.data : []);
      } catch (e) {
        setError(e?.response?.data?.error || t("patientPortal.loadError"));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [t]);

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

  const completedQuestionnaireIds = useMemo(
    () => new Set(assessments.map((a) => a?.questionnaire).filter(Boolean)),
    [assessments]
  );

  const pendingQuestionnaires = useMemo(() => {
    return availableQuestionnaires.filter((q) => !completedQuestionnaireIds.has(q?.id));
  }, [availableQuestionnaires, completedQuestionnaireIds]);

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

    if (pendingQuestionnaires.length) {
      addUnique(
        sections.monitor,
        t("patientPortal.recommendations.pendingQuestionnaires", { count: pendingQuestionnaires.length })
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
  }, [doctorOrder?.order_text, labRows, riskProfile, pendingQuestionnaires.length, assessments.length, patient?.next_visit_date, t]);

  const statusItems = useMemo(() => {
    const items = [];
    if (hasRecommendations) items.push(t("patientPortal.status.newRecommendations"));
    if (!assessments.length) items.push(t("patientPortal.status.questionnairePending"));
    if (hasUpcomingVisit) items.push(t("patientPortal.status.upcomingVisit", { date: patient?.next_visit_date }));
    if (!items.length) items.push(t("patientPortal.status.noNewNotifications"));
    return items;
  }, [hasRecommendations, assessments.length, hasUpcomingVisit, patient?.next_visit_date, t]);

  const todoItems = useMemo(() => {
    const items = [];
    if (!assessments.length) items.push(t("patientPortal.todo.takeQuestionnaire"));
    if (hasRecommendations) items.push(t("patientPortal.todo.reviewRecommendations"));
    if (latestLabDate) items.push(t("patientPortal.todo.reviewLabs", { date: latestLabDate }));
    if (hasUpcomingVisit) items.push(t("patientPortal.todo.prepareVisit", { date: patient?.next_visit_date }));
    if (!items.length) items.push(t("patientPortal.todo.noActions"));
    return items;
  }, [assessments.length, hasRecommendations, latestLabDate, hasUpcomingVisit, patient?.next_visit_date, t]);

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
          <Card><CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>{t("patientPortal.questionnaires.completedTitle")}</Typography>
            {!assessments.length ? <Typography color="text.secondary">{t("patientPortal.noAssessments")}</Typography> : (
              <List>
                {assessments.map((a) => (
                  <ListItem key={a.id} divider secondaryAction={<Chip size="small" variant="outlined" label={t("patientPortal.questionnaires.completedStatus")} />}>
                    <ListItemText
                      primary={a.questionnaire_title || "-"}
                      secondary={`${t("patientPortal.questionnaires.completedAt")}: ${a.created_at || "-"}`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent></Card>
          <Card><CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>{t("patientPortal.questionnaires.pendingTitle")}</Typography>
            {!pendingQuestionnaires.length ? <Typography color="text.secondary">{t("patientPortal.questionnaires.noPending")}</Typography> : (
              <List>
                {pendingQuestionnaires.map((q) => (
                  <ListItem
                    key={q.id}
                    divider
                    secondaryAction={
                      <Button size="small" variant="outlined">
                        {t("patientPortal.questionnaires.takeButton")}
                      </Button>
                    }
                  >
                    <ListItemText
                      primary={q.title || q.title_ru || q.title_kk || q.title_en || "-"}
                      secondary={t("patientPortal.questionnaires.pendingStatus")}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent></Card>
        </Stack>
      )}

      {section === "recommendations" && (
        <Stack spacing={2}>
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

