import { useEffect, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import api from "../api/axios";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

function MyQuestionnairesPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const response = await api.get("questionnaires/");
      setItems(response.data || []);
    } catch {
      setError(t("myQuestionnaires.loadError"));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submitForApproval = async (id) => {
    try {
      await api.post(`questionnaires/${id}/submit-for-approval/`);
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || t("myQuestionnaires.submitError"));
    }
  };

  const getStatusLabel = (status) =>
    t(`myQuestionnaires.status.${status || "draft"}`, { defaultValue: status || "draft" });

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>
        {t("myQuestionnaires.title")}
      </Typography>
      <Button component={Link} to="/questionnaires/create" variant="contained" sx={{ mb: 2 }}>
        {t("myQuestionnaires.create")}
      </Button>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {items.length === 0 ? <Alert severity="info" sx={{ mb: 2 }}>{t("myQuestionnaires.empty")}</Alert> : null}
      <Stack spacing={2}>
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h6">{item.title_ru || item.title_en || item.title}</Typography>
                  <Typography color="text.secondary">{item.medical_area || t("myQuestionnaires.noArea")}</Typography>
                  <Typography variant="body2" color="text.secondary">{item.risk_target || "-"}</Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label={getStatusLabel(item.approval_status)} />
                  <Button component={Link} to={`/questionnaires/${item.id}`} variant="text">{t("myQuestionnaires.view")}</Button>
                  {["draft", "rejected", "changes_requested"].includes(item.approval_status) ? (
                    <Button component={Link} to={`/questionnaires/${item.id}/edit`} variant="outlined">
                      {t("myQuestionnaires.edit")}
                    </Button>
                  ) : null}
                  {["draft", "rejected", "changes_requested"].includes(item.approval_status) ? (
                    <Button variant="outlined" onClick={() => submitForApproval(item.id)}>
                      {t("myQuestionnaires.submitForApproval")}
                    </Button>
                  ) : null}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}

export default MyQuestionnairesPage;
