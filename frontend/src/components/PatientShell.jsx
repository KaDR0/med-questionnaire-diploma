import { useEffect, useState } from "react";
import { Box, Drawer } from "@mui/material";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";

import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import ScienceRoundedIcon from "@mui/icons-material/ScienceRounded";
import AssignmentTurnedInRoundedIcon from "@mui/icons-material/AssignmentTurnedInRounded";
import MedicalServicesRoundedIcon from "@mui/icons-material/MedicalServicesRounded";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";

import SidebarNav from "./ui/SidebarNav";
import TopBar from "./ui/TopBar";

const SIDEBAR_WIDTH = 264;

function buildPatientNavGroups(t) {
  return [
    {
      id: "patient-area",
      label: t("navbar.groups.patientArea"),
      items: [
        {
          id: "home",
          label: t("patientPortal.menu.home"),
          to: "/patient",
          icon: <HomeRoundedIcon />,
        },
        {
          id: "questionnaires",
          label: t("patientPortal.menu.questionnaires"),
          to: "/patient/questionnaires",
          icon: <AssignmentTurnedInRoundedIcon />,
          matchPaths: ["/patient/questionnaires/:id/:questionnaireId"],
        },
        {
          id: "labs",
          label: t("patientPortal.menu.labs"),
          to: "/patient/labs",
          icon: <ScienceRoundedIcon />,
        },
        {
          id: "recommendations",
          label: t("patientPortal.menu.recommendations"),
          to: "/patient/recommendations",
          icon: <MedicalServicesRoundedIcon />,
        },
        {
          id: "notifications",
          label: t("patientPortal.menu.notifications"),
          to: "/patient/notifications",
          icon: <NotificationsRoundedIcon />,
        },
      ],
    },
  ];
}

function PatientShell({ children }) {
  const location = useLocation();
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const groups = buildPatientNavGroups(t);

  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile drawer whenever the route changes. Drawer state is local UI;
  // location is the external trigger, so a setState-in-effect pattern is correct here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [location.pathname]);

  const sidebar = <SidebarNav groups={groups} homeTo="/patient" />;

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", bgcolor: "background.default" }}>
      <Box
        component="aside"
        sx={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          display: { xs: "none", lg: "block" },
          position: "sticky",
          top: 0,
          height: "100vh",
          bgcolor: "background.paper",
          borderRight: "1px solid",
          borderColor: "divider",
        }}
      >
        {sidebar}
      </Box>

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", lg: "none" },
          "& .MuiDrawer-paper": { width: SIDEBAR_WIDTH, boxSizing: "border-box" },
        }}
      >
        {sidebar}
      </Drawer>

      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <TopBar
          homeTo="/patient"
          user={user}
          onLogout={logout}
          onToggleSidebar={() => setMobileOpen((v) => !v)}
        />
        <Box
          className="mq-workspace-bg"
          sx={{
            flex: 1,
            p: { xs: 2, md: 3 },
            pb: { xs: 4, md: 5 },
          }}
        >
          <Box sx={{ maxWidth: 1180, mx: "auto", width: "100%" }}>{children}</Box>
        </Box>
      </Box>
    </Box>
  );
}

export default PatientShell;
