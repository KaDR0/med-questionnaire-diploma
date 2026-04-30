import { useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Box, Button, Card, CardContent, Container, Stack, TextField, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import api from "../api/axios";
import LogoLockup from "../components/brand/LogoLockup";

function DoctorSignupPage() {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
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
    if (raw.includes("first name is required")) {
      return t("doctorSignup.firstNameRequired");
    }
    if (raw.includes("last name is required")) {
      return t("doctorSignup.lastNameRequired");
    }
    if (raw.includes("email is required")) {
      return t("doctorSignup.emailRequired");
    }
    if (raw.includes("unable to process signup request")) {
      return t("doctorSignup.requestError");
    }
    if (raw.includes("unable to complete signup")) {
      return t("doctorSignup.verifyError");
    }

    return phase === "request" ? t("doctorSignup.requestError") : t("doctorSignup.verifyError");
  };

  const requestCode = async () => {
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      await api.post("auth/doctor-signup/request-code/", {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        password: form.password,
        confirm_password: form.confirm_password,
      });
      setStep(2);
      setSuccess(t("doctorSignup.codeSent"));
    } catch (err) {
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
      await api.post("auth/doctor-signup/verify-code/", {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        password: form.password,
        code: form.code,
      });
      setCompleted(true);
      setSuccess(t("doctorSignup.success"));
    } catch (err) {
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
            <Typography variant="h4" gutterBottom>{t("doctorSignup.title")}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
              {t("doctorSignup.subtitle")}
            </Typography>
            {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
            {success ? <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert> : null}

            <Stack spacing={2}>
              <TextField label={t("signup.firstName")} value={form.first_name} onChange={(e) => setField("first_name", e.target.value)} disabled={step === 2 || completed} />
              <TextField label={t("signup.lastName")} value={form.last_name} onChange={(e) => setField("last_name", e.target.value)} disabled={step === 2 || completed} />
              <TextField label={t("signup.email")} type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} disabled={step === 2 || completed} />
              <TextField label={t("signup.password")} type="password" value={form.password} onChange={(e) => setField("password", e.target.value)} disabled={step === 2 || completed} />
              {step === 1 ? (
                <TextField label={t("doctorSignup.confirmPassword")} type="password" value={form.confirm_password} onChange={(e) => setField("confirm_password", e.target.value)} disabled={completed} />
              ) : (
                <TextField label={t("doctorSignup.code")} value={form.code} onChange={(e) => setField("code", e.target.value)} disabled={completed} />
              )}

              <Button variant="contained" onClick={step === 1 ? requestCode : verifyCode} disabled={loading || completed}>
                {step === 1 ? t("doctorSignup.sendCode") : t("doctorSignup.finish")}
              </Button>
            </Stack>

            {success ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                {t("doctorSignup.awaitingApproval")}
              </Alert>
            ) : null}

            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              <Link to="/signup" style={{ color: "inherit", fontWeight: 600 }}>{t("doctorSignup.back")}</Link>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              <Link to="/login" style={{ color: "inherit", fontWeight: 600 }}>
                {completed ? t("doctorSignup.goToLogin") : t("signup.login")}
              </Link>
            </Typography>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}

export default DoctorSignupPage;
