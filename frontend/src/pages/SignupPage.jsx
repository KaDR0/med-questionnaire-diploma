import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  TextField,
  Typography,
  Alert,
  MenuItem,
} from "@mui/material";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import LogoLockup from "../components/brand/LogoLockup";

function SignupPage() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const { t } = useTranslation();

  const [form, setForm] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    role: "doctor",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const validatePassword = (password) => {
    const hasCyrillic = /[А-Яа-яЁёӘәІіҢңҒғҮүҰұҚқӨөҺһ]/.test(password);
    if (hasCyrillic) {
      return t("signup.passwordRules.noCyrillic");
    }

    if (password.length < 8) {
      return t("signup.passwordRules.minLength");
    }

    const hasLetter = /[A-Za-z]/.test(password);
    const hasDigit = /\d/.test(password);

    if (!hasLetter || !hasDigit) {
      return t("signup.passwordRules.letterAndDigit");
    }

    return "";
  };

  const handleSubmit = async () => {
    try {
      setError("");
      setSuccess("");

      const passwordError = validatePassword(form.password);
      if (passwordError) {
        setError(passwordError);
        return;
      }

      await signup(form);

      setSuccess(
        t("signup.success")
      );

      setTimeout(() => {
        navigate("/login");
      }, 2500);
    } catch (err) {
      console.error("Signup error:", err);

      const message =
        err?.code ||
        err?.response?.data?.error ||
        err?.message ||
        t("signup.error");

      setError(message);
    }
  };

  return (
    <Box
      className="mq-workspace-bg"
      sx={{ minHeight: "100vh", display: "flex", alignItems: "center", py: 6 }}
    >
      <Container maxWidth="sm" sx={{ width: "100%" }}>
        <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }} className="mq-animate-fade-up">
          <LogoLockup variant="hero" disableLink caption="brand" animatedCaption />
        </Box>
        <Card className="mq-animate-fade-up-delay">
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Typography variant="h4" gutterBottom>
              {t("signup.title")}
            </Typography>

            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {t("signup.subtitle")}
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            {success && (
              <Alert severity="success" sx={{ mb: 3 }}>
                {success}
              </Alert>
            )}

            <TextField
              fullWidth
              label={t("signup.firstName")}
              sx={{ mb: 2 }}
              value={form.first_name}
              onChange={(e) => handleChange("first_name", e.target.value)}
            />

            <TextField
              fullWidth
              label={t("signup.lastName")}
              sx={{ mb: 2 }}
              value={form.last_name}
              onChange={(e) => handleChange("last_name", e.target.value)}
            />

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
              label={t("signup.password")}
              sx={{ mb: 1 }}
              value={form.password}
              onChange={(e) => handleChange("password", e.target.value)}
            />

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {t("signup.passwordHint")}
            </Typography>
            <TextField
              select
              fullWidth
              label={t("signup.role")}
              sx={{ mb: 3 }}
              value={form.role}
              onChange={(e) => handleChange("role", e.target.value)}
            >
              <MenuItem value="doctor">{t("signup.roles.doctor")}</MenuItem>
              <MenuItem value="chief_doctor">{t("signup.roles.chiefDoctor")}</MenuItem>
              <MenuItem value="admin">{t("signup.roles.admin")}</MenuItem>
            </TextField>

            <Button variant="contained" fullWidth onClick={handleSubmit} sx={{ mb: 2 }}>
              {t("signup.button")}
            </Button>

            <Typography variant="body2" color="text.secondary">
              {t("signup.hasAccount")}{" "}
              <Link to="/login" style={{ color: "inherit", fontWeight: 600 }}>
                {t("signup.login")}
              </Link>
            </Typography>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}

export default SignupPage;