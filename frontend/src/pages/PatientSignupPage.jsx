import { useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Link,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import BadgeRoundedIcon from "@mui/icons-material/BadgeRounded";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { useTranslation } from "react-i18next";

import api from "../api/axios";
import useToast from "../utils/useToast";
import LogoLockup from "../components/brand/LogoLockup";
import AuthScaffold from "../components/AuthScaffold";

function PatientSignupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const theme = useTheme();

  const [step, setStep] = useState(1);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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
      err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        ""
    ).toLowerCase();

    if (raw.includes("account with this email already exists"))
      return t("signupErrors.emailExists");
    if (raw.includes("please wait before requesting another code"))
      return t("signupErrors.cooldown");
    if (raw.includes("too many verification requests"))
      return t("signupErrors.rateLimit");
    if (raw.includes("verification code has expired"))
      return t("signupErrors.otpExpired");
    if (raw.includes("invalid verification code"))
      return t("signupErrors.otpInvalid");
    if (raw.includes("maximum verification attempts exceeded"))
      return t("signupErrors.otpAttemptsExceeded");
    if (raw.includes("verification code was not requested"))
      return t("signupErrors.otpNotRequested");
    if (raw.includes("unable to process signup request"))
      return t("patientSignup.requestError");
    if (raw.includes("unable to complete signup"))
      return t("patientSignup.verifyError");

    return phase === "request"
      ? t("patientSignup.requestError")
      : t("patientSignup.verifyError");
  };

  const requestCode = async () => {
    try {
      setLoading(true);
      setError("");
      await api.post("auth/patient-signup/request-code/", {
        patient_id: form.patient_id,
        email: form.email,
        password: form.password,
        confirm_password: form.confirm_password,
      });
      setStep(2);
      toast.success(t("patientSignup.codeSent"));
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
      await api.post("auth/patient-signup/verify-code/", {
        patient_id: form.patient_id,
        email: form.email,
        password: form.password,
        code: form.code,
      });
      setCompleted(true);
      toast.success(t("patientSignup.success"));
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

  const canRequest =
    form.patient_id.trim() &&
    form.email.trim() &&
    form.password &&
    form.confirm_password &&
    form.password === form.confirm_password;
  const canVerify = String(form.code || "").trim().length >= 4;

  return (
    <AuthScaffold sx={{ display: "flex", alignItems: "center", py: 6 }}>
      <Container maxWidth="sm" sx={{ width: "100%" }}>
        <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}>
          <LogoLockup variant="hero" disableLink caption="brand" animatedCaption />
        </Box>

        <Card>
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Typography variant="h4" sx={{ mb: 0.5 }}>
              {t("patientSignup.title")}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t("patientSignup.subtitle")}
            </Typography>

            <Stepper
              activeStep={step - 1}
              alternativeLabel
              sx={{
                mb: 3,
                "& .MuiStepLabel-label": { fontWeight: 600 },
              }}
            >
              <Step>
                <StepLabel>{t("patientSignup.title")}</StepLabel>
              </Step>
              <Step>
                <StepLabel>{t("login.verifyButton")}</StepLabel>
              </Step>
            </Stepper>

            {step === 1 ? (
              <Alert
                severity="info"
                icon={<BadgeRoundedIcon fontSize="small" />}
                sx={{ mb: 2 }}
              >
                {t("patientSignup.emailHint")}
              </Alert>
            ) : null}
            {error ? (
              <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>
                {error}
              </Alert>
            ) : null}

            <Stack spacing={2}>
              <TextField
                label={t("patientSignup.patientId")}
                value={form.patient_id}
                onChange={(e) => setField("patient_id", e.target.value)}
                disabled={step === 2 || completed}
                slotProps={{
                  input: {
                    startAdornment: (
                      <BadgeRoundedIcon
                        fontSize="small"
                        sx={{ mr: 1, color: "text.secondary" }}
                      />
                    ),
                  },
                }}
              />
              <TextField
                label={t("signup.email")}
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                disabled={step === 2 || completed}
                slotProps={{
                  input: {
                    startAdornment: (
                      <MailOutlineRoundedIcon
                        fontSize="small"
                        sx={{ mr: 1, color: "text.secondary" }}
                      />
                    ),
                  },
                }}
              />
              <TextField
                label={t("signup.password")}
                type="password"
                value={form.password}
                onChange={(e) => setField("password", e.target.value)}
                disabled={step === 2 || completed}
                slotProps={{
                  input: {
                    startAdornment: (
                      <LockRoundedIcon
                        fontSize="small"
                        sx={{ mr: 1, color: "text.secondary" }}
                      />
                    ),
                  },
                }}
              />
              {step === 1 ? (
                <TextField
                  label={t("patientSignup.confirmPassword")}
                  type="password"
                  value={form.confirm_password}
                  onChange={(e) => setField("confirm_password", e.target.value)}
                  disabled={completed}
                  error={
                    form.confirm_password.length > 0 &&
                    form.password !== form.confirm_password
                  }
                  helperText={
                    form.confirm_password.length > 0 &&
                    form.password !== form.confirm_password
                      ? t("patientSignup.passwordsMismatch", {
                          defaultValue: "Passwords do not match",
                        })
                      : ""
                  }
                  slotProps={{
                    input: {
                      startAdornment: (
                        <LockRoundedIcon
                          fontSize="small"
                          sx={{ mr: 1, color: "text.secondary" }}
                        />
                      ),
                    },
                  }}
                />
              ) : (
                <TextField
                  label={t("patientSignup.code")}
                  value={form.code}
                  onChange={(e) =>
                    setField("code", e.target.value.replace(/\D/g, "").slice(0, 8))
                  }
                  disabled={completed}
                  autoFocus
                  slotProps={{
                    htmlInput: {
                      inputMode: "numeric",
                      autoComplete: "one-time-code",
                      style: {
                        textAlign: "center",
                        letterSpacing: "0.45em",
                        fontSize: "1.5rem",
                        fontWeight: 700,
                      },
                    },
                  }}
                />
              )}

              <Button
                variant="contained"
                size="large"
                onClick={step === 1 ? requestCode : verifyCode}
                disabled={
                  loading ||
                  completed ||
                  (step === 1 ? !canRequest : !canVerify)
                }
                startIcon={
                  step === 1 ? <MailOutlineRoundedIcon /> : <SecurityRoundedIcon />
                }
              >
                {loading
                  ? t("login.loading")
                  : step === 1
                    ? t("patientSignup.sendCode")
                    : t("patientSignup.finish")}
              </Button>

              {step === 2 ? (
                <Button
                  variant="text"
                  startIcon={<ArrowBackRoundedIcon />}
                  onClick={() => {
                    setStep(1);
                    setError("");
                    setField("code", "");
                  }}
                  disabled={loading || completed}
                >
                  {t("login.backToLogin")}
                </Button>
              ) : null}
            </Stack>

            <Box
              sx={{
                mt: 3,
                pt: 2,
                borderTop: "1px solid",
                borderColor: alpha(theme.palette.divider, 0.7),
              }}
            >
              <Typography variant="body2" color="text.secondary">
                <Link
                  component={RouterLink}
                  to="/signup"
                  underline="hover"
                  sx={{ color: "text.secondary", fontWeight: 600 }}
                >
                  {t("patientSignup.back")}
                </Link>
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </AuthScaffold>
  );
}

export default PatientSignupPage;
