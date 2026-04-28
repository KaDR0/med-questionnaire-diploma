import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import api from "../api/axios";
import { useTranslation } from "react-i18next";

const emptyQuestion = (order = 1) => ({
  order,
  text: "",
  qtype: "yesno",
  is_required: true,
  score_yes: 1,
  score_no: 0,
  options: [
    { value: "option_1", text: "Option 1", score: 0, order: 1 },
    { value: "option_2", text: "Option 2", score: 1, order: 2 },
  ],
});

function QuestionnaireBuilderPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [diseases, setDiseases] = useState([]);
  const [form, setForm] = useState({
    disease: "",
    title: "",
    description: "",
    medical_area: "",
    risk_target: "",
    source_name: "",
    source_url: "",
    source_type: "",
    evidence_note: "",
    is_standardized: false,
    scoring_method: "",
    interpretation_rules: "",
    questions: [emptyQuestion(1)],
  });

  useEffect(() => {
    const loadDiseases = api.get("diseases/");
    const loadQuestionnaire = isEdit ? api.get(`questionnaires/${id}/`) : Promise.resolve(null);
    Promise.all([loadDiseases, loadQuestionnaire])
      .then(([diseasesResponse, questionnaireResponse]) => {
        setDiseases(diseasesResponse?.data || []);
        if (!isEdit || !questionnaireResponse) return;
        const payload = questionnaireResponse.data;
        setForm((prev) => ({
          ...prev,
          ...payload,
          disease: payload.disease ?? "",
          questions: (payload.questions || []).length ? payload.questions : [emptyQuestion(1)],
        }));
      })
      .catch((err) => setError(err?.response?.data?.detail || t("builder.loadError")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit, t]);

  const canSubmitForApproval = useMemo(
    () => ["draft", "rejected", "changes_requested"].includes(form.approval_status || "draft"),
    [form.approval_status]
  );

  const updateQuestion = (index, patch) => {
    setForm((prev) => {
      const questions = [...prev.questions];
      questions[index] = { ...questions[index], ...patch };
      return { ...prev, questions };
    });
  };

  const addQuestion = () =>
    setForm((prev) => ({ ...prev, questions: [...prev.questions, emptyQuestion(prev.questions.length + 1)] }));

  const removeQuestion = (index) =>
    setForm((prev) => ({ ...prev, questions: prev.questions.filter((_, idx) => idx !== index) }));

  const addOption = (index) => {
    const question = form.questions[index];
    const nextOrder = (question.options || []).length + 1;
    updateQuestion(index, {
      options: [...(question.options || []), { value: `option_${nextOrder}`, text: "", score: 0, order: nextOrder }],
    });
  };

  const updateOption = (qIndex, oIndex, patch) => {
    const question = form.questions[qIndex];
    const nextOptions = [...(question.options || [])];
    nextOptions[oIndex] = { ...nextOptions[oIndex], ...patch };
    updateQuestion(qIndex, { options: nextOptions });
  };

  const removeOption = (qIndex, oIndex) => {
    const question = form.questions[qIndex];
    updateQuestion(qIndex, { options: (question.options || []).filter((_, idx) => idx !== oIndex) });
  };

  const formatBackendError = (data) => {
    if (!data || typeof data !== "object") return t("builder.saveError");
    if (data.detail) return data.detail;
    const entries = Object.entries(data)
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
      .filter(Boolean);
    return entries.length ? entries.join(" | ") : t("builder.saveError");
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setFieldErrors({});
      const payload = {
        ...form,
        disease: form.disease ? Number(form.disease) : null,
      };
      console.log("Questionnaire payload:", payload);
      if (isEdit) {
        await api.patch(`questionnaires/${id}/`, payload);
      } else {
        const response = await api.post("questionnaires/", payload);
        navigate(`/questionnaires/${response.data.id}/edit`, { replace: true });
      }
    } catch (err) {
      const responseData = err?.response?.data || {};
      setFieldErrors(responseData && typeof responseData === "object" ? responseData : {});
      setError(formatBackendError(responseData));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!isEdit) return;
    try {
      await api.post(`questionnaires/${id}/submit-for-approval/`);
      navigate("/questionnaires/my");
    } catch (err) {
      setError(err?.response?.data?.detail || t("builder.submitError"));
    }
  };

  if (loading) {
    return <Typography>{t("common.loading")}</Typography>;
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>
        {isEdit ? t("builder.editTitle") : t("builder.createTitle")}
      </Typography>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                select
                fullWidth
                label="Заболевание / Disease"
                value={form.disease}
                onChange={(e) => setForm((p) => ({ ...p, disease: e.target.value }))}
                error={Boolean(fieldErrors?.disease?.length)}
                helperText={fieldErrors?.disease?.[0] || ""}
              >
                <MenuItem value="">Select disease</MenuItem>
                {diseases.map((disease) => (
                  <MenuItem key={disease.id} value={disease.id}>
                    {disease.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}><TextField fullWidth label={t("builder.title")} value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></Grid>
            <Grid item xs={12} md={6}><TextField fullWidth label={t("builder.medicalArea")} value={form.medical_area} onChange={(e) => setForm((p) => ({ ...p, medical_area: e.target.value }))} /></Grid>
            <Grid item xs={12}><TextField fullWidth multiline minRows={2} label={t("builder.description")} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></Grid>
            <Grid item xs={12} md={6}><TextField fullWidth label={t("builder.riskTarget")} value={form.risk_target} onChange={(e) => setForm((p) => ({ ...p, risk_target: e.target.value }))} /></Grid>
            <Grid item xs={12} md={6}><TextField fullWidth label={t("builder.sourceName")} value={form.source_name} onChange={(e) => setForm((p) => ({ ...p, source_name: e.target.value }))} /></Grid>
            <Grid item xs={12} md={6}><TextField fullWidth label={t("builder.sourceUrl")} value={form.source_url} onChange={(e) => setForm((p) => ({ ...p, source_url: e.target.value }))} /></Grid>
            <Grid item xs={12} md={6}><TextField fullWidth label={t("builder.sourceType")} value={form.source_type} onChange={(e) => setForm((p) => ({ ...p, source_type: e.target.value }))} /></Grid>
            <Grid item xs={12}><TextField fullWidth label={t("builder.evidenceNote")} value={form.evidence_note} onChange={(e) => setForm((p) => ({ ...p, evidence_note: e.target.value }))} /></Grid>
            <Grid item xs={12} md={6}><TextField fullWidth label={t("builder.scoringMethod")} value={form.scoring_method} onChange={(e) => setForm((p) => ({ ...p, scoring_method: e.target.value }))} /></Grid>
            <Grid item xs={12} md={6}><TextField fullWidth label={t("builder.interpretationRules")} helperText='Example: [{ "min": 0, "max": 4, "level": "Low risk" }]' value={form.interpretation_rules} onChange={(e) => setForm((p) => ({ ...p, interpretation_rules: e.target.value }))} /></Grid>
            <Grid item xs={12}><FormControlLabel control={<Checkbox checked={Boolean(form.is_standardized)} onChange={(e) => setForm((p) => ({ ...p, is_standardized: e.target.checked }))} />} label={t("builder.standardized")} /></Grid>
          </Grid>
        </CardContent>
      </Card>
      <Stack spacing={2}>
        {form.questions.map((question, qIndex) => (
          <Card key={qIndex}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h6">{t("builder.question")} #{qIndex + 1}</Typography>
                <Button color="error" onClick={() => removeQuestion(qIndex)}>{t("builder.removeQuestion")}</Button>
              </Stack>
              <Grid container spacing={2}>
                <Grid item xs={12} md={7}><TextField fullWidth label={t("builder.questionText")} value={question.text || ""} onChange={(e) => updateQuestion(qIndex, { text: e.target.value })} /></Grid>
                <Grid item xs={12} md={3}>
                  <TextField select fullWidth label={t("builder.questionType")} value={question.qtype || "yesno"} onChange={(e) => updateQuestion(qIndex, { qtype: e.target.value })}>
                    <MenuItem value="yesno">yes/no</MenuItem>
                    <MenuItem value="single_choice">single_choice</MenuItem>
                    <MenuItem value="number">number</MenuItem>
                    <MenuItem value="text">text</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} md={2}><TextField fullWidth type="number" label={t("builder.order")} value={question.order ?? qIndex + 1} onChange={(e) => updateQuestion(qIndex, { order: Number(e.target.value) })} /></Grid>
                <Grid item xs={12}>
                  <FormControlLabel control={<Checkbox checked={Boolean(question.is_required)} onChange={(e) => updateQuestion(qIndex, { is_required: e.target.checked })} />} label={t("builder.required")} />
                </Grid>
                {question.qtype === "yesno" ? (
                  <>
                    <Grid item xs={12} md={6}><TextField type="number" fullWidth label={t("builder.scoreYes")} value={question.score_yes ?? 1} onChange={(e) => updateQuestion(qIndex, { score_yes: Number(e.target.value) })} /></Grid>
                    <Grid item xs={12} md={6}><TextField type="number" fullWidth label={t("builder.scoreNo")} value={question.score_no ?? 0} onChange={(e) => updateQuestion(qIndex, { score_no: Number(e.target.value) })} /></Grid>
                  </>
                ) : null}
                {question.qtype === "single_choice" ? (
                  <Grid item xs={12}>
                    <Stack spacing={1.5}>
                      {(question.options || []).map((option, oIndex) => (
                        <Stack key={oIndex} direction={{ xs: "column", md: "row" }} spacing={1}>
                          <TextField label={t("builder.optionText")} value={option.text || ""} onChange={(e) => updateOption(qIndex, oIndex, { text: e.target.value })} fullWidth />
                          <TextField label={t("builder.optionValue")} value={option.value || ""} onChange={(e) => updateOption(qIndex, oIndex, { value: e.target.value })} fullWidth />
                          <TextField label={t("builder.optionScore")} type="number" value={option.score ?? 0} onChange={(e) => updateOption(qIndex, oIndex, { score: Number(e.target.value) })} sx={{ minWidth: 120 }} />
                          <Button color="error" onClick={() => removeOption(qIndex, oIndex)}>{t("builder.removeOption")}</Button>
                        </Stack>
                      ))}
                      <Button variant="outlined" onClick={() => addOption(qIndex)}>{t("builder.addOption")}</Button>
                    </Stack>
                  </Grid>
                ) : null}
              </Grid>
            </CardContent>
          </Card>
        ))}
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        <Button variant="outlined" onClick={addQuestion}>{t("builder.addQuestion")}</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? t("common.loading") : t("builder.saveDraft")}</Button>
        {isEdit && canSubmitForApproval ? (
          <Button variant="contained" color="secondary" onClick={handleSubmitForApproval}>{t("builder.submitForApproval")}</Button>
        ) : null}
      </Stack>
    </Box>
  );
}

export default QuestionnaireBuilderPage;
