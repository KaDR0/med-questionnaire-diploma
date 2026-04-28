import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import api from "../api/axios";
import { useTranslation } from "react-i18next";
import { QRCodeCanvas } from "qrcode.react";

function CreateQrQuestionnairePage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const configuredPublicSiteUrl = import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin;
  const [patients, setPatients] = useState([]);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [patientId, setPatientId] = useState("");
  const [questionnaireId, setQuestionnaireId] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([api.get("patients/"), api.get("questionnaires/")])
      .then(([patientsRes, questionnairesRes]) => {
        setPatients(patientsRes.data || []);
        const approved = (questionnairesRes.data || []).filter((q) => q.approval_status === "approved" && q.is_active);
        setQuestionnaires(approved);
      })
      .catch(() => setError(t("qr.createLoadError")));
  }, []);

  const handleGenerate = async () => {
    try {
      setError("");
      const response = await api.post("questionnaire-sessions/", {
        patient_id: Number(patientId),
        questionnaire_id: Number(questionnaireId),
      });
      setResult(response.data);
    } catch (err) {
      setError(err?.response?.data?.detail || t("qr.createError"));
    }
  };

  const publicSiteBaseUrl = String(configuredPublicSiteUrl || window.location.origin).replace(/\/+$/, "");
  const publicUrl = result ? `${publicSiteBaseUrl}/public/questionnaire/${result.token}` : "";

  const handleCopy = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
  };

  const handleDownloadPng = () => {
    const canvas = document.getElementById("qr-session-canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `questionnaire-qr-${result?.token || "session"}.png`;
    link.click();
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>
        {t("qr.createTitle")}
      </Typography>
      <Card sx={{ border: "1px solid", borderColor: alpha(theme.palette.primary.main, 0.16) }}>
        <CardContent>
          <Stack spacing={2}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <Alert severity="warning" variant="outlined">
              {t("qr.singleUseNote")}
            </Alert>
            <TextField select label={t("qr.patient")} value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              <MenuItem value="">{t("qr.selectPatient")}</MenuItem>
              {patients.map((patient) => (
                <MenuItem key={patient.id} value={patient.id}>
                  {patient.full_name} ({patient.patient_code || t("qr.noId")})
                </MenuItem>
              ))}
            </TextField>
            <TextField select label={t("qr.questionnaire")} value={questionnaireId} onChange={(e) => setQuestionnaireId(e.target.value)}>
              <MenuItem value="">{t("qr.selectQuestionnaire")}</MenuItem>
              {questionnaires.map((questionnaire) => (
                <MenuItem key={questionnaire.id} value={questionnaire.id}>
                  {questionnaire.title_ru || questionnaire.title_en || questionnaire.title}
                </MenuItem>
              ))}
            </TextField>
            <Button variant="contained" onClick={handleGenerate} disabled={!patientId || !questionnaireId}>
              {t("qr.generate")}
            </Button>
            {questionnaires.length === 0 ? (
              <Alert severity="warning">{t("qr.noApprovedQuestionnaires")}</Alert>
            ) : null}
            {result ? <Alert severity="success">{t("qr.expiresAt")}: {new Date(result.expires_at).toLocaleString()}</Alert> : null}
            {result ? (
              <Card
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  borderColor: alpha(theme.palette.primary.main, 0.22),
                  background: alpha(theme.palette.primary.main, 0.03),
                }}
              >
                <CardContent>
                  <Stack spacing={1.25} alignItems="center" sx={{ py: 0.5 }}>
                    <QRCodeCanvas id="qr-session-canvas" value={publicUrl} size={240} includeMargin />
                    <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-all", textAlign: "center" }}>
                      {t("qr.link")}: {publicUrl}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Button variant="outlined" onClick={handleCopy}>
                        {copied ? t("qr.copied") : t("qr.copyLink")}
                      </Button>
                      <Button variant="outlined" onClick={handleDownloadPng}>
                        {t("qr.downloadPng")}
                      </Button>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {result.questionnaire_title || "-"} / {result.patient_display || "-"}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            ) : null}
          </Stack>
        </CardContent>
      </Card>
      <Snackbar
        open={copied}
        autoHideDuration={1600}
        onClose={() => setCopied(false)}
        message={t("qr.copied")}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}

export default CreateQrQuestionnairePage;
