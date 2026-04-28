import { useEffect, useState } from "react";
import { Alert, Box, Card, CardContent, Stack, Typography } from "@mui/material";
import api from "../api/axios";
import { useTranslation } from "react-i18next";

function AuditLogPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("audit-logs/")
      .then((response) => setItems(response.data || []))
      .catch((err) => setError(err?.response?.data?.detail || t("auditLog.loadError")));
  }, [t]);

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>{t("auditLog.title")}</Typography>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      <Card>
        <CardContent>
          {(items || []).length === 0 ? (
            <Typography color="text.secondary">{t("auditLog.noData")}</Typography>
          ) : (
            <Stack spacing={1}>
              {items.map((item) => (
                <Box key={item.id}>
                  <Typography variant="body2">
                    {item.action} / {item.object_type}#{item.object_id || "-"} / {item.user_email || "-"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(item.created_at).toLocaleString()}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default AuditLogPage;
