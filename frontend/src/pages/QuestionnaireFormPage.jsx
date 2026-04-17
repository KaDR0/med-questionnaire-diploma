import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  TextField,
  Button,
  MenuItem,
  Snackbar,
  Alert,
  Paper,
  Chip,
  Stack,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import PageHeader from "../components/ui/PageHeader";
import SectionCard from "../components/ui/SectionCard";

function QuestionnaireFormPage() {
  const { id, questionnaireId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdAssessmentId, setCreatedAssessmentId] = useState(null);

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
    return Object.values(answers).filter((value) => String(value).trim() !== "").length;
  }, [answers]);

  const handleChange = (questionId, value) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSubmit = async () => {
    try {
      setSubmitError("");
      setSubmitting(true);

      const payload = {
        patient_id: Number(id),
        questionnaire_id: Number(questionnaireId),
        doctor_id: user?.id || null,
        answers: answers,
      };

      const response = await api.post("assessments/submit/", payload);

      setCreatedAssessmentId(response.data.assessment_id);
      setSnackbarOpen(true);

      setTimeout(() => {
        navigate(`/patients/${id}/assessments/${response.data.assessment_id}`);
      }, 1200);
    } catch (error) {
      console.error("Submit error:", error);
      setSubmitError(t("form.submitError"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
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
    return qtype;
  };

  const renderField = (question) => {
    const value = answers[question.id] || "";

    if (question.qtype === "yesno") {
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

    return (
      <TextField
        fullWidth
        label={t("form.answer")}
        value={value}
        onChange={(e) => handleChange(question.id, e.target.value)}
        multiline={question.qtype === "text"}
        minRows={question.qtype === "text" ? 3 : 1}
      />
    );
  };

  return (
    <Box>
      <PageHeader
        title={t("form.title")}
        subtitle={t("form.subtitle")}
        actions={
          <Stack direction="row" spacing={1}>
            <Chip label={`${t("form.patientId")}: ${id}`} color="primary" variant="outlined" />
            <Chip label={`${t("form.answered")}: ${answeredCount}/${questions.length}`} color="primary" variant="outlined" />
          </Stack>
        }
      />

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: { xs: "stretch", md: "center" },
            flexDirection: { xs: "column", md: "row" },
            gap: 2,
            mb: 3,
          }}
        >
          <Box>
            <Typography variant="h5" gutterBottom>
              {t("form.questions")}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {t("form.fill")}
            </Typography>
          </Box>

          <Button
            component={Link}
            to={`/patients/${id}/questionnaires`}
            variant="outlined"
          >
            {t("form.back")}
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
            <CircularProgress />
          </Box>
        ) : questions.length === 0 ? (
          <Card>
            <CardContent sx={{ py: 5 }}>
              <Typography align="center" color="text.secondary">
                {t("form.none")}
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <>
            {questions.map((question) => (
            <SectionCard
                key={question.id}
              contentSx={{ mb: 3 }}
              >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 2,
                      mb: 2,
                    }}
                  >
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        {question.order}. {getLocalizedQuestionText(question)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t("form.answerType")}: {getQuestionTypeLabel(question.qtype)}
                      </Typography>
                    </Box>

                    <Chip
                      label={getQuestionTypeLabel(question.qtype)}
                      color="primary"
                      variant="outlined"
                      size="small"
                    />
                </Box>

                {renderField(question)}
            </SectionCard>
            ))}

            {submitError && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {submitError}
              </Alert>
            )}

            <Box
              sx={{
                position: "sticky",
                bottom: 16,
                zIndex: 5,
              }}
            >
              <Paper
                elevation={0}
                sx={(theme) => ({
                  p: 2,
                  borderRadius: 4,
                  border: "1px solid",
                  borderColor: "divider",
                  backgroundColor: alpha(theme.palette.background.paper, 0.92),
                  backdropFilter: "blur(8px)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: { xs: "stretch", md: "center" },
                  flexDirection: { xs: "column", md: "row" },
                  gap: 2,
                })}
              >
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {t("form.ready")}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t("form.completed")}: {answeredCount} / {questions.length}
                  </Typography>
                </Box>

                <Button
                  variant="contained"
                  size="large"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? t("form.submitting") : t("form.submit")}
                </Button>
              </Paper>
            </Box>
          </>
        )}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={1200}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={handleCloseSnackbar} severity="success" sx={{ width: "100%" }}>
          {t("form.submitSuccess")}
          {createdAssessmentId ? ` (#${createdAssessmentId})` : ""}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default QuestionnaireFormPage;