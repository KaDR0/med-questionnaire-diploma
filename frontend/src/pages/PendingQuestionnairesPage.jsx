import { useEffect, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import api from "../api/axios";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

function PendingQuestionnairesPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const response = await api.get("questionnaires/pending-approval/");
      setItems(response.data || []);
    } catch {
      setError(t("pendingQuestionnaires.loadError"));
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>
        {t("pendingQuestionnaires.title")}
      </Typography>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {items.length === 0 ? <Alert severity="info" sx={{ mb: 2 }}>{t("pendingQuestionnaires.empty")}</Alert> : null}
      <Stack spacing={2}>
        {items.map((item) => (
          <Card key={item.id} sx={{ border: "1px solid", borderColor: alpha(theme.palette.warning.main, 0.24) }}>
            <CardContent>
              <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1}>
                <Box>
                  <Typography variant="h6">{item.title_ru || item.title_en || item.title}</Typography>
                  <Typography color="text.secondary">{t("pendingQuestionnaires.source")}: {item.source_name || t("pendingQuestionnaires.notSpecified")}</Typography>
                  <Typography variant="body2" color="text.secondary">{t("pendingQuestionnaires.author")}: {item?.created_by || "-"}</Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button component={Link} to={`/questionnaires/review/${item.id}`} variant="contained">
                    {t("pendingQuestionnaires.review")}
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}

export default PendingQuestionnairesPage;
