import { Box, Button, Divider, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import LogoLockup from "./brand/LogoLockup";

const navByRole = {
  doctor: [
    { id: "dashboard", labelKey: "navbar.dashboard", to: "/" },
    { id: "patients", labelKey: "navbar.patients", to: "/patients" },
    { id: "labResults", labelKey: "navbar.labResults", to: "/patients#labs" },
    { id: "assessments", labelKey: "navbar.assessments", to: "/patients#assessments" },
    { id: "createQr", labelKey: "navbar.createQr", to: "/questionnaires/qr" },
    { id: "myQuestionnaires", labelKey: "navbar.myQuestionnaires", to: "/questionnaires/my" },
    { id: "profile", labelKey: "navbar.profile", to: "/profile" },
  ],
  chief_doctor: [
    { id: "dashboard", labelKey: "navbar.dashboard", to: "/" },
    { id: "patients", labelKey: "navbar.patients", to: "/patients" },
    { id: "pendingQuestionnaires", labelKey: "navbar.pendingQuestionnaires", to: "/questionnaires/pending" },
    { id: "questionnaireSources", labelKey: "navbar.questionnaireSources", to: "/questionnaires/my" },
    { id: "auditLog", labelKey: "navbar.auditLog", to: "/audit-log" },
    { id: "profile", labelKey: "navbar.profile", to: "/profile" },
  ],
  admin: [
    { id: "dashboard", labelKey: "navbar.dashboard", to: "/" },
    { id: "patients", labelKey: "navbar.patients", to: "/patients" },
    { id: "questionnaires", labelKey: "navbar.questionnaires", to: "/questionnaires/my" },
    { id: "pendingQuestionnaires", labelKey: "navbar.pendingQuestionnaires", to: "/questionnaires/pending" },
    { id: "auditLog", labelKey: "navbar.auditLog", to: "/audit-log" },
    { id: "profile", labelKey: "navbar.profile", to: "/profile" },
  ],
};

function AppShell({ children }) {
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const role = user?.role || "doctor";
  const navItems = navByRole[role] || navByRole.doctor;

  const handleLanguageChange = (event) => {
    i18n.changeLanguage(event.target.value);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        display: "grid",
        gridTemplateColumns: { xs: "1fr", lg: "minmax(220px, 260px) 1fr" },
      }}
    >
      <Paper
        square
        elevation={0}
        sx={{
          borderRight: { lg: "1px solid" },
          borderColor: { lg: "divider" },
          bgcolor: "background.paper",
          p: 2.25,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          position: { lg: "sticky" },
          top: { lg: 0 },
          height: { lg: "100vh" },
          zIndex: 5,
          boxShadow: { lg: (theme) => `4px 0 24px ${theme.palette.mode === "light" ? "rgba(19, 36, 40, 0.06)" : "transparent"}` },
        }}
      >
        <Box className="mq-animate-fade-up">
          <LogoLockup variant="sidebar" caption="subtitle" to="/" />
        </Box>

        <Divider sx={{ borderColor: "divider" }} />

        <Stack spacing={0.5} component="nav" aria-label={t("navbar.mainNav")}>
          {navItems.map((item) => {
            const active =
              location.pathname === item.to ||
              (String(item.to).startsWith("/patients") && location.pathname.startsWith("/patients"));
            return (
              <Button
                key={item.id}
                component={Link}
                to={item.to}
                variant="text"
                color="inherit"
                aria-current={active ? "page" : undefined}
                sx={{
                  justifyContent: "flex-start",
                  py: 1.1,
                  px: 1.35,
                  fontWeight: 600,
                  color: "text.primary",
                  bgcolor: active ? "action.selected" : "transparent",
                  borderLeft: "3px solid",
                  borderLeftColor: active ? "primary.main" : "transparent",
                  borderRadius: 1.5,
                  transition: "background-color 0.15s ease, border-color 0.15s ease",
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                {t(item.labelKey)}
              </Button>
            );
          })}
        </Stack>

        <Divider sx={{ borderColor: "divider" }} />

        <Stack spacing={1}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            {t("navbar.language")}
          </Typography>
          <TextField select size="small" value={i18n.language} onChange={handleLanguageChange} fullWidth>
            <MenuItem value="en">EN</MenuItem>
            <MenuItem value="ru">RU</MenuItem>
            <MenuItem value="kk">KK</MenuItem>
          </TextField>
        </Stack>

        <Box sx={{ mt: "auto", pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.25, lineHeight: 1.45 }}>
            {t("navbar.workspaceFootnote")}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1, fontWeight: 600 }}>
            {t("navbar.doctorPrefix")} {user?.first_name || user?.username || t("profile.doctorFallback")}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
            {t("navbar.role")}: {role}
          </Typography>
          <Button variant="outlined" color="inherit" fullWidth onClick={logout} size="small">
            {t("navbar.logout")}
          </Button>
        </Box>
      </Paper>

      <Box className="mq-workspace-bg" sx={{ p: { xs: 2, md: 3 }, pb: { xs: 4, md: 5 }, minWidth: 0 }}>
        <Box sx={{ maxWidth: 1380, mx: "auto", width: "100%", position: "relative", zIndex: 1 }}>{children}</Box>
      </Box>
    </Box>
  );
}

export default AppShell;
