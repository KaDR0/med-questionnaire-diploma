import { useEffect, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Stack, Typography } from "@mui/material";
import api from "../api/axios";
import { useTranslation } from "react-i18next";

function QuestionnaireArchivePage() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    api
      .get("questionnaires/archived/")
      .then((response) => setItems(response.data || []))
      .catch((err) => setError(err?.response?.data?.detail || t("archive.loadError")))
      .finally(() => setLoading(false));
  }, [t]);

  const restoreQuestionnaire = async (id) => {
    try {
      await api.post(`questionnaires/${id}/restore/`);
      setFeedback(t("archive.restoreSuccess"));
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err?.response?.data?.detail || t("archive.restoreError"));
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        {t("archive.title")}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2.5 }}>
        {t("archive.subtitle")}
      </Typography>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {feedback ? <Alert severity="success" sx={{ mb: 2 }}>{feedback}</Alert> : null}
      {!items.length ? <Alert severity="info">{t("archive.empty")}</Alert> : null}
      <Stack spacing={2}>
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent>
              <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
                <Box>
                  <Typography variant="h6">{item.title_ru || item.title_en || item.title}</Typography>
                  <Typography color="text.secondary">{item.medical_area || t("archive.noArea")}</Typography>
                </Box>
                <Chip label={t("myQuestionnaires.status.archived")} color="default" variant="outlined" />
              </Stack>
              <Stack spacing={0.4} sx={{ mt: 1.5 }}>
                <Typography variant="body2" color="text.secondary">
                  {t("archive.archivedBy")}: {item.archived_by_email || t("archive.system")}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t("archive.archivedAt")}: {item.archived_at ? new Date(item.archived_at).toLocaleString() : t("common.noData")}
                </Typography>
              </Stack>
              <Box sx={{ mt: 1.5 }}>
                <Button variant="outlined" onClick={() => restoreQuestionnaire(item.id)}>
                  {t("archive.restore")}
                </Button>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}

export default QuestionnaireArchivePage;
