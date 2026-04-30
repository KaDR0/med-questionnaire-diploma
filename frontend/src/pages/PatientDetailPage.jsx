import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useTranslation } from "react-i18next";
import {
  translateFindingRecommendation,
  translateRiskEvidence,
  translateRiskLevel,
  translateRiskProblemCode,
} from "../utils/riskFindingLabels";
import { useAuth } from "../context/AuthContext";

import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Button,
  Grid,
  Divider,
  Chip,
  Stack,
  Paper,
  TextField,
  MenuItem,
  Alert,
  Snackbar,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import MedicalLineChart from "../components/charts/MedicalLineChart";
import RiskTimelineChart from "../components/charts/RiskTimelineChart";

function PatientDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [patient, setPatient] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [assessmentTrend, setAssessmentTrend] = useState({
    history: [],
    chart_points: [],
    stats: { count: 0, max_score: 0, min_score: 0, latest_score: 0 },
  });
  const [labTrend, setLabTrend] = useState({
    indicator_options: [],
    selected_indicator: "",
    selected_period: "all",
    chart_points: [],
    stats: { count: 0, latest_value: null, min_value: null, max_value: null },
  });
  const [labIndicators, setLabIndicators] = useState([]);
  const [labs, setLabs] = useState([]);
  const [riskProfile, setRiskProfile] = useState(null);
  const [riskHistory, setRiskHistory] = useState({ chart_points: [], stats: { count: 0, latest_level: "low" } });
  const [riskCategoryFilter, setRiskCategoryFilter] = useState("all");
  const [riskSortMode, setRiskSortMode] = useState("severity");
  const [recalculatingRisk, setRecalculatingRisk] = useState(false);
  const [labFilters, setLabFilters] = useState({
    period: "all",
    indicator_id: "",
  });
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [savingPatient, setSavingPatient] = useState(false);
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [savingLabResult, setSavingLabResult] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingLabResultId, setEditingLabResultId] = useState(null);
  const [labEditForm, setLabEditForm] = useState({
    date: "",
    values: [],
    new_indicator_id: "",
    new_value: "",
  });
  const [noteForm, setNoteForm] = useState({
    text: "",
    category: "general",
    pinned: false,
  });
  const [statusForm, setStatusForm] = useState({
    next_visit_date: "",
  });
  const [demographicsForm, setDemographicsForm] = useState({
    email: "",
    age: "",
    sex: "",
    height_cm: "",
    weight_kg: "",
  });
  const [savingDemographics, setSavingDemographics] = useState(false);
  const [doctorOrderText, setDoctorOrderText] = useState("");
  const [doctorOrderRevisions, setDoctorOrderRevisions] = useState([]);
  const [savingDoctorOrder, setSavingDoctorOrder] = useState(false);
  const [feedback, setFeedback] = useState({
    open: false,
    severity: "success",
    message: "",
  });
  const [intakeForm, setIntakeForm] = useState({
    chief_complaint: "",
    chronic_conditions: "",
    medications: "",
    allergies: "",
    family_history: "",
    habits: "",
    blood_pressure: "",
    temperature: "",
  });
  const [expandedLabSets, setExpandedLabSets] = useState({});
  const theme = useTheme();
  const scoreSeverityColor = (score) =>
    score >= 7 ? theme.palette.error.main : score >= 4 ? theme.palette.warning.main : theme.palette.success.main;

  const statusOptions = [
    { value: "stable", color: "success" },
    { value: "monitoring", color: "info" },
    { value: "attention", color: "warning" },
    { value: "critical", color: "error" },
  ];

  const noteCategoryOptions = ["complaints", "diagnosis", "recommendations"];

  const showFeedback = (message, severity = "success") => {
    setFeedback({ open: true, severity, message });
  };

  const loadPatientData = async () => {
    const query = new URLSearchParams();
    if (labFilters.period) query.set("period", labFilters.period);
    if (labFilters.indicator_id) query.set("indicator_id", labFilters.indicator_id);
    const labQuery = query.toString();
    const labUrl = `patients/${id}/labs/${labQuery ? `?${labQuery}` : ""}`;
    const labTrendUrl = `patients/${id}/lab-trend/${labQuery ? `?${labQuery}` : ""}`;

    const [
      patientResponse,
      assessmentsResponse,
      trendResponse,
      labsResponse,
      labTrendResponse,
      indicatorsResponse,
      notesResponse,
      riskResponse,
      riskHistoryResponse,
      doctorOrderResponse,
    ] = await Promise.all([
      api.get(`patients/${id}/`),
      api.get(`patients/${id}/assessments/`),
      api.get(`patients/${id}/assessment-trend/`),
      api.get(labUrl),
      api.get(labTrendUrl),
      api.get("labs/indicators/"),
      api.get(`patients/${id}/notes/`),
      api.get(`patients/${id}/risk-profile/`),
      api.get(`patients/${id}/risk-history/`),
      api.get(`patients/${id}/doctor-order/`),
    ]);

    setPatient(patientResponse.data);
    setAssessments(assessmentsResponse.data);
    setAssessmentTrend(trendResponse.data || {
      history: [],
      chart_points: [],
      stats: { count: 0, max_score: 0, min_score: 0, latest_score: 0 },
    });
    setLabs(labsResponse.data);
    setLabTrend(labTrendResponse.data || {
      indicator_options: [],
      selected_indicator: "",
      selected_period: "all",
      chart_points: [],
      stats: { count: 0, latest_value: null, min_value: null, max_value: null },
    });
    setLabIndicators(indicatorsResponse.data || []);
    setNotes(notesResponse.data);
    setRiskProfile(riskResponse.data || null);
    setRiskHistory(riskHistoryResponse.data || { chart_points: [], stats: { count: 0, latest_level: "low" } });
    setStatusForm({
      next_visit_date: patientResponse.data.next_visit_date || "",
    });
    setDemographicsForm({
      email: patientResponse.data.email || "",
      age: patientResponse.data.age ?? "",
      sex: patientResponse.data.sex ?? "",
      height_cm: patientResponse.data.height_cm ?? "",
      weight_kg: patientResponse.data.weight_kg ?? "",
    });
    const orderPayload = doctorOrderResponse.data || {};
    setDoctorOrderText(orderPayload.order_text ?? patientResponse.data.doctor_order_text ?? "");
    setDoctorOrderRevisions(Array.isArray(orderPayload.revisions) ? orderPayload.revisions : []);
    const intake = (patientResponse.data.data || {}).intake || {};
    setIntakeForm((prev) => ({
      ...prev,
      ...intake,
    }));
  };

  useEffect(() => {
    loadPatientData()
      .catch((error) => {
        console.error("Error loading patient data:", error);
        if ([403, 404].includes(error?.response?.status)) {
          setAccessDenied(true);
          return;
        }
        showFeedback(t("detail.loadError"), "error");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, labFilters.period, labFilters.indicator_id]);

  const formatDate = (value) => {
    if (!value) return t("common.noData");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const formatDateOnly = (value) => {
    if (!value) return t("common.noData");
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString();
  };

  const lastAssessment = useMemo(() => {
    if (!assessments.length) return null;
    return assessments[0];
  }, [assessments]);
  const excelEntries = useMemo(() => Object.entries(patient?.data || {}), [patient]);

  const pinnedNote = useMemo(() => notes.find((note) => note.pinned) || null, [notes]);
  const regularNotes = useMemo(() => notes.filter((note) => !note.pinned), [notes]);

  const canManageNote = (note) => {
    if (!note) return false;
    if (!note.doctor) return true;
    return Number(note.doctor) === Number(user?.id);
  };

  const getSexLabel = (sex) => {
    if (sex === 1) return t("detail.male");
    if (sex === 2) return t("detail.female");
    return t("detail.unknownSex");
  };

  const getQuestionnaireLabel = (assessment) => {
    return (
      assessment.questionnaire_title ||
      t("detail.questionnaireFallback", { id: assessment.questionnaire })
    );
  };

  const getConclusionLabel = (assessment) => {
    if (assessment.conclusion) return assessment.conclusion;
    return t("detail.conclusionFallback", { score: assessment.total_score });
  };

  const getStatusLabel = (status) => t(`detail.statusOptions.${status}`);

  const getStatusColor = (status) => {
    return statusOptions.find((option) => option.value === status)?.color || "default";
  };

  const getLabStatusColor = (status) => {
    if (status === "normal") return "success";
    if (status === "below") return "warning";
    if (status === "above") return "error";
    return "default";
  };

  const getAssessmentSeverity = (score) => {
    if (score >= 7) return "error";
    if (score >= 4) return "warning";
    return "success";
  };

  const getVisitState = (dateValue) => {
    if (!dateValue) {
      return { label: t("detail.visitNotAssigned"), color: "default" };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const visitDate = new Date(`${dateValue}T00:00:00`);
    visitDate.setHours(0, 0, 0, 0);

    if (visitDate.getTime() < today.getTime()) {
      return { label: t("detail.visitOverdue"), color: "error" };
    }

    if (visitDate.getTime() === today.getTime()) {
      return { label: t("detail.visitToday"), color: "warning" };
    }

    return { label: t("detail.visitScheduled"), color: "success" };
  };

  const handlePatientFieldChange = (field, value) => {
    setStatusForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleIntakeFieldChange = (field, value) => {
    setIntakeForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveIntake = async () => {
    try {
      const payload = { ...intakeForm };
      await api.patch(`patients/${id}/intake/`, payload);
      showFeedback(t("detail.patientMetaSaved"));
      await loadPatientData();
    } catch (error) {
      console.error("Error saving intake:", error);
      showFeedback(t("detail.patientMetaSaveError"), "error");
    }
  };

  const handleSavePatientMeta = async () => {
    try {
      setSavingPatient(true);
      const payload = {
        next_visit_date: statusForm.next_visit_date || null,
      };
      const response = await api.patch(`patients/${id}/update/`, payload);
      setPatient((prev) => ({ ...prev, ...response.data }));
      showFeedback(t("detail.patientMetaSaved"));
    } catch (error) {
      console.error("Error updating patient:", error);
      showFeedback(t("detail.patientMetaSaveError"), "error");
    } finally {
      setSavingPatient(false);
    }
  };

  const handleDemographicsFieldChange = (field, value) => {
    setDemographicsForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveDemographics = async () => {
    try {
      setSavingDemographics(true);
      const payload = {
        email: demographicsForm.email.trim() || null,
        age: demographicsForm.age === "" ? null : Number(demographicsForm.age),
        sex: demographicsForm.sex === "" ? null : Number(demographicsForm.sex),
        height_cm: demographicsForm.height_cm === "" ? null : Number(demographicsForm.height_cm),
        weight_kg: demographicsForm.weight_kg === "" ? null : Number(demographicsForm.weight_kg),
      };
      const response = await api.patch(`patients/${id}/update/`, payload);
      setPatient((prev) => ({ ...prev, ...response.data }));
      showFeedback(t("detail.demographicsSaved"));
    } catch (error) {
      console.error("Error saving demographics:", error);
      showFeedback(t("detail.demographicsSaveError"), "error");
    } finally {
      setSavingDemographics(false);
    }
  };

  const handleSaveDoctorOrder = async () => {
    try {
      setSavingDoctorOrder(true);
      const { data } = await api.patch(`patients/${id}/doctor-order/`, { order_text: doctorOrderText });
      setPatient((prev) => ({ ...prev, doctor_order_text: data.order_text ?? doctorOrderText }));
      setDoctorOrderRevisions(Array.isArray(data.revisions) ? data.revisions : []);
      showFeedback(t("detail.doctorOrderSaved"));
    } catch (error) {
      console.error("Error saving doctor order:", error);
      showFeedback(t("detail.doctorOrderSaveError"), "error");
    } finally {
      setSavingDoctorOrder(false);
    }
  };

  const handleDownloadDoctorOrderPdf = async () => {
    try {
      const response = await api.get(`patients/${id}/doctor-order/pdf/`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `patient_${id}_doctor_order.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading doctor order PDF:", error);
      showFeedback(t("detail.doctorOrderPdfError"), "error");
    }
  };

  const doctorOrderSnippet = (text) => {
    const line = String(text || "")
      .trim()
      .split(/\r?\n/)
      .find((l) => l.trim());
    if (!line) return "—";
    return line.length > 96 ? `${line.slice(0, 96)}…` : line;
  };

  const handleRestoreDoctorOrderRevision = (revision) => {
    if (!revision) return;
    setDoctorOrderText(revision.order_text ?? "");
    showFeedback(t("detail.doctorOrderRestored"));
  };

  const resetNoteForm = () => {
    setEditingNoteId(null);
    setNoteForm({
      text: "",
      category: "general",
      pinned: false,
    });
  };

  const handleNoteFieldChange = (field, value) => {
    setNoteForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmitNote = async () => {
    if (!noteForm.text.trim()) {
      showFeedback(t("detail.noteValidationError"), "error");
      return;
    }

    try {
      setNoteSubmitting(true);
      const payload = {
        ...noteForm,
        doctor_id: user?.id || null,
      };
      if (editingNoteId) {
        await api.patch(`patients/${id}/notes/${editingNoteId}/`, payload);
        showFeedback(t("detail.noteUpdated"));
      } else {
        await api.post(`patients/${id}/notes/`, payload);
        showFeedback(t("detail.noteCreated"));
      }
      resetNoteForm();
      await loadPatientData();
    } catch (error) {
      console.error("Error saving note:", error);
      showFeedback(t("detail.noteSaveError"), "error");
    } finally {
      setNoteSubmitting(false);
    }
  };

  const handleEditNote = (note) => {
    setEditingNoteId(note.id);
    setNoteForm({
      text: note.text || "",
      category: note.category || "general",
      pinned: !!note.pinned,
    });
  };

  const handleDeleteNote = async (noteId) => {
    const confirmed = window.confirm(t("detail.deleteNoteConfirm"));
    if (!confirmed) return;

    try {
      await api.delete(`patients/${id}/notes/${noteId}/`);
      if (editingNoteId === noteId) {
        resetNoteForm();
      }
      await loadPatientData();
      showFeedback(t("detail.noteDeleted"));
    } catch (error) {
      console.error("Error deleting note:", error);
      showFeedback(t("detail.noteDeleteError"), "error");
    }
  };

  const handleDeletePatient = async () => {
    const confirmed = window.confirm(t("detail.deletePatientConfirm"));
    if (!confirmed) return;

    try {
      await api.delete(`patients/${id}/delete/`);
      showFeedback(t("detail.patientDeleted"));
      setTimeout(() => navigate("/"), 400);
    } catch (error) {
      console.error("Error deleting patient:", error);
      showFeedback(t("detail.patientDeleteError"), "error");
    }
  };

  const handleDownloadPatientPdf = async () => {
    try {
      const response = await api.get(`patients/${id}/pdf/`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `patient_${id}_report.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading patient PDF:", error);
      showFeedback(t("detail.patientPdfError"), "error");
    }
  };

  const handleEditLabResult = (lab) => {
    setEditingLabResultId(lab.id);
    setLabEditForm({
      date: lab.date || "",
      values: (lab.values || []).map((value) => ({
        id: value.id,
        indicator_id: value.indicator,
        indicator_name: value.indicator_name,
        indicator_unit: value.indicator_unit,
        value: value.value ?? "",
      })),
      new_indicator_id: "",
      new_value: "",
    });
  };

  const handleLabValueChange = (valueId, indicatorId, newValue) => {
    setLabEditForm((prev) => ({
      ...prev,
      values: prev.values.map((item) =>
        (valueId ? item.id === valueId : Number(item.indicator_id) === Number(indicatorId))
          ? {
              ...item,
              value: newValue,
            }
          : item
      ),
    }));
  };

  const resetLabEditForm = () => {
    setEditingLabResultId(null);
    setLabEditForm({
      date: "",
      values: [],
      new_indicator_id: "",
      new_value: "",
    });
  };

  const handleLabNewFieldChange = (field, value) => {
    setLabEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddLabIndicator = () => {
    const indicatorId = Number(labEditForm.new_indicator_id);
    const numericValue = labEditForm.new_value;

    if (!indicatorId || numericValue === "") {
      showFeedback(t("detail.labAddValidationError"), "error");
      return;
    }

    if (labEditForm.values.some((item) => Number(item.indicator_id) === indicatorId)) {
      showFeedback(t("detail.labDuplicateIndicator"), "error");
      return;
    }

    const selectedIndicator = labIndicators.find((indicator) => indicator.id === indicatorId);
    if (!selectedIndicator) {
      showFeedback(t("detail.labIndicatorNotFound"), "error");
      return;
    }

    setLabEditForm((prev) => ({
      ...prev,
      values: [
        ...prev.values,
        {
          id: null,
          indicator_id: selectedIndicator.id,
          indicator_name: selectedIndicator.name,
          indicator_unit: selectedIndicator.unit,
          value: numericValue,
        },
      ],
      new_indicator_id: "",
      new_value: "",
    }));
  };

  const handleRemoveLabValue = (indicatorId, valueId) => {
    setLabEditForm((prev) => ({
      ...prev,
      values: prev.values.filter(
        (item) => !(item.id === valueId || Number(item.indicator_id) === Number(indicatorId))
      ),
    }));
  };

  const handleSaveLabResult = async () => {
    try {
      setSavingLabResult(true);
      await api.patch(`patients/${id}/labs/${editingLabResultId}/`, {
        date: labEditForm.date,
        values: labEditForm.values.map((value) => ({
          ...(value.id ? { id: value.id } : { indicator: value.indicator_id }),
          value: Number(value.value),
        })),
      });
      resetLabEditForm();
      await loadPatientData();
      showFeedback(t("detail.labSaved"));
    } catch (error) {
      console.error("Error saving lab result:", error);
      showFeedback(t("detail.labSaveError"), "error");
    } finally {
      setSavingLabResult(false);
    }
  };

  const handleDeleteLabResult = async (labResultId) => {
    const confirmed = window.confirm(t("detail.deleteLabConfirm"));
    if (!confirmed) return;

    try {
      await api.delete(`patients/${id}/labs/${labResultId}/`);
      if (editingLabResultId === labResultId) {
        resetLabEditForm();
      }
      await loadPatientData();
      showFeedback(t("detail.labDeleted"));
    } catch (error) {
      console.error("Error deleting lab result:", error);
      showFeedback(t("detail.labDeleteError"), "error");
    }
  };

  const nextVisitState = getVisitState(statusForm.next_visit_date || patient?.next_visit_date);
  const editingLabResult = useMemo(
    () => labs.find((lab) => lab.id === editingLabResultId) || null,
    [editingLabResultId, labs]
  );
  const availableIndicatorsForEdit = useMemo(() => {
    const selectedIds = new Set(labEditForm.values.map((item) => Number(item.indicator_id)).filter(Boolean));
    return labIndicators.filter((indicator) => !selectedIds.has(Number(indicator.id)));
  }, [labEditForm.values, labIndicators]);

  const chartPoints = assessmentTrend.chart_points || [];
  const labChartPoints = labTrend.chart_points || [];

  const getAssessmentNameForChartPoint = useCallback(
    (p) => {
      if (p?.questionnaire_title) return p.questionnaire_title;
      const a = assessments.find((x) => Number(x.id) === Number(p?.assessment_id));
      if (!a) return t("common.noData");
      return a.questionnaire_title || t("detail.questionnaireFallback", { id: a.questionnaire });
    },
    [assessments, t],
  );
  const abnormalLabCount = useMemo(
    () =>
      labs.reduce(
        (total, lab) =>
          total + (lab.values || []).filter((value) => value.status === "above" || value.status === "below").length,
        0
      ),
    [labs]
  );
  const quickStats = [
    { label: t("detail.assessmentsCount"), value: assessments.length },
    { label: t("detail.labCount"), value: labs.length },
    { label: t("detail.notesCount"), value: notes.length },
    {
      label: t("detail.lastScore"),
      value: lastAssessment ? lastAssessment.total_score : t("common.noData"),
    },
  ];
  const patientAlerts = [
    {
      label: t("detail.status"),
      value: getStatusLabel(patient?.status || "monitoring"),
      color: getStatusColor(patient?.status || "monitoring"),
    },
    {
      label: t("detail.nextVisit"),
      value: nextVisitState.label,
      color: nextVisitState.color,
    },
    {
      label: t("detail.abnormalLabs"),
      value: abnormalLabCount,
      color: abnormalLabCount > 0 ? "warning" : "success",
    },
  ];
  const clinicalSummary = useMemo(() => {
    const riskFactors = [];
    let riskScore = 0;

    const status = patient?.status || "monitoring";
    if (status === "critical") {
      riskScore += 4;
      riskFactors.push(t("detail.summaryFactors.criticalStatus"));
    } else if (status === "attention") {
      riskScore += 3;
      riskFactors.push(t("detail.summaryFactors.attentionStatus"));
    } else if (status === "monitoring") {
      riskScore += 1;
      riskFactors.push(t("detail.summaryFactors.monitoringStatus"));
    }

    if (nextVisitState.color === "error") {
      riskScore += 3;
      riskFactors.push(t("detail.summaryFactors.overdueVisit"));
    } else if (nextVisitState.color === "warning") {
      riskScore += 2;
      riskFactors.push(t("detail.summaryFactors.visitToday"));
    } else if (!patient?.next_visit_date) {
      riskScore += 1;
      riskFactors.push(t("detail.summaryFactors.noVisitPlanned"));
    }

    if (abnormalLabCount >= 5) {
      riskScore += 3;
      riskFactors.push(t("detail.summaryFactors.manyAbnormalLabs"));
    } else if (abnormalLabCount > 0) {
      riskScore += 2;
      riskFactors.push(t("detail.summaryFactors.someAbnormalLabs"));
    }

    if (lastAssessment) {
      if (lastAssessment.total_score >= 7) {
        riskScore += 3;
        riskFactors.push(t("detail.summaryFactors.highAssessmentScore"));
      } else if (lastAssessment.total_score >= 4) {
        riskScore += 2;
        riskFactors.push(t("detail.summaryFactors.mediumAssessmentScore"));
      }
    } else {
      riskFactors.push(t("detail.summaryFactors.noAssessmentsYet"));
    }

    if (notes.length === 0) {
      riskFactors.push(t("detail.summaryFactors.noDoctorNotes"));
    }

    let level = "stable";
    let color = "success";

    if (riskScore >= 8) {
      level = "high";
      color = "error";
    } else if (riskScore >= 4) {
      level = "moderate";
      color = "warning";
    }

    return {
      level,
      color,
      score: riskScore,
      title: t(`detail.summaryLevels.${level}.title`),
      description: t(`detail.summaryLevels.${level}.description`),
      factors: riskFactors.slice(0, 4),
    };
  }, [patient, nextVisitState, abnormalLabCount, lastAssessment, notes.length, t]);
  const getLabSetSummary = (lab) => {
    const values = lab.values || [];
    const abnormalCount = values.filter((value) => value.status === "above" || value.status === "below").length;
    return {
      total: values.length,
      abnormal: abnormalCount,
      normal: values.length - abnormalCount,
    };
  };
  const scoreYStats = useMemo(() => {
    if (chartPoints.length < 2) return { min: 0, max: 0 };
    const scores = chartPoints.map((p) => p.total_score);
    return { min: Math.min(...scores), max: Math.max(...scores) };
  }, [chartPoints]);

  const labYStats = useMemo(() => {
    if (labChartPoints.length < 2) return { min: 0, max: 0 };
    const values = labChartPoints.map((p) => p.value);
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [labChartPoints]);

  const toggleLabSetExpanded = (labId) => {
    setExpandedLabSets((prev) => ({ ...prev, [labId]: !prev[labId] }));
  };
  const getLabPointColor = (point) => {
    if (point.min_norm !== null && point.min_norm !== undefined && point.value < point.min_norm)
      return theme.palette.warning.main;
    if (point.max_norm !== null && point.max_norm !== undefined && point.value > point.max_norm)
      return theme.palette.error.main;
    return theme.palette.primary.main;
  };
  const getRiskLevelColor = (level) => {
    if (level === "high" || level === "critical") return theme.palette.error.main;
    if (level === "moderate" || level === "elevated") return theme.palette.warning.main;
    return theme.palette.success.main;
  };
  const getRiskCategory = (problemCode) => {
    const c = String(problemCode || "");
    if (c.includes("metabolic") || c.includes("hyperglycemia_symptom")) return "metabolic";
    if (c.includes("cardio") || c.includes("dyslipidemia")) return "cardiovascular";
    if (c.includes("anemia") || c.includes("iron_deficiency")) return "anemia";
    if (c.includes("psycho") || c.includes("depressive")) return "psychoemotional";
    return "other";
  };
  const getLocalizedUrgency = (value) => {
    const normalized = String(value || "").toLowerCase();
    return t(`detail.urgencyLevels.${normalized}`, { defaultValue: value || t("common.noData") });
  };
  const getLocalizedTriggerSign = (value) => {
    const key = `detail.redFlagTriggers.${String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")}`;
    return t(key, { defaultValue: value || t("common.noData") });
  };
  const getLocalizedRedFlagAction = (value) => {
    const key = `detail.redFlagActions.${String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")}`;
    return t(key, { defaultValue: value || t("common.noData") });
  };
  const filteredRiskFindings = useMemo(() => {
    const findings = riskProfile?.findings || [];
    const filtered =
      riskCategoryFilter === "all"
        ? findings
        : findings.filter((item) => getRiskCategory(item.problem_code) === riskCategoryFilter);

    const severityWeight = { critical: 5, high: 4, elevated: 3, moderate: 2, low: 1 };
    if (riskSortMode === "probability") {
      return [...filtered].sort((a, b) => (b.ml_probability || 0) - (a.ml_probability || 0));
    }
    return [...filtered].sort((a, b) => {
      const sevDiff = (severityWeight[b.risk_level] || 0) - (severityWeight[a.risk_level] || 0);
      if (sevDiff !== 0) return sevDiff;
      return (b.ml_probability || 0) - (a.ml_probability || 0);
    });
  }, [riskProfile, riskCategoryFilter, riskSortMode]);
  const handleRecalculateRisk = async () => {
    try {
      setRecalculatingRisk(true);
      const [profileResponse, historyResponse] = await Promise.all([
        api.post(`patients/${id}/risk-profile/`),
        api.get(`patients/${id}/risk-history/`),
      ]);
      setRiskProfile(profileResponse.data || null);
      setRiskHistory(historyResponse.data || { chart_points: [], stats: { count: 0, latest_level: "low" } });
      showFeedback(t("detail.riskRecalculated"));
    } catch (error) {
      console.error("Error recalculating risk profile:", error);
      showFeedback(t("detail.riskRecalculateError"), "error");
    } finally {
      setRecalculatingRisk(false);
    }
  };

  const handleLabFilterChange = (field, value) => {
    setLabFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
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

  if (!patient) {
    return (
      <Box sx={{ py: 2 }}>
        <Typography>{accessDenied ? t("detail.accessDenied") : t("detail.notFound")}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ py: { xs: 1, md: 1.5 }, maxWidth: 1380, mx: "auto" }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 3 },
            mb: 3,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <Grid container spacing={3} alignItems="flex-start">
            <Grid item xs={12} md={8}>
              <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: "0.06em" }}>
                {t("detail.patientDashboard")}
              </Typography>
              <Typography variant="h4" sx={{ mb: 0.5 }}>
                {patient.full_name}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 720 }}>
                {t("detail.dashboardSubtitle")}
              </Typography>

              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 2 }}>
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${t("detail.patientId")}: ${patient.patient_code || t("common.noData")}`}
                />
                <Chip size="small" variant="outlined" label={`${t("detail.age")}: ${patient.age ?? t("common.noData")}`} />
                <Chip size="small" variant="outlined" label={getSexLabel(patient.sex)} />
                <Chip size="small" label={getStatusLabel(patient.status || "monitoring")} color={getStatusColor(patient.status || "monitoring")} />
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2.5 }}>
                <Button variant="contained" component={Link} to={`/patients/${patient.id}/questionnaires`}>
                  {t("detail.openQuestionnaires")}
                </Button>
                <Button variant="outlined" onClick={handleDownloadPatientPdf}>
                  {t("detail.downloadPatientPdf")}
                </Button>
                <Button variant="text" component={Link} to="/" color="inherit">
                  {t("detail.backToPatients")}
                </Button>
              </Stack>

              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={{ height: "100%", bgcolor: "grey.50", minHeight: 132 }}>
                    <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        {t("detail.nextVisit")}
                      </Typography>
                      <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                        {patient.next_visit_date ? formatDateOnly(patient.next_visit_date) : t("common.noData")}
                      </Typography>
                      <Chip label={nextVisitState.label} color={nextVisitState.color} size="small" sx={{ mt: "auto", width: "fit-content" }} />
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={{ height: "100%", bgcolor: "grey.50", minHeight: 132 }}>
                    <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        {t("detail.lastScore")}
                      </Typography>
                      <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                        {lastAssessment ? lastAssessment.total_score : t("common.noData")}
                      </Typography>
                      {lastAssessment ? (
                        <Chip
                          label={t(`detail.scoreStates.${getAssessmentSeverity(lastAssessment.total_score)}`)}
                          color={getAssessmentSeverity(lastAssessment.total_score)}
                          size="small"
                          sx={{ mt: "auto", width: "fit-content" }}
                        />
                      ) : null}
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card sx={{ height: "100%", bgcolor: "grey.50", minHeight: 132 }}>
                    <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        {t("detail.abnormalLabs")}
                      </Typography>
                      <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                        {abnormalLabCount}
                      </Typography>
                      <Chip label={clinicalSummary.title} color={clinicalSummary.color} size="small" sx={{ mt: "auto", width: "fit-content" }} />
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card sx={{ height: "100%", bgcolor: "grey.50" }}>
                <CardContent sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                    {t("detail.clinicalSummary")}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {clinicalSummary.description}
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 2 }}>
                    <Chip label={clinicalSummary.title} color={clinicalSummary.color} size="small" />
                    <Chip
                      label={t("detail.summaryScore", { score: clinicalSummary.score })}
                      variant="outlined"
                      size="small"
                    />
                  </Stack>
                  <Stack spacing={1} sx={{ flex: 1 }}>
                    {clinicalSummary.factors.map((factor) => (
                      <Box
                        key={factor}
                        sx={{
                          p: 1.25,
                          borderRadius: 1,
                          bgcolor: "background.paper",
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Typography variant="body2">{factor}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Paper>

        <Grid container spacing={2.5}>
          <Grid item xs={12} sm={6} lg={3}>
            <Card sx={{ borderRadius: 4, boxShadow: "none", border: "1px solid", borderColor: "divider" }}>
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                  {quickStats[0].label}
                </Typography>
                <Typography variant="h5" fontWeight={700}>
                  {quickStats[0].value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <Card sx={{ borderRadius: 4, boxShadow: "none", border: "1px solid", borderColor: "divider" }}>
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                  {quickStats[1].label}
                </Typography>
                <Typography variant="h5" fontWeight={700}>
                  {quickStats[1].value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <Card sx={{ borderRadius: 4, boxShadow: "none", border: "1px solid", borderColor: "divider" }}>
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                  {quickStats[2].label}
                </Typography>
                <Typography variant="h5" fontWeight={700}>
                  {quickStats[2].value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <Card sx={{ borderRadius: 4, boxShadow: "none", border: "1px solid", borderColor: "divider" }}>
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                  {quickStats[3].label}
                </Typography>
                <Typography variant="h5" fontWeight={700}>
                  {quickStats[3].value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={2.5} sx={{ mt: 0.25 }}>
          <Grid item xs={12}>
            <Stack spacing={3}>
              <Card sx={{ borderRadius: 3.5 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    {t("detail.summary")}
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  <Box sx={{ display: "grid", gap: 1.2 }}>
                    <Typography>
                      <strong>{t("detail.latestQuestionnaire")}:</strong>{" "}
                      {lastAssessment ? getQuestionnaireLabel(lastAssessment) : t("common.noData")}
                    </Typography>
                    <Typography>
                      <strong>{t("detail.abnormalLabs")}:</strong> {abnormalLabCount}
                    </Typography>
                    <Typography>
                      <strong>{t("detail.mainNoteStatus")}:</strong>{" "}
                      {pinnedNote ? t("detail.available") : t("detail.notAvailable")}
                    </Typography>
                    <Typography>
                      <strong>{t("detail.lastScore")}:</strong>{" "}
                      {lastAssessment ? lastAssessment.total_score : t("common.noData")}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>

              <Card sx={{ borderRadius: 3.5 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    {t("detail.carePlan")}
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                        {t("detail.status")}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center" useFlexGap sx={{ flexWrap: "wrap" }}>
                        <Chip
                          size="small"
                          label={getStatusLabel(patient.status || "monitoring")}
                          color={getStatusColor(patient.status || "monitoring")}
                        />
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                        {t("detail.statusAutoHint")}
                      </Typography>
                    </Box>

                    <TextField
                      label={t("detail.nextVisit")}
                      type="date"
                      fullWidth
                      size="small"
                      value={statusForm.next_visit_date}
                      onChange={(event) => handlePatientFieldChange("next_visit_date", event.target.value)}
                      InputLabelProps={{ shrink: true }}
                      slotProps={{ inputLabel: { shrink: true } }}
                      sx={{
                        "& .MuiInputBase-input": { pt: 1.35 },
                      }}
                    />

                    <Chip
                      label={nextVisitState.label}
                      color={nextVisitState.color}
                      variant="outlined"
                      sx={{ width: "fit-content", fontWeight: 700 }}
                    />

                    <Button variant="contained" onClick={handleSavePatientMeta} disabled={savingPatient}>
                      {savingPatient ? t("detail.saving") : t("detail.saveCarePlan")}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>

              <Card sx={{ borderRadius: 3.5 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    {t("detail.personalProfile")}
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Stack spacing={2}>
                    <TextField
                      type="email"
                      label={t("patients.email")}
                      fullWidth
                      size="small"
                      value={demographicsForm.email}
                      onChange={(e) => handleDemographicsFieldChange("email", e.target.value)}
                    />
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <TextField
                        type="number"
                        label={t("detail.age")}
                        fullWidth
                        size="small"
                        value={demographicsForm.age}
                        onChange={(e) => handleDemographicsFieldChange("age", e.target.value)}
                      />
                      <TextField
                        select
                        label={t("detail.sex")}
                        fullWidth
                        size="small"
                        value={demographicsForm.sex === "" ? "" : String(demographicsForm.sex)}
                        onChange={(e) => handleDemographicsFieldChange("sex", e.target.value)}
                      >
                        <MenuItem value="">{t("common.noData")}</MenuItem>
                        <MenuItem value="1">{t("detail.male")}</MenuItem>
                        <MenuItem value="2">{t("detail.female")}</MenuItem>
                      </TextField>
                    </Stack>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <TextField
                        type="number"
                        label={`${t("detail.height")} (cm)`}
                        fullWidth
                        size="small"
                        value={demographicsForm.height_cm}
                        onChange={(e) => handleDemographicsFieldChange("height_cm", e.target.value)}
                      />
                      <TextField
                        type="number"
                        label={`${t("detail.weight")} (kg)`}
                        fullWidth
                        size="small"
                        value={demographicsForm.weight_kg}
                        onChange={(e) => handleDemographicsFieldChange("weight_kg", e.target.value)}
                      />
                    </Stack>
                    <Button variant="contained" onClick={handleSaveDemographics} disabled={savingDemographics}>
                      {savingDemographics ? t("detail.saving") : t("detail.saveDemographics")}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>

              <Card sx={{ borderRadius: 3.5 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    {t("detail.doctorOrderTitle")}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {t("detail.doctorOrderSubtitle")}
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Stack spacing={2}>
                    <TextField
                      label={t("detail.doctorOrderField")}
                      multiline
                      minRows={6}
                      fullWidth
                      value={doctorOrderText}
                      onChange={(e) => setDoctorOrderText(e.target.value)}
                    />
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <Button variant="contained" onClick={handleSaveDoctorOrder} disabled={savingDoctorOrder}>
                        {savingDoctorOrder ? t("detail.saving") : t("detail.saveDoctorOrder")}
                      </Button>
                      <Button variant="outlined" onClick={handleDownloadDoctorOrderPdf}>
                        {t("detail.downloadDoctorOrderPdf")}
                      </Button>
                    </Stack>
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                        {t("detail.doctorOrderHistoryTitle")}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                        {t("detail.doctorOrderHistoryHint")}
                      </Typography>
                      {doctorOrderRevisions.length ? (
                        <List dense disablePadding sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                          {doctorOrderRevisions.map((rev) => (
                            <ListItemButton
                              key={rev.id}
                              onClick={() => handleRestoreDoctorOrderRevision(rev)}
                              alignItems="flex-start"
                            >
                              <ListItemText
                                primary={formatDate(rev.created_at)}
                                secondary={doctorOrderSnippet(rev.order_text)}
                                primaryTypographyProps={{ variant: "body2", fontWeight: 600 }}
                                secondaryTypographyProps={{ variant: "caption", sx: { whiteSpace: "normal" } }}
                              />
                            </ListItemButton>
                          ))}
                        </List>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          {t("detail.doctorOrderHistoryEmpty")}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                </CardContent>
              </Card>

              <Card sx={{ borderRadius: 3.5 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    {t("detail.latestAssessment")}
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  {lastAssessment ? (
                    <Box sx={{ display: "grid", gap: 1.2 }}>
                      <Typography>
                        <strong>{t("detail.questionnaire")}:</strong> {getQuestionnaireLabel(lastAssessment)}
                      </Typography>
                      <Typography>
                        <strong>{t("detail.totalScore")}:</strong> {lastAssessment.total_score}
                      </Typography>
                      <Typography>
                        <strong>{t("detail.conclusion")}:</strong> {getConclusionLabel(lastAssessment)}
                      </Typography>
                      <Button
                        component={Link}
                        to={`/patients/${id}/assessments/${lastAssessment.id}`}
                        variant="outlined"
                        sx={{ mt: 1 }}
                      >
                        {t("detail.viewResult")}
                      </Button>
                    </Box>
                  ) : (
                    <Typography color="text.secondary">{t("detail.noAssessments")}</Typography>
                  )}
                </CardContent>
              </Card>

              <Button color="error" variant="text" fullWidth onClick={handleDeletePatient}>
                {t("detail.deletePatient")}
              </Button>
            </Stack>
          </Grid>

          <Grid item xs={12}>
            <Stack spacing={3}>
              <Card sx={{ borderRadius: 4 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h5" gutterBottom>
                    {t("detail.intakeTitle")}
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  <Stack spacing={1.5}>
                    <TextField
                      label={t("detail.intakeChiefComplaint")}
                      multiline
                      minRows={2}
                      value={intakeForm.chief_complaint}
                      onChange={(e) => handleIntakeFieldChange("chief_complaint", e.target.value)}
                    />
                    <TextField
                      label={t("detail.intakeChronic")}
                      multiline
                      minRows={2}
                      value={intakeForm.chronic_conditions}
                      onChange={(e) => handleIntakeFieldChange("chronic_conditions", e.target.value)}
                    />
                    <TextField
                      label={t("detail.intakeMedications")}
                      multiline
                      minRows={2}
                      value={intakeForm.medications}
                      onChange={(e) => handleIntakeFieldChange("medications", e.target.value)}
                    />
                    <TextField
                      label={t("detail.intakeAllergies")}
                      multiline
                      minRows={2}
                      value={intakeForm.allergies}
                      onChange={(e) => handleIntakeFieldChange("allergies", e.target.value)}
                    />
                    <TextField
                      label={t("detail.intakeFamily")}
                      multiline
                      minRows={2}
                      value={intakeForm.family_history}
                      onChange={(e) => handleIntakeFieldChange("family_history", e.target.value)}
                    />
                    <TextField
                      label={t("detail.intakeHabits")}
                      multiline
                      minRows={2}
                      value={intakeForm.habits}
                      onChange={(e) => handleIntakeFieldChange("habits", e.target.value)}
                    />
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                      <TextField
                        fullWidth
                        label={t("detail.intakeBloodPressure")}
                        value={intakeForm.blood_pressure}
                        onChange={(e) => handleIntakeFieldChange("blood_pressure", e.target.value)}
                      />
                      <TextField
                        fullWidth
                        label={t("detail.intakeTemperature")}
                        value={intakeForm.temperature}
                        onChange={(e) => handleIntakeFieldChange("temperature", e.target.value)}
                      />
                    </Stack>
                    <Button variant="contained" onClick={handleSaveIntake}>
                      {t("detail.saveCarePlan")}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>

              {pinnedNote ? (
                <Card
                  sx={{
                    borderRadius: 4,
                    border: "1px solid",
                    borderColor: alpha(theme.palette.primary.main, 0.32),
                    bgcolor: alpha(theme.palette.primary.main, 0.03),
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      justifyContent="space-between"
                      alignItems={{ xs: "flex-start", md: "center" }}
                      spacing={2}
                      sx={{ mb: 2 }}
                    >
                      <Box>
                        <Typography variant="h5">{t("detail.mainNote")}</Typography>
                        <Typography color="text.secondary">
                          {pinnedNote.doctor_full_name || pinnedNote.doctor_username || t("common.noData")}
                        </Typography>
                      </Box>
                      <Chip label={t("detail.pinned")} color="primary" />
                    </Stack>
                    <Typography sx={{ mb: 1.5 }}>{pinnedNote.text}</Typography>
                    <Typography color="text.secondary">
                      <strong>{t("detail.date")}:</strong> {formatDate(pinnedNote.created_at)}
                    </Typography>
                  </CardContent>
                </Card>
              ) : null}

              <Card sx={{ borderRadius: 3.5 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h5" gutterBottom>
                    {t("detail.scoreTrend")}
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  {chartPoints.length === 0 ? (
                    <Typography color="text.secondary">{t("detail.noScoreTrend")}</Typography>
                  ) : (
                    <>
                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={12} md={4}>
                          <Card variant="outlined" sx={{ borderRadius: 4 }}>
                            <CardContent>
                              <Typography variant="body2" color="text.secondary">
                                {t("detail.trendCount")}
                              </Typography>
                              <Typography variant="h5">{assessmentTrend.stats?.count || 0}</Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Card variant="outlined" sx={{ borderRadius: 4 }}>
                            <CardContent>
                              <Typography variant="body2" color="text.secondary">
                                {t("detail.trendLatest")}
                              </Typography>
                              <Typography variant="h5">{assessmentTrend.stats?.latest_score || 0}</Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Card variant="outlined" sx={{ borderRadius: 4 }}>
                            <CardContent>
                              <Typography variant="body2" color="text.secondary">
                                {t("detail.trendMax")}
                              </Typography>
                              <Typography variant="h5">{assessmentTrend.stats?.max_score || 0}</Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      </Grid>

                      <Card
                        variant="outlined"
                        sx={{
                          borderRadius: 3.5,
                          border: "1px solid",
                          borderColor: "divider",
                          background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${theme.palette.background.paper} 100%)`,
                        }}
                      >
                        <CardContent>
                          {chartPoints.length === 1 ? (
                            <Typography color="text.secondary">{t("detail.needMoreAssessments")}</Typography>
                          ) : (
                            <Box>
                              <Box
                                sx={{
                                  minHeight: 272,
                                  width: "100%",
                                  mb: 2,
                                  px: { xs: 0.25, sm: 1 },
                                  py: 1.5,
                                  borderRadius: 3,
                                  backgroundColor: "background.paper",
                                  border: "1px solid",
                                  borderColor: "divider",
                                }}
                              >
                                <MedicalLineChart
                                  points={chartPoints}
                                  getY={(p) => p.total_score}
                                  getKey={(p) => p.assessment_id}
                                  segmentColor={(_prev, curr) => scoreSeverityColor(curr.total_score)}
                                  pointColor={(p) => scoreSeverityColor(p.total_score)}
                                  formatY={(v) =>
                                    Math.abs(v - Math.round(v)) < 1e-6 ? String(Math.round(v)) : Number(v).toFixed(1)
                                  }
                                  formatX={(p) => formatDate(p.label)}
                                  pointCaption={(p) => getAssessmentNameForChartPoint(p)}
                                  pointTitle={(p) =>
                                    `${getAssessmentNameForChartPoint(p)}\n${formatDate(p.label)}\n${t("detail.totalScore")}: ${p.total_score}`
                                  }
                                />
                              </Box>
                              <Stack
                                direction="row"
                                justifyContent="space-between"
                                sx={{ mb: 2, px: 0.5, flexWrap: "wrap", gap: 1 }}
                              >
                                <Typography variant="caption" color="text.secondary">
                                  {t("detail.trendMin")}: {scoreYStats.min}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {t("detail.trendMax")}: {scoreYStats.max}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {t("detail.trendLatest")}: {assessmentTrend.stats?.latest_score || 0}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {t("detail.trendCount")}: {assessmentTrend.stats?.count || 0}
                                </Typography>
                              </Stack>
                              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 2 }}>
                                <Chip label={t("detail.scoreStates.success")} size="small" sx={{ bgcolor: "success.light", color: "success.dark" }} />
                                <Chip label={t("detail.scoreStates.warning")} size="small" sx={{ bgcolor: "warning.light", color: "warning.dark" }} />
                                <Chip label={t("detail.scoreStates.error")} size="small" sx={{ bgcolor: "error.light", color: "error.dark" }} />
                              </Stack>

                              <Typography variant="h6" sx={{ mb: 1.5 }}>
                                {t("detail.assessments")}
                              </Typography>
                              {assessments.length === 0 ? (
                                <Typography color="text.secondary">{t("detail.noAssessmentFound")}</Typography>
                              ) : (
                                <Grid container spacing={2}>
                                  {assessments.map((assessment) => (
                                    <Grid item xs={12} md={6} key={assessment.id}>
                                      <Card variant="outlined" sx={{ borderRadius: 3 }}>
                                        <CardContent>
                                          <Stack
                                            direction={{ xs: "column", sm: "row" }}
                                            justifyContent="space-between"
                                            spacing={1.5}
                                            sx={{ mb: 1 }}
                                          >
                                            <Typography sx={{ fontWeight: 700 }}>
                                              {getQuestionnaireLabel(assessment)}
                                            </Typography>
                                            <Chip
                                              label={t(
                                                `detail.scoreStates.${getAssessmentSeverity(assessment.total_score)}`
                                              )}
                                              color={getAssessmentSeverity(assessment.total_score)}
                                              size="small"
                                              variant="outlined"
                                              sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
                                            />
                                          </Stack>
                                          <Typography sx={{ mb: 1 }}>
                                            <strong>{t("detail.assessmentId")}:</strong> {assessment.id}
                                          </Typography>
                                          <Typography sx={{ mb: 1 }}>
                                            <strong>{t("detail.totalScore")}:</strong> {assessment.total_score}
                                          </Typography>
                                          <Typography sx={{ mb: 1 }}>
                                            <strong>{t("detail.conclusion")}:</strong> {getConclusionLabel(assessment)}
                                          </Typography>
                                          {assessment.interpretation?.visit_summary ? (
                                            <Typography sx={{ mb: 1 }} color="text.secondary">
                                              <strong>{t("detail.visitSummaryTitle")}:</strong>{" "}
                                              {assessment.interpretation.visit_summary.risk_level},{" "}
                                              {assessment.interpretation.visit_summary.completion_percent}%
                                            </Typography>
                                          ) : null}
                                          <Typography color="text.secondary" sx={{ mb: 2 }}>
                                            <strong>{t("detail.date")}:</strong> {formatDate(assessment.created_at)}
                                          </Typography>
                                          <Button
                                            component={Link}
                                            to={`/patients/${id}/assessments/${assessment.id}`}
                                            variant="outlined"
                                            size="small"
                                          >
                                            {t("detail.viewResult")}
                                          </Button>
                                        </CardContent>
                                      </Card>
                                    </Grid>
                                  ))}
                                </Grid>
                              )}
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card sx={{ borderRadius: 4 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h5" gutterBottom>
                    {t("detail.detectedRisksTitle")}
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  {!riskProfile || !riskProfile.findings || riskProfile.findings.length === 0 ? (
                    <Typography color="text.secondary">{t("detail.noRisksFound")}</Typography>
                  ) : (
                    <Stack spacing={2}>
                      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                        <TextField
                          select
                          size="small"
                          label={t("detail.riskCategoryFilter")}
                          value={riskCategoryFilter}
                          onChange={(event) => setRiskCategoryFilter(event.target.value)}
                          sx={{ maxWidth: 320 }}
                        >
                          <MenuItem value="all">{t("detail.riskCategories.all")}</MenuItem>
                          <MenuItem value="metabolic">{t("detail.riskCategories.metabolic")}</MenuItem>
                          <MenuItem value="cardiovascular">{t("detail.riskCategories.cardiovascular")}</MenuItem>
                          <MenuItem value="anemia">{t("detail.riskCategories.anemia")}</MenuItem>
                          <MenuItem value="psychoemotional">{t("detail.riskCategories.psychoemotional")}</MenuItem>
                          <MenuItem value="other">{t("detail.riskCategories.other")}</MenuItem>
                        </TextField>
                        <TextField
                          select
                          size="small"
                          label={t("detail.riskSortLabel")}
                          value={riskSortMode}
                          onChange={(event) => setRiskSortMode(event.target.value)}
                          sx={{ maxWidth: 280 }}
                        >
                          <MenuItem value="severity">{t("detail.riskSortModes.severity")}</MenuItem>
                          <MenuItem value="probability">{t("detail.riskSortModes.probability")}</MenuItem>
                        </TextField>
                        <Button
                          variant="outlined"
                          onClick={handleRecalculateRisk}
                          disabled={recalculatingRisk}
                        >
                          {recalculatingRisk ? t("detail.recalculatingRisk") : t("detail.recalculateRisk")}
                        </Button>
                      </Stack>
                      {filteredRiskFindings.map((finding) => (
                        <Card key={finding.id} variant="outlined" sx={{ borderRadius: 3 }}>
                          <CardContent>
                            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1}>
                              <Typography fontWeight={700}>{translateRiskProblemCode(t, finding.problem_code)}</Typography>
                              <Chip
                                label={translateRiskLevel(t, finding.risk_level)}
                                size="small"
                                color={finding.risk_level === "high" ? "error" : "warning"}
                              />
                            </Stack>
                            <Typography sx={{ mt: 1, mb: 1 }}>
                              <strong>{t("detail.evidenceTitle")}:</strong>{" "}
                              {(finding.evidence || []).map((line) => translateRiskEvidence(t, line)).join("; ")}
                            </Typography>
                            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 1 }}>
                              {finding.ml_probability !== null && finding.ml_probability !== undefined ? (
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={`${t("detail.mlProbability")}: ${Math.round(finding.ml_probability * 100)}%`}
                                />
                              ) : null}
                              {finding.confidence_score !== null && finding.confidence_score !== undefined ? (
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={`${t("detail.confidenceScore")}: ${Math.round(finding.confidence_score * 100)}%`}
                                />
                              ) : null}
                            </Stack>
                            {finding.recommendation ? (
                              <Typography color="text.secondary">
                                <strong>{t("detail.recommendationsTitle")}:</strong>{" "}
                                {(() => {
                                  const loc = translateFindingRecommendation(t, finding.recommendation);
                                  return `${loc.preliminary} ${loc.nextSteps}`.trim();
                                })()}
                              </Typography>
                            ) : null}
                          </CardContent>
                        </Card>
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>

              <Card sx={{ borderRadius: 4 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h5" gutterBottom>
                    {t("detail.riskDynamicsTitle")}
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  {!(riskHistory.chart_points || []).length ? (
                    <Typography color="text.secondary">{t("detail.noRiskDynamics")}</Typography>
                  ) : (
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                        <Chip label={t("detail.riskLegendLow")} size="small" sx={{ bgcolor: "success.light", color: "success.dark" }} />
                        <Chip label={t("detail.riskLegendModerate")} size="small" sx={{ bgcolor: "warning.light", color: "warning.dark" }} />
                        <Chip label={t("detail.riskLegendHigh")} size="small" sx={{ bgcolor: "error.light", color: "error.dark" }} />
                      </Stack>
                      <Box
                        sx={{
                          minHeight: 200,
                          borderRadius: 2,
                          border: "1px solid",
                          borderColor: "divider",
                          px: { xs: 0.25, sm: 0.5 },
                          py: 1,
                          backgroundColor: "background.paper",
                        }}
                      >
                        <RiskTimelineChart
                          points={(riskHistory.chart_points || []).slice(-8)}
                          colorForLevel={(lvl) => getRiskLevelColor(lvl)}
                          formatDate={formatDate}
                          axisLabels={{
                            critical: t("detail.riskAxisCritical"),
                            high: t("detail.riskAxisHigh"),
                            moderate: t("detail.riskAxisModerate"),
                            low: t("detail.riskAxisLow"),
                          }}
                          formatTooltip={(p) => {
                            const lines = [formatDate(p.label), String(p.overall_risk_level ?? "")];
                            if (p.findings_count != null && p.findings_count !== undefined) {
                              lines.push(t("detail.chartTooltipFindings", { count: p.findings_count }));
                            }
                            if (p.red_flags_count) {
                              lines.push(t("detail.chartTooltipRedFlags", { count: p.red_flags_count }));
                            }
                            return lines.filter(Boolean).join("\n");
                          }}
                        />
                      </Box>
                      {(riskHistory.chart_points || []).slice(-6).map((point) => (
                        <Box key={point.id}>
                          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(point.label)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {point.overall_risk_level}
                            </Typography>
                          </Stack>
                          <Box
                            sx={{
                              height: 8,
                              borderRadius: 2,
                              backgroundColor: alpha(theme.palette.text.primary, 0.08),
                              overflow: "hidden",
                            }}
                          >
                            <Box
                              sx={{
                                width: `${Math.min(100, (point.findings_count || 0) * 22 + (point.red_flags_count || 0) * 30)}%`,
                                height: "100%",
                                backgroundColor:
                                  point.red_flags_count > 0
                                    ? "error.main"
                                    : getRiskLevelColor(point.overall_risk_level),
                              }}
                            />
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>

              <Card sx={{ borderRadius: 4 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h5" gutterBottom>
                    {t("detail.redFlagsTitle")}
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  {!riskProfile || !riskProfile.red_flags || riskProfile.red_flags.length === 0 ? (
                    <Typography color="text.secondary">{t("detail.noRedFlags")}</Typography>
                  ) : (
                    <Stack spacing={2}>
                      {riskProfile.red_flags.map((flag) => (
                        <Alert key={flag.id} severity="error">
                          <Typography fontWeight={700}>
                            {`${t("detail.urgencyTitle")}: ${getLocalizedUrgency(flag.urgency_level)}`}
                          </Typography>
                          <Typography>
                            {`${t("detail.evidenceTitle")}: ${(flag.trigger_signs || [])
                              .map((item) => getLocalizedTriggerSign(item))
                              .join(", ")}`}
                          </Typography>
                          <Typography>
                            {`${t("detail.recommendationsTitle")}: ${getLocalizedRedFlagAction(flag.recommended_action)}`}
                          </Typography>
                          {flag.ml_probability != null && flag.ml_probability !== undefined ? (
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              {`${t("detail.redFlagMlProbability")}: ${Math.round(flag.ml_probability * 100)}%`}
                              {flag.ml_confidence != null && flag.ml_confidence !== undefined
                                ? ` · ${t("detail.confidenceScore")}: ${Math.round(flag.ml_confidence * 100)}%`
                                : ""}
                            </Typography>
                          ) : null}
                        </Alert>
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>

              <Card sx={{ borderRadius: 4 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h5" gutterBottom>
                    {t("detail.labs")}
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} md={4}>
                      <TextField
                        select
                        fullWidth
                        label={t("detail.labPeriod")}
                        value={labFilters.period}
                        onChange={(event) => handleLabFilterChange("period", event.target.value)}
                      >
                        <MenuItem value="all">{t("detail.labPeriods.all")}</MenuItem>
                        <MenuItem value="week">{t("detail.labPeriods.week")}</MenuItem>
                        <MenuItem value="month">{t("detail.labPeriods.month")}</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid item xs={12} md={8}>
                      <TextField
                        select
                        fullWidth
                        label={t("detail.labIndicator")}
                        value={labFilters.indicator_id}
                        onChange={(event) => handleLabFilterChange("indicator_id", event.target.value)}
                      >
                        <MenuItem value="">{t("detail.allIndicators")}</MenuItem>
                        {labTrend.indicator_options?.map((indicator) => (
                          <MenuItem key={indicator.id} value={indicator.id}>
                            {indicator.name}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                  </Grid>

                  <Card sx={{ mb: 3 }} variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {t("detail.labTrend")}
                      </Typography>

                      {labChartPoints.length === 0 ? (
                        <Typography color="text.secondary">{t("detail.noLabTrend")}</Typography>
                      ) : (
                        <>
                          <Grid container spacing={2} sx={{ mb: 2 }}>
                            <Grid item xs={12} md={4}>
                              <Card variant="outlined" sx={{ borderRadius: 4 }}>
                                <CardContent>
                                  <Typography variant="body2" color="text.secondary">
                                    {t("detail.trendCount")}
                                  </Typography>
                                  <Typography variant="h5">{labTrend.stats?.count || 0}</Typography>
                                </CardContent>
                              </Card>
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <Card variant="outlined" sx={{ borderRadius: 4 }}>
                                <CardContent>
                                  <Typography variant="body2" color="text.secondary">
                                    {t("detail.labLatestValue")}
                                  </Typography>
                                  <Typography variant="h5">
                                    {labTrend.stats?.latest_value ?? t("common.noData")}
                                  </Typography>
                                </CardContent>
                              </Card>
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <Card variant="outlined" sx={{ borderRadius: 4 }}>
                                <CardContent>
                                  <Typography variant="body2" color="text.secondary">
                                    {t("detail.labRange")}
                                  </Typography>
                                  <Typography variant="h5">
                                    {labTrend.stats?.min_value ?? t("common.noData")} -{" "}
                                    {labTrend.stats?.max_value ?? t("common.noData")}
                                  </Typography>
                                </CardContent>
                              </Card>
                            </Grid>
                          </Grid>

                          {labChartPoints.length === 1 ? (
                            <Typography color="text.secondary">{t("detail.needMoreLabResults")}</Typography>
                          ) : (
                            <Box
                              sx={{
                                minHeight: 272,
                                width: "100%",
                                px: { xs: 0.25, sm: 1 },
                                py: 1.5,
                                borderRadius: 3,
                                backgroundColor: "background.paper",
                                border: "1px solid",
                                borderColor: "divider",
                              }}
                            >
                              <MedicalLineChart
                                points={labChartPoints}
                                getY={(p) => p.value}
                                getKey={(p, i) => p.id ?? `lab-${i}`}
                                segmentColor={(_prev, curr) => getLabPointColor(curr)}
                                pointColor={(p) => getLabPointColor(p)}
                                formatY={(v) => {
                                  const a = Math.abs(Number(v));
                                  if (!Number.isFinite(a)) return "";
                                  if (a >= 1000) return v.toFixed(0);
                                  if (a >= 10) return v.toFixed(1);
                                  return v.toFixed(2);
                                }}
                                formatX={(p) => (p.label ? formatDateOnly(p.label) : t("common.noData"))}
                                pointTitle={(p) => {
                                  const u = p.indicator_unit ? ` ${p.indicator_unit}` : "";
                                  const name = p.indicator_name ? `${p.indicator_name}\n` : "";
                                  return `${name}${formatDateOnly(p.label)}\n${t("detail.labValue")}: ${p.value}${u}`;
                                }}
                              />
                              <Stack
                                direction="row"
                                justifyContent="space-between"
                                sx={{ mt: 1.5, mb: 1, flexWrap: "wrap", gap: 1 }}
                              >
                                <Typography variant="caption" color="text.secondary">
                                  {t("detail.labRange")}: {labYStats.min} — {labYStats.max}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {t("detail.labLatestValue")}: {labTrend.stats?.latest_value ?? t("common.noData")}
                                </Typography>
                              </Stack>
                              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                                <Chip label={t("detail.labLegendNormal")} size="small" sx={{ bgcolor: "info.light", color: "info.dark" }} />
                                <Chip label={t("detail.labLegendBelow")} size="small" sx={{ bgcolor: "warning.light", color: "warning.dark" }} />
                                <Chip label={t("detail.labLegendAbove")} size="small" sx={{ bgcolor: "error.light", color: "error.dark" }} />
                              </Stack>
                            </Box>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {labs.length === 0 ? (
                    <Typography color="text.secondary">{t("detail.noLabsFound")}</Typography>
                  ) : (
                    <Grid container spacing={2}>
                      {labs.map((lab) => (
                        <Grid item xs={12} key={lab.id}>
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
                              {(() => {
                                const summary = getLabSetSummary(lab);
                                return (
                                  <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mb: 2 }}>
                                    <Chip
                                      label={t("detail.labIndicatorsCount", { count: summary.total })}
                                      size="small"
                                      variant="outlined"
                                    />
                                    <Chip
                                      label={t("detail.labAbnormalCount", { count: summary.abnormal })}
                                      size="small"
                                      color={summary.abnormal > 0 ? "warning" : "success"}
                                      variant="outlined"
                                    />
                                  </Stack>
                                );
                              })()}
                              <Stack
                                direction={{ xs: "column", md: "row" }}
                                justifyContent="space-between"
                                spacing={2}
                                sx={{ mb: 1.5 }}
                              >
                                <Typography>
                                  <strong>{t("detail.date")}:</strong> {lab.date || t("common.noData")}
                                </Typography>
                                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                  <Button variant="outlined" size="small" onClick={() => handleEditLabResult(lab)}>
                                    {t("detail.edit")}
                                  </Button>
                                  <Button
                                    variant="text"
                                    color="error"
                                    size="small"
                                    onClick={() => handleDeleteLabResult(lab.id)}
                                  >
                                    {t("detail.delete")}
                                  </Button>
                                </Stack>
                              </Stack>

                              {lab.values && lab.values.length > 0 ? (
                                <Box
                                  sx={{
                                    borderRadius: 3,
                                    border: "1px solid",
                                    borderColor: alpha(theme.palette.primary.main, 0.14),
                                    overflow: "hidden",
                                  }}
                                >
                                  {(expandedLabSets[lab.id] ? lab.values : lab.values.slice(0, 6)).map((value, index) => {
                                    const rowList = expandedLabSets[lab.id] ? lab.values : lab.values.slice(0, 6);
                                    return (
                                    <Box
                                      key={value.id}
                                      sx={{
                                        px: 2,
                                        py: 1.5,
                                        borderBottom:
                                          index !== rowList.length - 1 ? "1px solid" : "none",
                                        borderColor: "divider",
                                      }}
                                    >
                                      <Stack
                                        direction={{ xs: "column", md: "row" }}
                                        justifyContent="space-between"
                                        spacing={1}
                                        alignItems={{ xs: "flex-start", md: "center" }}
                                      >
                                        <Box sx={{ minWidth: 0 }}>
                                          <Typography fontWeight={700}>{value.indicator_name}</Typography>
                                          <Typography variant="body2" color="text.secondary">
                                            {t("detail.labValue")}: {value.value} {value.indicator_unit || ""}
                                          </Typography>
                                          <Typography variant="body2" color="text.secondary">
                                            {t("detail.labNorm")}: {value.min_norm ?? t("common.noData")} -{" "}
                                            {value.max_norm ?? t("common.noData")} {value.indicator_unit || ""}
                                          </Typography>
                                        </Box>
                                        <Chip
                                          label={value.status_text || t("common.noData")}
                                          color={getLabStatusColor(value.status)}
                                          size="small"
                                          variant="outlined"
                                          sx={{ fontWeight: 700 }}
                                        />
                                      </Stack>
                                    </Box>
                                    );
                                  })}

                                  {lab.values.length > 6 ? (
                                    <Box
                                      sx={{
                                        px: 2,
                                        py: 1.25,
                                        borderTop: "1px solid",
                                        borderColor: "divider",
                                        bgcolor: "background.default",
                                      }}
                                    >
                                      <Button
                                        size="small"
                                        onClick={() => toggleLabSetExpanded(lab.id)}
                                        sx={{ borderRadius: 10 }}
                                      >
                                        {expandedLabSets[lab.id]
                                          ? t("detail.showLess", { count: lab.values.length })
                                          : t("detail.showMore", { count: lab.values.length - 6 })}
                                      </Button>
                                    </Box>
                                  ) : null}
                                </Box>
                              ) : (
                                <Typography color="text.secondary">{t("detail.noIndicators")}</Typography>
                              )}
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </CardContent>
              </Card>

              <Card sx={{ borderRadius: 4 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h5" gutterBottom>
                    {t("detail.notes")}
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  <Card variant="outlined" sx={{ mb: 3, borderRadius: 4 }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {editingNoteId ? t("detail.editNote") : t("detail.addNote")}
                      </Typography>
                      <Stack spacing={2}>
                        <TextField
                          select
                          label={t("detail.noteCategory")}
                          value={noteForm.category}
                          onChange={(event) => handleNoteFieldChange("category", event.target.value)}
                        >
                          {noteCategoryOptions.map((category) => (
                            <MenuItem key={category} value={category}>
                              {t(`detail.noteCategories.${category}`)}
                            </MenuItem>
                          ))}
                        </TextField>

                        <TextField
                          label={t("detail.text")}
                          multiline
                          minRows={4}
                          value={noteForm.text}
                          onChange={(event) => handleNoteFieldChange("text", event.target.value)}
                        />

                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={noteForm.pinned}
                              onChange={(event) => handleNoteFieldChange("pinned", event.target.checked)}
                            />
                          }
                          label={t("detail.pinAsMain")}
                        />

                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                          <Button variant="contained" onClick={handleSubmitNote} disabled={noteSubmitting}>
                            {noteSubmitting
                              ? t("detail.saving")
                              : editingNoteId
                                ? t("detail.saveChanges")
                                : t("detail.saveNote")}
                          </Button>
                          {editingNoteId ? (
                            <Button variant="outlined" onClick={resetNoteForm}>
                              {t("detail.cancelEdit")}
                            </Button>
                          ) : null}
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>

                  {notes.length === 0 ? (
                    <Typography color="text.secondary">{t("detail.noNotesFound")}</Typography>
                  ) : regularNotes.length === 0 ? (
                    <Typography color="text.secondary">{t("detail.onlyMainNote")}</Typography>
                  ) : (
                    <Grid container spacing={2}>
                      {regularNotes.map((note) => (
                        <Grid item xs={12} key={note.id}>
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
                              <Stack
                                direction={{ xs: "column", md: "row" }}
                                justifyContent="space-between"
                                spacing={2}
                                sx={{ mb: 1 }}
                              >
                                <Typography>
                                  <strong>{t("detail.doctor")}:</strong>{" "}
                                  {note.doctor_full_name || note.doctor_username || t("common.noData")}
                                </Typography>
                                <Chip
                                  label={t(`detail.noteCategories.${note.category || "general"}`)}
                                  size="small"
                                  variant="outlined"
                                />
                              </Stack>
                              <Typography sx={{ mb: 1 }} color="text.secondary">
                                <strong>{t("detail.date")}:</strong> {formatDate(note.created_at)}
                              </Typography>
                              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1.5 }}>
                                <Chip
                                  label={t(`detail.noteCategories.${note.category || "general"}`)}
                                  size="small"
                                  variant="outlined"
                                />
                                {note.pinned ? <Chip label={t("detail.pinned")} size="small" color="primary" /> : null}
                              </Stack>
                              <Typography sx={{ mb: 2 }}>
                                <strong>{t("detail.text")}:</strong> {note.text}
                              </Typography>
                              {canManageNote(note) ? (
                                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                                  <Button variant="outlined" size="small" onClick={() => handleEditNote(note)}>
                                    {t("detail.edit")}
                                  </Button>
                                  <Button
                                    variant="text"
                                    color="error"
                                    size="small"
                                    onClick={() => handleDeleteNote(note.id)}
                                  >
                                    {t("detail.delete")}
                                  </Button>
                                </Stack>
                              ) : (
                                <Typography color="text.secondary" variant="body2">
                                  {t("detail.noteReadOnly")}
                                </Typography>
                              )}
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </CardContent>
              </Card>

              <Card sx={{ borderRadius: 4 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h5" gutterBottom>
                    {t("detail.allExcelData")}
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  {excelEntries.length === 0 ? (
                    <Typography color="text.secondary">{t("detail.noExcelData")}</Typography>
                  ) : (
                    <Grid container spacing={2}>
                      {excelEntries.map(([key, value]) => (
                        <Grid item xs={12} md={6} key={key}>
                          <Card variant="outlined" sx={{ borderRadius: 3 }}>
                            <CardContent>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                {key}
                              </Typography>
                              <Typography fontWeight={700}>
                                {value === null || value === undefined || value === ""
                                  ? t("common.noData")
                                  : String(value)}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </CardContent>
              </Card>
            </Stack>
          </Grid>
        </Grid>

      <Dialog
        open={Boolean(editingLabResultId)}
        onClose={savingLabResult ? undefined : resetLabEditForm}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {t("detail.editLabResult")}
          {editingLabResult?.date ? ` - ${editingLabResult.date}` : ""}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label={t("detail.date")}
              type="date"
              value={labEditForm.date}
              onChange={(event) =>
                setLabEditForm((prev) => ({
                  ...prev,
                  date: event.target.value,
                }))
              }
              InputLabelProps={{ shrink: true }}
            />

            {labEditForm.values.map((value) => (
              <Stack
                key={value.id || `new-${value.indicator_id}`}
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                alignItems={{ xs: "stretch", sm: "center" }}
              >
                <TextField
                  fullWidth
                  label={`${value.indicator_name}${value.indicator_unit ? ` (${value.indicator_unit})` : ""}`}
                  type="number"
                  value={value.value}
                  onChange={(event) => handleLabValueChange(value.id, value.indicator_id, event.target.value)}
                />
                <Button
                  variant="text"
                  color="error"
                  onClick={() => handleRemoveLabValue(value.indicator_id, value.id)}
                >
                  {t("detail.delete")}
                </Button>
              </Stack>
            ))}

            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent sx={{ "&:last-child": { pb: 2 } }}>
                <Stack spacing={2}>
                  <Typography variant="subtitle1">{t("detail.addLabIndicator")}</Typography>
                  <TextField
                    select
                    label={t("detail.labIndicator")}
                    value={labEditForm.new_indicator_id}
                    onChange={(event) => handleLabNewFieldChange("new_indicator_id", event.target.value)}
                  >
                    <MenuItem value="">{t("detail.selectLabIndicator")}</MenuItem>
                    {availableIndicatorsForEdit.map((indicator) => (
                      <MenuItem key={indicator.id} value={indicator.id}>
                        {indicator.name}
                        {indicator.unit ? ` (${indicator.unit})` : ""}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label={t("detail.labValue")}
                    type="number"
                    value={labEditForm.new_value}
                    onChange={(event) => handleLabNewFieldChange("new_value", event.target.value)}
                  />
                  <Button variant="outlined" onClick={handleAddLabIndicator}>
                    {t("detail.addIndicator")}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button variant="outlined" onClick={resetLabEditForm} disabled={savingLabResult}>
            {t("detail.cancelEdit")}
          </Button>
          <Button variant="contained" onClick={handleSaveLabResult} disabled={savingLabResult}>
            {savingLabResult ? t("detail.saving") : t("detail.saveChanges")}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={feedback.open}
        autoHideDuration={2500}
        onClose={() => setFeedback((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={feedback.severity}
          sx={{ width: "100%" }}
          onClose={() => setFeedback((prev) => ({ ...prev, open: false }))}
        >
          {feedback.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default PatientDetailPage;