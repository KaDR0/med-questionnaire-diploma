import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
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

const SCORING_METHOD_OPTIONS = ["sum_scores", "count_yes", "custom"];
const PREVIEW_SCORES = [3, 6, 10];

function parseInterpretationRules(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    if (Array.isArray(raw.rules)) return raw.rules;
    return [];
  }
  const text = String(raw || "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.rules)) return parsed.rules;
  } catch (_e) {
    return [];
  }
  return [];
}

function normalizeRuleRow(row, idx) {
  return {
    id: String(row?.id || idx + 1),
    min: row?.min ?? "",
    max: row?.max ?? "",
    level: row?.level ?? row?.label ?? row?.title ?? "",
  };
}

function serializeInterpretationRules(rows) {
  const normalized = rows
    .map((row) => {
      const minNum = Number(row.min);
      const maxNum = Number(row.max);
      const level = String(row.level || "").trim();
      if (!Number.isFinite(minNum) || !Number.isFinite(maxNum) || !level) return null;
      return { min: minNum, max: maxNum, level };
    })
    .filter(Boolean)
    .sort((a, b) => a.min - b.min || a.max - b.max || a.level.localeCompare(b.level));
  return normalized.length ? JSON.stringify(normalized) : "";
}

function SectionCard({ title, subtitle, children }) {
  return (
    <Card sx={{ mb: 2.5 }}>
      <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {subtitle}
          </Typography>
        ) : null}
        {children}
      </CardContent>
    </Card>
  );
}

function QuestionnaireBuilderPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [scoringMethodMode, setScoringMethodMode] = useState("sum_scores");
  const [interpretationRows, setInterpretationRows] = useState([
    { id: "1", min: 0, max: 4, level: "" },
  ]);
  const [form, setForm] = useState({
    disease_name: "",
    title: "",
    description: "",
    medical_area: "",
    risk_target: "",
    source_name: "",
    source_url: "",
    source_type: "",
    evidence_note: "",
    is_standardized: false,
    scoring_method: "sum_scores",
    interpretation_rules: "",
    questions: [emptyQuestion(1)],
  });

  useEffect(() => {
    if (!isEdit) {
      setLoading(false);
      return;
    }
    api
      .get(`questionnaires/${id}/`)
      .then((questionnaireResponse) => {
        const payload = questionnaireResponse.data || {};
        const parsedRules = parseInterpretationRules(payload.interpretation_rules);
        setForm((prev) => ({
          ...prev,
          ...payload,
          disease_name: (payload.disease_name || "").trim(),
          scoring_method: payload.scoring_method || "sum_scores",
          questions: (payload.questions || []).length ? payload.questions : [emptyQuestion(1)],
        }));
        const loadedScoringMethod = String(payload.scoring_method || "").trim();
        setScoringMethodMode(
          SCORING_METHOD_OPTIONS.includes(loadedScoringMethod)
            ? loadedScoringMethod
            : loadedScoringMethod
              ? "custom"
              : "sum_scores"
        );
        if (parsedRules.length) {
          setInterpretationRows(parsedRules.map(normalizeRuleRow));
        }
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

  const scoringMethodHelper = useMemo(() => {
    if (scoringMethodMode === "sum_scores") return t("builder.scoringMethodHintSum");
    if (scoringMethodMode === "count_yes") return t("builder.scoringMethodHintYes");
    return t("builder.scoringMethodHintCustom");
  }, [scoringMethodMode, t]);

  const addInterpretationRow = () => {
    setInterpretationRows((prev) => [...prev, { id: String(Date.now()), min: "", max: "", level: "" }]);
  };

  const updateInterpretationRow = (rowId, patch) => {
    setInterpretationRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  };

  const removeInterpretationRow = (rowId) => {
    setInterpretationRows((prev) => (prev.length > 1 ? prev.filter((row) => row.id !== rowId) : prev));
  };

  const resolvePreviewLevel = (score) => {
    for (const row of interpretationRows) {
      const minNum = Number(row.min);
      const maxNum = Number(row.max);
      if (!Number.isFinite(minNum) || !Number.isFinite(maxNum)) continue;
      if (score >= minNum && score <= maxNum) {
        return String(row.level || "").trim() || t("builder.previewNoLevel");
      }
    }
    return t("builder.previewNoLevel");
  };

  const interpretationValidation = useMemo(() => {
    const complete = [];
    let partialRows = 0;
    let invalidRows = 0;
    interpretationRows.forEach((row) => {
      const level = String(row.level || "").trim();
      const hasMin = String(row.min).trim() !== "";
      const hasMax = String(row.max).trim() !== "";
      const hasLevel = level !== "";
      if (!hasMin && !hasMax && !hasLevel) return;
      if (!(hasMin && hasMax && hasLevel)) {
        partialRows += 1;
        return;
      }
      const minNum = Number(row.min);
      const maxNum = Number(row.max);
      if (!Number.isFinite(minNum) || !Number.isFinite(maxNum)) {
        invalidRows += 1;
        return;
      }
      complete.push({ min: minNum, max: maxNum, level });
    });

    const errors = [];
    const warnings = [];

    if (complete.length === 0) {
      warnings.push(t("builder.validationNoRanges"));
    }
    if (partialRows > 0) {
      warnings.push(t("builder.validationPartialRows", { count: partialRows }));
    }
    if (invalidRows > 0) {
      errors.push(t("builder.validationNonNumeric", { count: invalidRows }));
    }

    for (const row of complete) {
      if (row.min > row.max) {
        errors.push(t("builder.validationMinGreaterThanMax", { min: row.min, max: row.max }));
      }
    }

    const sorted = [...complete].sort((a, b) => a.min - b.min || a.max - b.max);
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (curr.min <= prev.max) {
        errors.push(
          t("builder.validationOverlap", {
            prev: `${prev.min}-${prev.max}`,
            curr: `${curr.min}-${curr.max}`,
          })
        );
      } else if (curr.min > prev.max + 1) {
        warnings.push(
          t("builder.validationGap", {
            from: prev.max + 1,
            to: curr.min - 1,
          })
        );
      }
    }

    return {
      errors,
      warnings,
      hasBlockingErrors: errors.length > 0,
    };
  }, [interpretationRows, t]);

  const handleSave = async () => {
    try {
      if (interpretationValidation.hasBlockingErrors) {
        setError(interpretationValidation.errors[0]);
        return;
      }
      setSaving(true);
      setError("");
      setFieldErrors({});
      const payload = {
        ...form,
        disease_name: String(form.disease_name || "").trim(),
        interpretation_rules: serializeInterpretationRules(interpretationRows),
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
      <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
        {t("builder.intro")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("builder.requiredHint")}
      </Typography>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <SectionCard
        title={t("builder.sectionMainTitle")}
        subtitle={t("builder.sectionMainSubtitle")}
      >
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              required
              label={t("builder.disease")}
              placeholder={t("builder.diseasePlaceholder")}
              value={form.disease_name}
              onChange={(e) => setForm((p) => ({ ...p, disease_name: e.target.value }))}
              error={Boolean(fieldErrors?.disease_name?.length || fieldErrors?.disease?.length)}
              helperText={fieldErrors?.disease_name?.[0] || fieldErrors?.disease?.[0] || ""}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              required
              fullWidth
              label={t("builder.title")}
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              required
              fullWidth
              label={t("builder.medicalArea")}
              value={form.medical_area}
              onChange={(e) => setForm((p) => ({ ...p, medical_area: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              minRows={2}
              label={t("builder.description")}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label={t("builder.riskTarget")}
              helperText={t("builder.riskTargetHint")}
              value={form.risk_target}
              onChange={(e) => setForm((p) => ({ ...p, risk_target: e.target.value }))}
            />
          </Grid>
        </Grid>
      </SectionCard>

      <SectionCard
        title={t("builder.sectionQuestionsTitle")}
        subtitle={t("builder.sectionQuestionsSubtitle")}
      >
        <Box sx={{ mb: 2 }}>
          <Button variant="outlined" onClick={addQuestion}>
            {t("builder.addQuestion")}
          </Button>
        </Box>
        <Stack spacing={2}>
          {form.questions.map((question, qIndex) => (
            <Card key={qIndex} variant="outlined">
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.25 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="h6">{t("builder.questionCardTitle", { number: qIndex + 1 })}</Typography>
                    <Chip size="small" label={t("builder.order")} />
                  </Stack>
                  <Button
                    color="error"
                    onClick={() => removeQuestion(qIndex)}
                    disabled={form.questions.length <= 1}
                  >
                    {t("builder.removeQuestion")}
                  </Button>
                </Stack>
                <Grid container spacing={2}>
                <Grid item xs={12} md={7}>
                  <TextField
                    required
                    fullWidth
                    label={t("builder.questionText")}
                    value={question.text || ""}
                    onChange={(e) => updateQuestion(qIndex, { text: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    select
                    fullWidth
                    label={t("builder.questionType")}
                    value={question.qtype || "yesno"}
                    onChange={(e) => updateQuestion(qIndex, { qtype: e.target.value })}
                  >
                    <MenuItem value="yesno">yes/no</MenuItem>
                    <MenuItem value="single_choice">single_choice</MenuItem>
                    <MenuItem value="number">number</MenuItem>
                    <MenuItem value="text">text</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    type="number"
                    label={t("builder.order")}
                    helperText={t("builder.orderHint")}
                    value={question.order ?? qIndex + 1}
                    onChange={(e) => updateQuestion(qIndex, { order: Number(e.target.value) })}
                  />
                </Grid>
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
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.25 }}>
          {t("builder.questionsFlowHint")}
        </Typography>
      </SectionCard>

      <SectionCard
        title={t("builder.sectionScoringTitle")}
        subtitle={t("builder.sectionScoringSubtitle")}
      >
        {interpretationValidation.errors.length ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {interpretationValidation.errors.join(" ")}
          </Alert>
        ) : null}
        {interpretationValidation.warnings.length ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {interpretationValidation.warnings.join(" ")}
          </Alert>
        ) : null}
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              select
              fullWidth
              label={t("builder.scoringMethod")}
              helperText={scoringMethodHelper}
              value={scoringMethodMode}
              onChange={(e) => {
                const next = e.target.value;
                setScoringMethodMode(next);
                if (next === "custom") {
                  const fallback = SCORING_METHOD_OPTIONS.includes(String(form.scoring_method || ""))
                    ? ""
                    : form.scoring_method;
                  setForm((p) => ({ ...p, scoring_method: fallback }));
                  return;
                }
                setForm((p) => ({ ...p, scoring_method: next }));
              }}
              SelectProps={{
                renderValue: (selected) => {
                  if (selected === "sum_scores") return t("builder.scoringMethodOptionSum");
                  if (selected === "count_yes") return t("builder.scoringMethodOptionYes");
                  return t("builder.scoringMethodOptionCustom");
                },
              }}
            >
              <MenuItem value="sum_scores">{t("builder.scoringMethodOptionSum")}</MenuItem>
              <MenuItem value="count_yes">{t("builder.scoringMethodOptionYes")}</MenuItem>
              <MenuItem value="custom">{t("builder.scoringMethodOptionCustom")}</MenuItem>
            </TextField>
          </Grid>
          {scoringMethodMode === "custom" ? (
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t("builder.scoringMethod")}
                helperText={t("builder.scoringMethodHintCustom")}
                value={form.scoring_method}
                onChange={(e) => setForm((p) => ({ ...p, scoring_method: e.target.value }))}
              />
            </Grid>
          ) : null}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
              {t("builder.interpretationRangesTitle")}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {t("builder.interpretationRangesHint")}
            </Typography>
            <Stack spacing={1}>
              {interpretationRows.map((row) => (
                <Stack key={row.id} direction={{ xs: "column", md: "row" }} spacing={1}>
                  <TextField
                    type="number"
                    label={t("builder.fromScore")}
                    value={row.min}
                    onChange={(e) => updateInterpretationRow(row.id, { min: e.target.value })}
                    sx={{ minWidth: 110 }}
                  />
                  <TextField
                    type="number"
                    label={t("builder.toScore")}
                    value={row.max}
                    onChange={(e) => updateInterpretationRow(row.id, { max: e.target.value })}
                    sx={{ minWidth: 110 }}
                  />
                  <TextField
                    fullWidth
                    label={t("builder.riskLevelLabel")}
                    value={row.level}
                    onChange={(e) => updateInterpretationRow(row.id, { level: e.target.value })}
                  />
                  <Button
                    color="error"
                    onClick={() => removeInterpretationRow(row.id)}
                    disabled={interpretationRows.length <= 1}
                  >
                    {t("builder.removeOption")}
                  </Button>
                </Stack>
              ))}
              <Box>
                <Button variant="outlined" onClick={addInterpretationRow}>
                  {t("builder.addInterpretationLevel")}
                </Button>
              </Box>
            </Stack>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ bgcolor: "action.hover" }}>
              <CardContent sx={{ py: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                  {t("builder.previewTitle")}
                </Typography>
                <Stack spacing={0.75}>
                  {PREVIEW_SCORES.map((score) => (
                    <Typography key={score} variant="body2">
                      {t("builder.previewLine", { score, level: resolvePreviewLevel(score) })}
                    </Typography>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={Boolean(form.is_standardized)}
                  onChange={(e) => setForm((p) => ({ ...p, is_standardized: e.target.checked }))}
                />
              }
              label={t("builder.standardized")}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", ml: 4 }}>
              {t("builder.standardizedHint")}
            </Typography>
          </Grid>
        </Grid>
      </SectionCard>

      <SectionCard
        title={t("builder.sectionSourceTitle")}
        subtitle={t("builder.sectionSourceSubtitle")}
      >
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label={t("builder.sourceName")}
              helperText={t("builder.sourceNameHint")}
              value={form.source_name}
              onChange={(e) => setForm((p) => ({ ...p, source_name: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label={t("builder.sourceUrl")}
              helperText={t("builder.sourceUrlHint")}
              value={form.source_url}
              onChange={(e) => setForm((p) => ({ ...p, source_url: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12}>
            <Accordion disableGutters elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
              <AccordionSummary expandIcon={<Box component="span" sx={{ fontSize: 18 }}>▾</Box>}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {t("builder.additionalSettings")}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label={t("builder.sourceType")}
                      value={form.source_type}
                      onChange={(e) => setForm((p) => ({ ...p, source_type: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      minRows={2}
                      label={t("builder.evidenceNote")}
                      value={form.evidence_note}
                      onChange={(e) => setForm((p) => ({ ...p, evidence_note: e.target.value }))}
                    />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>
        </Grid>
      </SectionCard>

      <Divider sx={{ my: 2 }} />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2 }}>
        <Button variant="outlined" onClick={handleSave} disabled={saving}>
          {saving ? t("common.loading") : t("builder.saveDraft")}
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? t("common.loading") : t("builder.saveQuestionnaire")}
        </Button>
        {isEdit && canSubmitForApproval ? (
          <Button variant="text" color="secondary" onClick={handleSubmitForApproval}>
            {t("builder.submitForApproval")}
          </Button>
        ) : null}
      </Stack>
    </Box>
  );
}

export default QuestionnaireBuilderPage;
