import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";

import api from "../api/axios";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import useToast from "../utils/useToast";
import PageHeader from "../components/ui/PageHeader";
import { CardSkeleton } from "../components/ui/LoadingSkeleton";
import EmptyState from "../components/ui/EmptyState";

function QuestionnaireFormPage() {
  const { id, questionnaireId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const theme = useTheme();

  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get(`questionnaires/${questionnaireId}/questions/`)
      .then((response) => {
        setQuestions(response.data);
      })
      .catch((error) => {
        console.error("Error loading questions:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [questionnaireId]);

  const answeredCount = useMemo(() => {
    return Object.values(answers).filter(
      (value) => String(value).trim() !== ""
    ).length;
  }, [answers]);

  const totalCount = questions.length;
  const progressPct = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;
  const allAnswered = totalCount > 0 && answeredCount === totalCount;

  const handleChange = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const isPatientUser = user?.role === "patient";

  const handleSubmit = async () => {
    try {
      setSubmitError("");
      setSubmitting(true);

      const payload = {
        patient_id: Number(id),
        questionnaire_id: Number(questionnaireId),
        answers,
      };
      if (!isPatientUser) {
        payload.doctor_id = user?.id || null;
      }

      const response = await api.post("assessments/submit/", payload);
      const assessmentId = response.data.assessment_id;
      toast.success(
        `${t("form.submitSuccess")}${assessmentId ? ` #${assessmentId}` : ""}`
      );

      setTimeout(() => {
        if (isPatientUser) {
          navigate("/patient/questionnaires");
        } else {
          navigate(`/patients/${id}/assessments/${assessmentId}`);
        }
      }, 900);
    } catch (error) {
      console.error("Submit error:", error);
      const apiErr =
        error?.response?.data?.error || error?.response?.data?.detail;
      const msg = apiErr || t("form.submitError");
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const getLocalizedQuestionText = (question) => {
    if (i18n.language === "ru") {
      return question.text_ru || question.text_en || question.text_kk || question.text;
    }
    if (i18n.language === "kk") {
      return question.text_kk || question.text_en || question.text_ru || question.text;
    }
    return question.text_en || question.text_ru || question.text_kk || question.text;
  };

  const getQuestionTypeLabel = (qtype) => {
    if (qtype === "yesno") return `${t("form.yes")} / ${t("form.no")}`;
    if (qtype === "number") return t("form.number");
    if (qtype === "text") return t("form.text");
    if (qtype === "single_choice") return t("form.singleChoice", { defaultValue: "Single choice" });
    return qtype;
  };

  const renderField = (question) => {
    const value = answers[question.id] || "";

    if (question.qtype === "yesno") {
      return (
        <ToggleButtonGroup
          exclusive
          value={value}
          onChange={(_, val) => {
            if (val !== null) handleChange(question.id, val);
          }}
          sx={{
            "& .MuiToggleButton-root": {
              flex: 1,
              py: 1.25,
              fontWeight: 600,
              textTransform: "none",
              borderRadius: 1,
            },
          }}
          fullWidth
        >
          <ToggleButton value="yes" color="primary">
            {t("form.yes")}
          </ToggleButton>
          <ToggleButton value="no" color="primary">
            {t("form.no")}
          </ToggleButton>
        </ToggleButtonGroup>
      );
    }

    if (question.qtype === "single_choice") {
      const options = Array.isArray(question.options) ? question.options : [];
      return (
        <FormControl component="fieldset" fullWidth>
          <RadioGroup
            value={value}
            onChange={(e) => handleChange(question.id, e.target.value)}
          >
            {options.map((option, index) => {
              const optionValue = String(option?.value ?? option?.text ?? index);
              const optionLabel = option?.text || optionValue;
              const selected = String(value) === optionValue;
              return (
                <FormControlLabel
                  key={`${optionValue}-${index}`}
                  value={optionValue}
                  control={<Radio />}
                  label={optionLabel}
                  sx={{
                    m: 0,
                    mb: 1,
                    p: 1,
                    pr: 2,
                    borderRadius: 1,
                    border: "1px solid",
                    borderColor: selected ? "primary.main" : "divider",
                    bgcolor: selected
                      ? alpha(theme.palette.primary.main, 0.06)
                      : "transparent",
                    transition: "all .15s ease",
                    "&:hover": {
                      borderColor: "primary.light",
                      bgcolor: alpha(theme.palette.primary.main, 0.03),
                    },
                  }}
                />
              );
            })}
          </RadioGroup>
        </FormControl>
      );
    }

    if (question.qtype === "number") {
      return (
        <TextField
          fullWidth
          type="number"
          label={t("form.answer")}
          value={value}
          onChange={(e) => handleChange(question.id, e.target.value)}
        />
      );
    }

    if (question.qtype === "text") {
      return (
        <TextField
          fullWidth
          label={t("form.answer")}
          value={value}
          onChange={(e) => handleChange(question.id, e.target.value)}
          multiline
          minRows={3}
        />
      );
    }

    return (
      <TextField
        select
        fullWidth
        label={t("form.answer")}
        value={value}
        onChange={(e) => handleChange(question.id, e.target.value)}
      >
        <MenuItem value="">{t("form.selectAnswer")}</MenuItem>
        <MenuItem value="yes">{t("form.yes")}</MenuItem>
        <MenuItem value="no">{t("form.no")}</MenuItem>
      </TextField>
    );
  };

  return (
    <Box sx={{ maxWidth: 880, mx: "auto", pb: { xs: 12, md: 14 } }}>
      <PageHeader
        title={t("form.title")}
        subtitle={t("form.subtitle")}
        actions={
          <Button
            component={RouterLink}
            to={
              isPatientUser
                ? "/patient/questionnaires"
                : `/patients/${id}/questionnaires`
            }
            variant="outlined"
            startIcon={<ArrowBackRoundedIcon />}
          >
            {t("form.back")}
          </Button>
        }
      />

      <Card
        sx={{
          mb: 2.5,
          background: `linear-gradient(135deg, ${alpha(
            theme.palette.primary.main,
            0.06
          )} 0%, ${alpha(theme.palette.background.paper, 0)} 70%)`,
        }}
      >
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
            sx={{ mb: 1.5 }}
          >
            <Box>
              <Typography variant="h6" sx={{ mb: 0.25 }}>
                {t("form.questions")}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t("form.fill")}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Chip
                label={`${t("form.patientId")}: ${id}`}
                size="small"
                variant="outlined"
              />
              <Chip
                label={`${answeredCount} / ${totalCount}`}
                size="small"
                color={allAnswered ? "success" : "primary"}
                icon={allAnswered ? <CheckCircleRoundedIcon /> : undefined}
              />
            </Stack>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={progressPct}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              "& .MuiLinearProgress-bar": { borderRadius: 4 },
            }}
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1, display: "block" }}
          >
            {progressPct}% · {t("form.completed")}: {answeredCount}/{totalCount}
          </Typography>
        </CardContent>
      </Card>

      {loading ? (
        <Stack spacing={2.5}>
          <CardSkeleton lines={3} />
          <CardSkeleton lines={3} />
          <CardSkeleton lines={3} />
        </Stack>
      ) : questions.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<HelpOutlineRoundedIcon sx={{ fontSize: 48, color: "text.disabled" }} />}
              title={t("form.none")}
            />
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2.25}>
          {questions.map((question) => {
            const isAnswered =
              String(answers[question.id] ?? "").trim() !== "";
            return (
              <Card
                key={question.id}
                sx={{
                  borderLeft: "3px solid",
                  borderLeftColor: isAnswered ? "success.main" : "divider",
                  transition: "border-color .2s ease",
                }}
              >
                <CardContent sx={{ p: { xs: 2.25, md: 2.75 } }}>
                  <Stack
                    direction="row"
                    spacing={2}
                    alignItems="flex-start"
                    sx={{ mb: 2 }}
                  >
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        bgcolor: isAnswered
                          ? "success.main"
                          : alpha(theme.palette.primary.main, 0.1),
                        color: isAnswered ? "common.white" : "primary.main",
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      {isAnswered ? (
                        <CheckCircleRoundedIcon fontSize="small" />
                      ) : (
                        question.order
                      )}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 600, lineHeight: 1.4, mb: 0.5 }}
                      >
                        {getLocalizedQuestionText(question)}
                      </Typography>
                      <Chip
                        label={getQuestionTypeLabel(question.qtype)}
                        size="small"
                        variant="outlined"
                        sx={{ height: 22, fontSize: "0.72rem" }}
                      />
                    </Box>
                  </Stack>
                  {renderField(question)}
                </CardContent>
              </Card>
            );
          })}

          {submitError ? (
            <Alert
              severity="error"
              onClose={() => setSubmitError("")}
              sx={{ mt: 1 }}
            >
              {submitError}
            </Alert>
          ) : null}
        </Stack>
      )}

      {!loading && questions.length > 0 ? (
        <Box
          sx={{
            position: "sticky",
            bottom: 16,
            zIndex: 5,
            mt: 3,
          }}
        >
          <Paper
            elevation={0}
            sx={{
              p: { xs: 1.75, md: 2.25 },
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              backgroundColor: alpha(theme.palette.background.paper, 0.96),
              backdropFilter: "blur(8px)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: { xs: "stretch", md: "center" },
              flexDirection: { xs: "column", md: "row" },
              gap: 1.5,
              boxShadow: "0 -4px 20px -8px rgba(15, 23, 42, 0.12)",
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.25 }}>
                {t("form.ready")}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
                <Typography variant="body2" color="text.secondary">
                  {t("form.completed")}: {answeredCount} / {totalCount}
                </Typography>
                {allAnswered ? (
                  <Chip
                    size="small"
                    color="success"
                    label="100%"
                    icon={<CheckCircleRoundedIcon />}
                    sx={{ height: 22 }}
                  />
                ) : null}
              </Stack>
            </Box>

            <Button
              variant="contained"
              size="large"
              endIcon={<SendRoundedIcon />}
              onClick={handleSubmit}
              disabled={submitting || answeredCount === 0}
            >
              {submitting ? t("form.submitting") : t("form.submit")}
            </Button>
          </Paper>
        </Box>
      ) : null}
    </Box>
  );
}

export default QuestionnaireFormPage;
