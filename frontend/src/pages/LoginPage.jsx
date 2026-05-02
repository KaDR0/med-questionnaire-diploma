import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Container,
  TextField,
  Typography,
  Alert,
  Stack,
} from "@mui/material";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import LogoLockup from "../components/brand/LogoLockup";
import AuthScaffold from "../components/AuthScaffold";

/** Maps backend `error_code` to i18n keys; falls back to API `error` string. */
function login2faErrorMessage(err, t) {
  const code = err?.response?.data?.error_code;
  const keyByCode = {
    cooldown: "login.otpCooldown",
    rate_limit: "login.otpRateLimitHour",
    smtp_config_error: "login.otpSendFailed",
    smtp_send_failed: "login.otpSendFailed",
    challenge_expired: "login.otpChallengeExpired",
    challenge_invalid: "login.otpChallengeInvalid",
    invalid_code: "login.otpInvalid",
    max_attempts_exceeded: "login.otpAttemptsExceeded",
    code_expired: "login.otpExpired",
    code_not_requested: "login.otpNotRequested",
  };
  if (code && keyByCode[code]) {
    return t(keyByCode[code]);
  }
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    t("login.error")
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const { login, verifyLoginCode } = useAuth();
  const { t } = useTranslation();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verificationStep, setVerificationStep] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async () => {
    try {
      setError("");
      setSubmitting(true);

      const result = await login(form.email, form.password);
      if (result?.verification_required) {
        setVerificationStep(true);
        setChallengeToken(result.challenge_token || "");
        setVerificationEmail(result.email || form.email);
        return;
      }
      navigate("/");
    } catch (err) {
      console.error("Login error:", err);

      const message = login2faErrorMessage(err, t);

      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCode = async () => {
    try {
      setError("");
      setSubmitting(true);
      await verifyLoginCode(
        challengeToken,
        String(verificationCode || "").trim(),
        rememberDevice,
      );
      navigate("/");
    } catch (err) {
      console.error("Login verify error:", err);
      setError(login2faErrorMessage(err, t));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    try {
      setError("");
      setSubmitting(true);
      const result = await login(form.email, form.password);
      if (result?.verification_required) {
        setChallengeToken(result.challenge_token || "");
        setVerificationEmail(result.email || form.email);
      }
    } catch (err) {
      setError(login2faErrorMessage(err, t));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToLogin = () => {
    setVerificationStep(false);
    setVerificationCode("");
    setChallengeToken("");
    setVerificationEmail("");
    setRememberDevice(false);
    setError("");
  };

  return (
    <AuthScaffold
      sx={{
        display: "flex",
        alignItems: "center",
        py: 4,
      }}
    >
      <Container maxWidth="sm" sx={{ width: "100%" }}>
        <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }} className="mq-animate-fade-up">
          <LogoLockup variant="hero" disableLink caption="brand" animatedCaption />
        </Box>
        <Card className="mq-animate-fade-up-delay">
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Typography variant="h4" gutterBottom>
              {t("login.title")}
            </Typography>

            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {t("login.subtitle")}
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            {!verificationStep ? (
              <>
                <TextField
                  fullWidth
                  label={t("signup.email")}
                  sx={{ mb: 2 }}
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                />

                <TextField
                  fullWidth
                  type="password"
                  label={t("login.password")}
                  sx={{ mb: 3 }}
                  value={form.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                />

                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleSubmit}
                  disabled={submitting}
                  sx={{ mb: 2 }}
                >
                  {submitting ? t("login.loading") : t("login.button")}
                </Button>
              </>
            ) : (
              <Stack spacing={2}>
                <Alert severity="info">
                  {t("login.verificationRequired", { email: verificationEmail || form.email })}
                </Alert>
                <TextField
                  fullWidth
                  label={t("login.verificationCode")}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  inputProps={{ autoComplete: "one-time-code" }}
                />
                <Box
                  data-testid="login-remember-device"
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 1.5,
                    p: 2,
                    borderRadius: 1,
                    border: 1,
                    borderColor: "divider",
                    bgcolor: (theme) =>
                      theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "action.hover",
                  }}
                >
                  <Checkbox
                    id="login-remember-device-checkbox"
                    checked={rememberDevice}
                    onChange={(e) => setRememberDevice(e.target.checked)}
                    color="primary"
                    sx={{ p: 0, mt: 0.25 }}
                    inputProps={{ "aria-describedby": "login-remember-device-hint" }}
                  />
                  <Box
                    component="label"
                    htmlFor="login-remember-device-checkbox"
                    sx={{ cursor: "pointer", userSelect: "none", flex: 1, minWidth: 0 }}
                  >
                    <Typography variant="subtitle1" component="span" fontWeight={600} display="block">
                      {t("login.rememberDevice")}
                    </Typography>
                    <Typography
                      id="login-remember-device-hint"
                      variant="body2"
                      color="text.secondary"
                      display="block"
                      sx={{ mt: 0.75 }}
                    >
                      {t("login.rememberDeviceHint")}
                    </Typography>
                  </Box>
                </Box>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleVerifyCode}
                  disabled={submitting || !String(verificationCode || "").trim()}
                >
                  {submitting ? t("login.loading") : t("login.verifyButton")}
                </Button>
                <Button variant="text" fullWidth onClick={handleResendCode} disabled={submitting}>
                  {t("login.resendCode")}
                </Button>
                <Button variant="text" fullWidth onClick={handleBackToLogin} disabled={submitting}>
                  {t("login.backToLogin")}
                </Button>
              </Stack>
            )}

            <Typography variant="body2" color="text.secondary">
              {t("login.noAccount")}{" "}
              <Link to="/signup" style={{ color: "inherit", fontWeight: 600 }}>
                {t("login.signup")}
              </Link>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              <Link to="/about" style={{ color: "inherit", fontWeight: 600 }}>
                {t("about.link")}
              </Link>
            </Typography>
          </CardContent>
        </Card>
      </Container>
    </AuthScaffold>
  );
}

export default LoginPage;