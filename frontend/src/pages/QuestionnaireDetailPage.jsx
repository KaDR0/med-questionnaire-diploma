import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import api from "../api/axios";
import { useTranslation } from "react-i18next";

function QuestionnaireDetailPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`questionnaires/${id}/`)
      .then((response) => setItem(response.data))
      .catch((err) => setError(err?.response?.data?.detail || t("questionnaireDetail.loadError")));
  }, [id, t]);

  const interpretationPretty = useMemo(() => {
    if (!item?.interpretation_rules) return "";
    try {
      return JSON.stringify(JSON.parse(item.interpretation_rules), null, 2);
    } catch {
      return item.interpretation_rules;
    }
  }, [item?.interpretation_rules]);

  return (
    <Box>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {!item ? null : (
        <Stack spacing={2}>
          <Box sx={{ mb: 0.5 }}>
            <Typography variant="h4">{item.title_ru || item.title_en || item.title}</Typography>
            <Typography color="text.secondary">{item.description || "-"}</Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Chip label={item.approval_status} color={item.approval_status === "approved" ? "success" : "warning"} variant="outlined" />
            <Chip label={item.medical_area || t("myQuestionnaires.noArea")} variant="outlined" />
            <Chip label={item.risk_target || "-"} variant="outlined" />
          </Stack>
          <Card sx={{ border: "1px solid", borderColor: alpha(theme.palette.primary.main, 0.16) }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>{t("questionnaireDetail.source")}</Typography>
              <Typography>{item.source_name || "-"}</Typography>
              <Typography component="a" href={item.source_url} target="_blank" rel="noreferrer">{item.source_url || "-"}</Typography>
            </CardContent>
          </Card>
          <Card sx={{ border: "1px solid", borderColor: alpha(theme.palette.info.main, 0.16) }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>{t("questionnaireDetail.scoring")}</Typography>
              <Typography sx={{ mb: 1 }}>{item.scoring_method || "-"}</Typography>
              <Box component="pre" sx={{ whiteSpace: "pre-wrap", m: 0 }}>{interpretationPretty || "-"}</Box>
            </CardContent>
          </Card>
          <Card sx={{ border: "1px solid", borderColor: alpha(theme.palette.secondary.main, 0.2) }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>{t("questionnaireDetail.questions")}</Typography>
              <Stack spacing={1}>
                {(item.questions || []).map((question) => (
                  <Box key={question.id}>
                    <Typography fontWeight={700}>
                      #{question.order} {question.text || question.text_ru || question.text_en}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {question.qtype}
                    </Typography>
                    {question.qtype === "single_choice" ? (
                      <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                        {(question.options || []).map((option, idx) => (
                          <Typography key={idx} variant="body2">- {option.text} (score: {option.score})</Typography>
                        ))}
                      </Stack>
                    ) : null}
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => navigate("/questionnaires/my")}>{t("questionnaireDetail.back")}</Button>
            <Button variant="contained" onClick={() => navigate(`/questionnaires/${id}/edit`)}>{t("questionnaireDetail.edit")}</Button>
          </Stack>
        </Stack>
      )}
    </Box>
  );
}

export default QuestionnaireDetailPage;
