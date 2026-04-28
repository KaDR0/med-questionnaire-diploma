import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, Box, Button, Card, CardContent, CircularProgress, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import api from "../api/axios";
import { useTranslation } from "react-i18next";

function PublicQuestionnairePage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState(null);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`public/questionnaire/${token}/`)
      .then((response) => setPayload(response.data))
      .catch((err) => {
        const code = err?.response?.data?.code;
        if (code === "expired") {
          navigate("/public/questionnaire/expired", { replace: true });
          return;
        }
        if (code === "used") {
          navigate("/public/questionnaire/invalid", { replace: true });
          return;
        }
        setError(err?.response?.data?.detail || t("publicQuestionnaire.invalidLink"));
      })
      .finally(() => setLoading(false));
  }, [token, t, navigate]);

  const handleSubmit = async () => {
    try {
      await api.post(`public/questionnaire/${token}/submit/`, { answers });
      navigate(`/public/questionnaire/${token}/success`, { replace: true });
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === "expired") {
        navigate("/public/questionnaire/expired", { replace: true });
        return;
      }
      if (code === "used") {
        navigate("/public/questionnaire/invalid", { replace: true });
        return;
      }
      setError(err?.response?.data?.detail || t("publicQuestionnaire.submitError"));
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", py: 4 }}>
      <Box sx={{ maxWidth: 760, mx: "auto", width: "100%", px: 2 }}>
        <Card sx={{ border: "1px solid", borderColor: alpha(theme.palette.primary.main, 0.2) }}>
          <CardContent>
            <Typography variant="h4" sx={{ mb: 1.5 }}>
              {payload?.title || t("publicQuestionnaire.title")}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2.5 }}>
              {payload?.description || t("publicQuestionnaire.subtitle")}
            </Typography>
            {payload?.screening_disclaimer ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                {payload.screening_disclaimer}
              </Alert>
            ) : null}
            {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
            {
              <Stack spacing={2}>
                {(payload?.questions || []).map((question) => (
                  <Card key={question.id} variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent>
                      <Typography sx={{ mb: 1, fontWeight: 600 }}>
                        {question.text || question.text_ru || question.text_en}
                      </Typography>
                    {question.qtype === "yesno" ? (
                      <TextField
                        select
                        fullWidth
                        value={answers[String(question.id)] ?? ""}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))}
                      >
                        <MenuItem value="">{t("publicQuestionnaire.select")}</MenuItem>
                        <MenuItem value="yes">{t("form.yes")}</MenuItem>
                        <MenuItem value="no">{t("form.no")}</MenuItem>
                      </TextField>
                    ) : question.qtype === "single_choice" ? (
                      <TextField
                        select
                        fullWidth
                        value={answers[String(question.id)] ?? ""}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))}
                      >
                        <MenuItem value="">{t("publicQuestionnaire.select")}</MenuItem>
                        {(question.options || []).map((option, idx) => (
                          <MenuItem key={`${question.id}-${idx}`} value={option.value}>
                            {option.text}
                          </MenuItem>
                        ))}
                      </TextField>
                    ) : (
                      <TextField
                        fullWidth
                        value={answers[String(question.id)] ?? ""}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))}
                      />
                    )}
                    </CardContent>
                  </Card>
                ))}
                <Button variant="contained" onClick={handleSubmit} size="large">
                  {t("publicQuestionnaire.submit")}
                </Button>
              </Stack>
            }
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}

export default PublicQuestionnairePage;
