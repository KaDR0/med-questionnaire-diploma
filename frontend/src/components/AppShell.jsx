import { useEffect, useState } from "react";
import { Box, Drawer } from "@mui/material";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";

import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import AssignmentIndRoundedIcon from "@mui/icons-material/AssignmentIndRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import RuleRoundedIcon from "@mui/icons-material/RuleRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import HourglassEmptyRoundedIcon from "@mui/icons-material/HourglassEmptyRounded";

import SidebarNav, { SidebarFootnote } from "./ui/SidebarNav";
import TopBar from "./ui/TopBar";

const SIDEBAR_WIDTH = 264;

function buildNavGroups({ role, t }) {
  if (role === "pending") {
    return [
      {
        id: "account",
        label: t("navbar.groups.account"),
        items: [
          {
            id: "awaiting",
            label: t("navbar.awaitingApproval"),
            to: "/awaiting-approval",
            icon: <HourglassEmptyRoundedIcon />,
          },
          {
            id: "profile",
            label: t("navbar.profile"),
            to: "/profile",
            icon: <AssignmentIndRoundedIcon />,
          },
        ],
      },
    ];
  }

  if (role === "chief_doctor") {
    return [
      {
        id: "overview",
        label: t("navbar.groups.overview"),
        items: [
          {
            id: "dashboard",
            label: t("navbar.dashboard"),
            to: "/",
            icon: <DashboardRoundedIcon />,
          },
        ],
      },
      {
        id: "clinical",
        label: t("navbar.groups.clinical"),
        items: [
          {
            id: "patients",
            label: t("navbar.patients"),
            to: "/patients",
            icon: <PeopleAltRoundedIcon />,
            matchPaths: ["/patients/:id", "/patients/:id/*"],
          },
          {
            id: "questionnaireSources",
            label: t("navbar.questionnaireSources"),
            to: "/questionnaires/my",
            icon: <FactCheckRoundedIcon />,
            matchPaths: ["/questionnaires/create", "/questionnaires/:id/edit", "/questionnaires/:id"],
          },
        ],
      },
      {
        id: "admin",
        label: t("navbar.groups.admin"),
        items: [
          {
            id: "pendingQuestionnaires",
            label: t("navbar.pendingQuestionnaires"),
            to: "/questionnaires/pending",
            icon: <RuleRoundedIcon />,
            matchPaths: ["/questionnaires/review/:id"],
          },
          {
            id: "archive",
            label: t("navbar.archive"),
            to: "/questionnaires/archive",
            icon: <Inventory2RoundedIcon />,
          },
          {
            id: "userRoles",
            label: t("navbar.userRoles"),
            to: "/users/roles",
            icon: <GroupsRoundedIcon />,
          },
          {
            id: "auditLog",
            label: t("navbar.auditLog"),
            to: "/audit-log",
            icon: <HistoryRoundedIcon />,
          },
        ],
      },
      {
        id: "account",
        label: t("navbar.groups.account"),
        items: [
          {
            id: "profile",
            label: t("navbar.profile"),
            to: "/profile",
            icon: <AssignmentIndRoundedIcon />,
          },
        ],
      },
    ];
  }

  // doctor (default)
  return [
    {
      id: "overview",
      label: t("navbar.groups.overview"),
      items: [
        {
          id: "dashboard",
          label: t("navbar.dashboard"),
          to: "/",
          icon: <DashboardRoundedIcon />,
        },
      ],
    },
    {
      id: "clinical",
      label: t("navbar.groups.clinical"),
      items: [
        {
          id: "patients",
          label: t("navbar.patients"),
          to: "/patients",
          icon: <PeopleAltRoundedIcon />,
          matchPaths: ["/patients/:id", "/patients/:id/*"],
        },
        {
          id: "myQuestionnaires",
          label: t("navbar.myQuestionnaires"),
          to: "/questionnaires/my",
          icon: <FactCheckRoundedIcon />,
          matchPaths: ["/questionnaires/create", "/questionnaires/:id/edit", "/questionnaires/:id"],
        },
      ],
    },
    {
      id: "account",
      label: t("navbar.groups.account"),
      items: [
        {
          id: "profile",
          label: t("navbar.profile"),
          to: "/profile",
          icon: <AssignmentIndRoundedIcon />,
        },
      ],
    },
  ];
}

function roleLabelOf(role, t) {
  if (role === "chief_doctor") return `${t("navbar.role")}: ${t("navbar.role")} · Chief`;
  if (role === "doctor") return `${t("navbar.role")}: ${t("navbar.doctorPrefix")}`;
  if (role === "pending") return t("navbar.awaitingApproval");
  return role;
}

function AppShell({ children }) {
  const location = useLocation();
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const role = user?.role || "pending";
  const groups = buildNavGroups({ role, t });

  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile drawer whenever the route changes. Drawer state is local UI;
  // location is the external trigger, so a setState-in-effect pattern is correct here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [location.pathname]);

  const sidebar = (
    <SidebarNav
      groups={groups}
      homeTo={role === "pending" ? "/awaiting-approval" : "/"}
      footer={<SidebarFootnote>{t("navbar.workspaceFootnote")}</SidebarFootnote>}
    />
  );

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
          homeTo={role === "pending" ? "/awaiting-approval" : "/"}
          user={user}
          roleLabel={roleLabelOf(role, t)}
          profileTo="/profile"
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
          <Box sx={{ maxWidth: 1380, mx: "auto", width: "100%", position: "relative", zIndex: 1 }}>
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default AppShell;
