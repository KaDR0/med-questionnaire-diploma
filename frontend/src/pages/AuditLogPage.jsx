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

  const toMessage = (item) => {
    const action = String(item?.action || "");
    const details = item?.details || {};
    const objectId = item?.object_id ? ` #${item.object_id}` : "";
    const patientId = details?.patient_id ? ` #${details.patient_id}` : "";
    const map = {
      patient_created: t("dashboard.activityMap.patientCreated", { id: objectId }),
      questionnaire_created: t("dashboard.activityMap.questionnaireCreated", { id: objectId }),
      questionnaire_archived: t("dashboard.activityMap.questionnaireArchived", { id: objectId }),
      questionnaire_restored: t("dashboard.activityMap.questionnaireRestored", { id: objectId }),
      questionnaire_submitted_for_approval: t("dashboard.activityMap.questionnaireSubmitted", { id: objectId }),
      questionnaire_approved: t("dashboard.activityMap.questionnaireApproved", { id: objectId }),
      questionnaire_rejected: t("dashboard.activityMap.questionnaireRejected", { id: objectId }),
      questionnaire_changes_requested: t("dashboard.activityMap.questionnaireChangesRequested", { id: objectId }),
      questionnaire_session_created: t("dashboard.activityMap.questionnaireSessionCreated", { patientId }),
      assessment_submitted: t("dashboard.activityMap.assessmentSubmitted", { patientId }),
      public_questionnaire_completed: t("dashboard.activityMap.publicQuestionnaireCompleted", { patientId }),
    };
    return map[action] || t("dashboard.activityMap.defaultAction");
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.75 }}>{t("dashboard.viewAllActions")}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("dashboard.historySubtitle")}
      </Typography>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      <Card>
        <CardContent>
          {(items || []).length === 0 ? (
            <Typography color="text.secondary">{t("auditLog.noData")}</Typography>
          ) : (
            <Stack spacing={1}>
              {items.map((item) => (
                <Box key={item.id}>
                  <Typography variant="body2">{toMessage(item)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t("dashboard.activityBy", {
                      actor: item.user_email || t("dashboard.systemActor"),
                      time: new Date(item.created_at).toLocaleString(),
                    })}
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
