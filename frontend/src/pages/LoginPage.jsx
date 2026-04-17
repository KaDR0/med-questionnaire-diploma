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
} from "@mui/material";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import LogoLockup from "../components/brand/LogoLockup";

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useTranslation();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

      await login(form.email, form.password);
      navigate("/");
    } catch (err) {
      console.error("Login error:", err);

      const message =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        err?.code ||
        "Login failed";

      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      className="mq-workspace-bg"
      sx={{
        minHeight: "100vh",
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

            <TextField
              fullWidth
              label="Email"
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
    </Box>
  );
}

export default LoginPage;