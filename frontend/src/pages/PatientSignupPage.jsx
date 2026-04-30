import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert, Box, Button, Card, CardContent, Container, Stack, TextField, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import api from "../api/axios";
import LogoLockup from "../components/brand/LogoLockup";

function PatientSignupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    patient_id: "",
    email: "",
    password: "",
    confirm_password: "",
    code: "",
  });

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const mapError = (err, phase) => {
    const raw = String(
      err?.response?.data?.error || err?.response?.data?.message || err?.response?.data?.detail || ""
    ).toLowerCase();

    if (raw.includes("account with this email already exists")) {
      return t("signupErrors.emailExists");
    }
    if (raw.includes("please wait before requesting another code")) {
      return t("signupErrors.cooldown");
    }
    if (raw.includes("too many verification requests")) {
      return t("signupErrors.rateLimit");
    }
    if (raw.includes("verification code has expired")) {
      return t("signupErrors.otpExpired");
    }
    if (raw.includes("invalid verification code")) {
      return t("signupErrors.otpInvalid");
    }
    if (raw.includes("maximum verification attempts exceeded")) {
      return t("signupErrors.otpAttemptsExceeded");
    }
    if (raw.includes("verification code was not requested")) {
      return t("signupErrors.otpNotRequested");
    }
    if (raw.includes("unable to process signup request")) {
      return t("patientSignup.requestError");
    }
    if (raw.includes("unable to complete signup")) {
      return t("patientSignup.verifyError");
    }

    return phase === "request" ? t("patientSignup.requestError") : t("patientSignup.verifyError");
  };

  const requestCode = async () => {
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      await api.post("auth/patient-signup/request-code/", {
        patient_id: form.patient_id,
        email: form.email,
        password: form.password,
        confirm_password: form.confirm_password,
      });
      setStep(2);
      setSuccess(t("patientSignup.codeSent"));
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Patient signup request-code failed:", {
          status: err?.response?.status,
          data: err?.response?.data,
        });
      }
      setError(mapError(err, "request"));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      await api.post("auth/patient-signup/verify-code/", {
        patient_id: form.patient_id,
        email: form.email,
        password: form.password,
        code: form.code,
      });
      setCompleted(true);
      setSuccess(t("patientSignup.success"));
      setTimeout(() => navigate("/login"), 1300);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Patient signup verify-code failed:", {
          status: err?.response?.status,
          data: err?.response?.data,
        });
      }
      setError(mapError(err, "verify"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className="mq-workspace-bg" sx={{ minHeight: "100vh", display: "flex", alignItems: "center", py: 6 }}>
      <Container maxWidth="sm" sx={{ width: "100%" }}>
        <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}>
          <LogoLockup variant="hero" disableLink caption="brand" animatedCaption />
        </Box>
        <Card>
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Typography variant="h4" gutterBottom>{t("patientSignup.title")}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
              {t("patientSignup.subtitle")}
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              {t("patientSignup.emailHint")}
            </Alert>
            {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
            {success ? <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert> : null}

            <Stack spacing={2}>
              <TextField label={t("patientSignup.patientId")} value={form.patient_id} onChange={(e) => setField("patient_id", e.target.value)} disabled={step === 2 || completed} />
              <TextField label={t("signup.email")} type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} disabled={step === 2 || completed} />
              <TextField label={t("signup.password")} type="password" value={form.password} onChange={(e) => setField("password", e.target.value)} disabled={step === 2 || completed} />
              {step === 1 ? (
                <TextField label={t("patientSignup.confirmPassword")} type="password" value={form.confirm_password} onChange={(e) => setField("confirm_password", e.target.value)} disabled={completed} />
              ) : (
                <TextField label={t("patientSignup.code")} value={form.code} onChange={(e) => setField("code", e.target.value)} disabled={completed} />
              )}

              <Button variant="contained" onClick={step === 1 ? requestCode : verifyCode} disabled={loading || completed}>
                {step === 1 ? t("patientSignup.sendCode") : t("patientSignup.finish")}
              </Button>
            </Stack>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              <Link to="/signup" style={{ color: "inherit", fontWeight: 600 }}>{t("patientSignup.back")}</Link>
            </Typography>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}

export default PatientSignupPage;
