import { useState } from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Container,
  Divider,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";

import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import useToast from "../utils/useToast";
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
  const toast = useToast();
  const theme = useTheme();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verificationStep, setVerificationStep] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
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
      setError(login2faErrorMessage(err, t));
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
        rememberDevice
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
        toast.success(t("login.resendCode"));
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
    <AuthScaffold sx={{ display: "flex", alignItems: "center", py: 4 }}>
      <Container maxWidth="sm" sx={{ width: "100%" }}>
        <Box
          sx={{ display: "flex", justifyContent: "center", mb: 3 }}
          className="mq-animate-fade-up"
        >
          <LogoLockup variant="hero" disableLink caption="brand" animatedCaption />
        </Box>

        <Card className="mq-animate-fade-up-delay">
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            {!verificationStep ? (
              <>
                <Typography variant="h4" sx={{ mb: 0.75 }}>
                  {t("login.title")}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                  {t("login.subtitle")}
                </Typography>

                {error ? (
                  <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2.5 }}>
                    {error}
                  </Alert>
                ) : null}

                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    type="email"
                    label={t("signup.email")}
                    value={form.email}
                    onChange={(e) => handleChange("email", e.target.value)}
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
                    fullWidth
                    type="password"
                    label={t("login.password")}
                    value={form.password}
                    onChange={(e) => handleChange("password", e.target.value)}
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
                  <Button
                    variant="contained"
                    fullWidth
                    size="large"
                    startIcon={<LoginRoundedIcon />}
                    onClick={handleSubmit}
                    disabled={submitting || !form.email || !form.password}
                  >
                    {submitting ? t("login.loading") : t("login.button")}
                  </Button>
                </Stack>
              </>
            ) : (
              <>
                <Stack
                  direction="row"
                  spacing={1.25}
                  alignItems="center"
                  sx={{ mb: 2 }}
                >
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: alpha(theme.palette.primary.main, 0.12),
                      color: "primary.main",
                    }}
                  >
                    <SecurityRoundedIcon />
                  </Box>
                  <Box>
                    <Typography variant="h5" sx={{ lineHeight: 1.2 }}>
                      {t("login.verifyButton")}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t("login.verificationRequired", {
                        email: verificationEmail || form.email,
                      })}
                    </Typography>
                  </Box>
                </Stack>

                {error ? (
                  <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                ) : null}

                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    label={t("login.verificationCode")}
                    value={verificationCode}
                    onChange={(e) =>
                      setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 8))
                    }
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
                    autoFocus
                  />
                  <Box
                    data-testid="login-remember-device"
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 1.5,
                      p: 2,
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: "divider",
                      bgcolor: alpha(theme.palette.primary.main, 0.03),
                    }}
                  >
                    <Checkbox
                      id="login-remember-device-checkbox"
                      checked={rememberDevice}
                      onChange={(e) => setRememberDevice(e.target.checked)}
                      color="primary"
                      sx={{ p: 0, mt: 0.25 }}
                      slotProps={{
                        input: { "aria-describedby": "login-remember-device-hint" },
                      }}
                    />
                    <Box
                      component="label"
                      htmlFor="login-remember-device-checkbox"
                      sx={{ cursor: "pointer", userSelect: "none", flex: 1, minWidth: 0 }}
                    >
                      <Typography variant="subtitle1" component="span" fontWeight={700} display="block">
                        {t("login.rememberDevice")}
                      </Typography>
                      <Typography
                        id="login-remember-device-hint"
                        variant="body2"
                        color="text.secondary"
                        display="block"
                        sx={{ mt: 0.5 }}
                      >
                        {t("login.rememberDeviceHint")}
                      </Typography>
                    </Box>
                  </Box>
                  <Button
                    variant="contained"
                    fullWidth
                    size="large"
                    onClick={handleVerifyCode}
                    disabled={submitting || !String(verificationCode || "").trim()}
                  >
                    {submitting ? t("login.loading") : t("login.verifyButton")}
                  </Button>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <Button
                      variant="text"
                      fullWidth
                      onClick={handleResendCode}
                      disabled={submitting}
                    >
                      {t("login.resendCode")}
                    </Button>
                    <Button
                      variant="text"
                      fullWidth
                      startIcon={<ArrowBackRoundedIcon />}
                      onClick={handleBackToLogin}
                      disabled={submitting}
                    >
                      {t("login.backToLogin")}
                    </Button>
                  </Stack>
                </Stack>
              </>
            )}

            {!verificationStep ? (
              <>
                <Divider sx={{ my: 3 }} />
                <Stack spacing={1.25}>
                  <Typography variant="body2" color="text.secondary">
                    {t("login.noAccount")}{" "}
                    <Link
                      component={RouterLink}
                      to="/signup"
                      underline="hover"
                      sx={{ color: "primary.main", fontWeight: 600 }}
                    >
                      {t("login.signup")}
                    </Link>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <Link
                      component={RouterLink}
                      to="/about"
                      underline="hover"
                      sx={{ color: "text.secondary", fontWeight: 600 }}
                    >
                      {t("about.link")}
                    </Link>
                  </Typography>
                </Stack>
              </>
            ) : null}
          </CardContent>
        </Card>
      </Container>
    </AuthScaffold>
  );
}

export default LoginPage;
