import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import api from "../../api/axios";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";

function formatAssignedAt(value, emptyLabel) {
  if (!value) return emptyLabel;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function formatDueDate(value, emptyLabel) {
  if (!value) return emptyLabel;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function questionnaireOptionLabel(q, localeEmpty) {
  const title =
    q.title_en || q.title_ru || q.title_kk || q.title || (q.disease_name ? `${q.disease_name}` : "");
  if (!title) return `${localeEmpty} #${q.id}`;
  return title;
}

/** Aligned with assignment API: approved, active, not archived (archived is a separate status). */
export function isAssignableQuestionnaire(q) {
  if (!q || !q.is_active) return false;
  if (q.approval_status === "archived") return false;
  return q.approval_status === "approved";
}

const DUPLICATE_EN = "An active assignment already exists for this patient and questionnaire.";

export default function PatientQuestionnaireAssignmentsCard({ patientId, showFeedback }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { user } = useAuth();
  const isMedicalStaff = user?.role === "doctor" || user?.role === "chief_doctor";

  const [assignments, setAssignments] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [loadingQuestionnaires, setLoadingQuestionnaires] = useState(false);
  const [form, setForm] = useState({
    questionnaire_id: "",
    due_date: "",
    comment: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  const loadAssignments = useCallback(async () => {
    if (!patientId) return;
    setLoadingList(true);
    try {
      const { data } = await api.get(`patients/${patientId}/questionnaire-assignments/`);
      const list = Array.isArray(data) ? data : data?.results ?? [];
      setAssignments(list);
    } catch (e) {
      console.error(e);
      showFeedback?.(t("detail.assignmentsLoadError"), "error");
    } finally {
      setLoadingList(false);
    }
  }, [patientId, showFeedback, t]);

  const loadQuestionnaires = useCallback(async () => {
    setLoadingQuestionnaires(true);
    try {
      const { data } = await api.get("questionnaires/");
      const raw = Array.isArray(data) ? data : data?.results ?? [];
      setQuestionnaires(raw.filter(isAssignableQuestionnaire));
    } catch (e) {
      console.error(e);
      showFeedback?.(t("detail.assignQuestionnairesLoadError"), "error");
    } finally {
      setLoadingQuestionnaires(false);
    }
  }, [showFeedback, t]);

  useEffect(() => {
    if (!isMedicalStaff || !patientId) return;
    loadAssignments();
    loadQuestionnaires();
  }, [isMedicalStaff, patientId, loadAssignments, loadQuestionnaires]);

  const statusLabel = (row) => {
    if (!row?.status) return "—";
    const key = `detail.assignmentStatus.${row.status}`;
    return t(key, { defaultValue: row.status_label || row.status });
  };

  const statusChip = (row) => {
    if (!row?.status) return "—";
    const label = statusLabel(row);
    const s = row.status;
    const color =
      s === "assigned"
        ? "primary"
        : s === "in_progress"
          ? "info"
          : s === "completed"
            ? "success"
            : s === "expired"
              ? "warning"
              : s === "cancelled"
                ? "default"
                : "default";
    return <Chip size="small" label={label} color={color} variant="outlined" />;
  };

  const parseAssignmentError = (err) => {
    const d = err?.response?.data;
    if (!d) return err?.message || null;
    if (typeof d === "string") return d;
    if (Array.isArray(d.detail) && d.detail[0] != null) {
      const first = d.detail[0];
      return typeof first === "string" ? first : String(first);
    }
    if (typeof d.detail === "string") return d.detail;
    const nfe = d.non_field_errors;
    if (Array.isArray(nfe) && nfe[0]) return nfe[0];
    if (typeof nfe === "string") return nfe;
    if (d.questionnaire_id?.[0]) return d.questionnaire_id[0];
    if (d.patient_id?.[0]) return d.patient_id[0];
    if (d.scope?.[0]) return d.scope[0];
    return null;
  };

  const handleCancelAssignment = async (assignmentId) => {
    setCancellingId(assignmentId);
    try {
      await api.post(`questionnaire-assignments/${assignmentId}/cancel/`);
      showFeedback?.(t("detail.assignCancelSuccess"));
      await loadAssignments();
    } catch (err) {
      const msg = parseAssignmentError(err);
      showFeedback?.(msg || t("detail.assignCancelError"), "error");
    } finally {
      setCancellingId(null);
    }
  };

  const handleSubmit = async () => {
    if (!form.questionnaire_id) {
      showFeedback?.(t("detail.assignSelectQuestionnaire"), "error");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        patient_id: Number(patientId),
        questionnaire_id: Number(form.questionnaire_id),
      };
      if (form.due_date) payload.due_date = form.due_date;
      if (form.comment.trim()) payload.comment = form.comment.trim();
      await api.post("questionnaire-assignments/", payload);
      showFeedback?.(t("detail.assignSuccess"));
      setForm({ questionnaire_id: "", due_date: "", comment: "" });
      await loadAssignments();
      await loadQuestionnaires();
    } catch (err) {
      let msg = parseAssignmentError(err);
      if (msg === DUPLICATE_EN || (msg && String(msg).includes("active assignment already exists"))) {
        msg = t("detail.assignDuplicateError");
      }
      showFeedback?.(msg || t("detail.assignError"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isMedicalStaff) return null;

  const emptyLabel = t("common.noData");
  const canAssign = !loadingQuestionnaires && questionnaires.length > 0;
  const isCancellable = (row) => row?.status === "assigned" || row?.status === "in_progress";

  return (
    <Card
      sx={{
        borderRadius: 3.5,
        border: "1px solid",
        borderColor: alpha(theme.palette.primary.main, 0.12),
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          {t("detail.assignmentsTitle")}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("detail.assignmentsSubtitle")}
        </Typography>
        <Divider sx={{ mb: 2 }} />

        {loadingQuestionnaires ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
            <CircularProgress size={22} />
            <Typography variant="body2" color="text.secondary">
              {t("detail.assignLoadingQuestionnaires")}
            </Typography>
          </Box>
        ) : null}

        {!loadingQuestionnaires && !canAssign ? (
          <Alert severity="info" sx={{ mb: 3 }}>
            {t("detail.assignNoQuestionnaires")}
          </Alert>
        ) : null}

        {canAssign ? (
          <Stack spacing={2} sx={{ mb: 3 }}>
            <TextField
              select
              required
              fullWidth
              size="small"
              label={t("detail.assignQuestionnaireLabel")}
              value={form.questionnaire_id}
              onChange={(e) => setForm((p) => ({ ...p, questionnaire_id: e.target.value }))}
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="">
                <em>{t("detail.assignQuestionnairePlaceholder")}</em>
              </MenuItem>
              {questionnaires.map((q) => (
                <MenuItem key={q.id} value={String(q.id)}>
                  {questionnaireOptionLabel(q, t("detail.questionnaire"))}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              type="date"
              fullWidth
              size="small"
              label={t("detail.assignDueDate")}
              value={form.due_date}
              onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              fullWidth
              size="small"
              multiline
              minRows={2}
              label={t("detail.assignComment")}
              value={form.comment}
              onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))}
            />
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={submitting || !form.questionnaire_id}
              sx={{ alignSelf: "flex-start" }}
            >
              {submitting ? t("detail.assignSubmitting") : t("detail.assignSubmit")}
            </Button>
          </Stack>
        ) : null}

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t("detail.assignmentsListTitle")}
        </Typography>

        {loadingList ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={28} />
          </Box>
        ) : assignments.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t("detail.assignmentsEmpty")}
          </Typography>
        ) : (
          <Table size="small" sx={{ "& td": { verticalAlign: "top" } }}>
            <TableHead>
              <TableRow>
                <TableCell>{t("detail.latestQuestionnaire")}</TableCell>
                <TableCell>{t("detail.assignmentAssignedAt")}</TableCell>
                <TableCell>{t("detail.assignmentDue")}</TableCell>
                <TableCell>{t("detail.status")}</TableCell>
                <TableCell>{t("detail.assignmentCompletedAt")}</TableCell>
                <TableCell>{t("detail.assignmentResult")}</TableCell>
                <TableCell>{t("detail.assignmentComment")}</TableCell>
                <TableCell align="right">{t("detail.assignmentActions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {assignments.map((row) => (
                <TableRow key={row.id}>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {row.questionnaire_title ||
                      t("detail.questionnaireFallback", { id: row.questionnaire })}
                  </TableCell>
                  <TableCell>{formatAssignedAt(row.assigned_at, emptyLabel)}</TableCell>
                  <TableCell>{formatDueDate(row.due_date, emptyLabel)}</TableCell>
                  <TableCell>{statusChip(row)}</TableCell>
                  <TableCell>
                    {row.status === "completed"
                      ? formatAssignedAt(row.completed_at || row.assessment_summary?.created_at, emptyLabel)
                      : "—"}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 200 }}>
                    {row.status === "completed" && row.assessment_summary?.id ? (
                      <Button
                        component={Link}
                        size="small"
                        variant="text"
                        to={`/patients/${patientId}/assessments/${row.assessment_summary.id}`}
                      >
                        {t("detail.viewAssignmentResult")}
                      </Button>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 220, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {row.note?.trim() ? row.note : "—"}
                  </TableCell>
                  <TableCell align="right">
                    {isCancellable(row) ? (
                      <Button
                        size="small"
                        variant="text"
                        color="inherit"
                        disabled={cancellingId === row.id}
                        onClick={() => handleCancelAssignment(row.id)}
                      >
                        {cancellingId === row.id ? t("detail.assignCancelling") : t("detail.assignCancel")}
                      </Button>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
