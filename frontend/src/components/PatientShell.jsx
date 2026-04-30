import { Box, Button, Divider, Paper, Stack, Typography } from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import LogoLockup from "./brand/LogoLockup";

const patientNav = [
  { id: "home", labelKey: "patientPortal.menu.home", to: "/patient" },
  { id: "labs", labelKey: "patientPortal.menu.labs", to: "/patient/labs" },
  { id: "questionnaires", labelKey: "patientPortal.menu.questionnaires", to: "/patient/questionnaires" },
  { id: "recommendations", labelKey: "patientPortal.menu.recommendations", to: "/patient/recommendations" },
  { id: "notifications", labelKey: "patientPortal.menu.notifications", to: "/patient/notifications" },
];

function PatientShell({ children }) {
  const location = useLocation();
  const { t } = useTranslation();
  const { user, logout } = useAuth();

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
        }}
      >
        <Box className="mq-animate-fade-up">
          <LogoLockup variant="sidebar" caption="subtitle" to="/patient" />
        </Box>
        <Divider />
        <Stack spacing={0.5} component="nav" aria-label={t("patientPortal.menu.nav")}>
          {patientNav.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Button
                key={item.id}
                component={Link}
                to={item.to}
                variant="text"
                color="inherit"
                sx={{
                  justifyContent: "flex-start",
                  py: 1.1,
                  px: 1.35,
                  fontWeight: 600,
                  bgcolor: active ? "action.selected" : "transparent",
                  borderLeft: "3px solid",
                  borderLeftColor: active ? "primary.main" : "transparent",
                  borderRadius: 1.5,
                }}
              >
                {t(item.labelKey)}
              </Button>
            );
          })}
        </Stack>
        <Box sx={{ mt: "auto", pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
            {t("patientPortal.welcome")}: {user?.first_name || user?.username}
          </Typography>
          <Button variant="outlined" color="inherit" fullWidth onClick={logout} size="small">
            {t("navbar.logout")}
          </Button>
        </Box>
      </Paper>
      <Box className="mq-workspace-bg" sx={{ p: { xs: 2, md: 3 }, pb: { xs: 4, md: 5 }, minWidth: 0 }}>
        <Box sx={{ maxWidth: 1180, mx: "auto", width: "100%" }}>{children}</Box>
      </Box>
    </Box>
  );
}

export default PatientShell;

