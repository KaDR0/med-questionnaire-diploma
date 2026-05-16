import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ClearRoundedIcon from "@mui/icons-material/ClearRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";

import api from "../api/axios";
import useToast from "../utils/useToast";
import PageHeader from "../components/ui/PageHeader";
import DataTable from "../components/ui/DataTable";
import EmptyState from "../components/ui/EmptyState";

const SELECTABLE_ROLES = ["pending", "patient", "doctor"];
const ROLE_TONE = {
  pending: "warning",
  patient: "info",
  doctor: "primary",
  chief_doctor: "success",
};

function initialsFromUser(user) {
  const full = (user.full_name || "").trim();
  const fromName = full
    ? full
        .split(/\s+/)
        .filter(Boolean)
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
    : "";
  if (fromName) return fromName.toUpperCase();
  const email = user.email || "";
  return (email[0] || "?").toUpperCase();
}

function UserRoleManagementPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingById, setSavingById] = useState({});
  const [search, setSearch] = useState("");

  const loadUsers = async () => {
    const response = await api.get("users/roles/");
    setUsers(response.data || []);
  };

  useEffect(() => {
    loadUsers()
      .catch((err) => toast.error(err?.response?.data?.detail || t("roleManagement.loadError")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredUsers = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return users;
    return users.filter((u) => {
      const name = (u.full_name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      return name.includes(value) || email.includes(value);
    });
  }, [users, search]);

  const setUserRole = (id, role) =>
    setUsers((prev) => prev.map((item) => (item.id === id ? { ...item, role } : item)));

  const saveRole = async (user) => {
    try {
      setSavingById((prev) => ({ ...prev, [user.id]: true }));
      await api.patch(`users/${user.id}/assign-role/`, { role: user.role });
      toast.success(t("roleManagement.saveSuccess"));
    } catch (err) {
      toast.error(
        err?.response?.data?.error ||
          err?.response?.data?.detail ||
          t("roleManagement.saveError")
      );
    } finally {
      setSavingById((prev) => ({ ...prev, [user.id]: false }));
    }
  };

  const lockReason = (user) => {
    if (user.is_superuser) return t("roleManagement.superuserLocked");
    if (user.role === "chief_doctor") return t("roleManagement.chiefLockedHint");
    return null;
  };

  const columns = useMemo(
    () => [
      {
        id: "user",
        label: t("roleManagement.user"),
        accessor: (row) => row.full_name || row.email || "",
        render: (row) => (
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
            <Avatar
              sx={{
                width: 36,
                height: 36,
                fontWeight: 700,
                fontSize: "0.8125rem",
                bgcolor: alpha(theme.palette.primary.main, 0.14),
                color: "primary.dark",
              }}
            >
              {initialsFromUser(row)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                  {row.full_name || t("common.noData")}
                </Typography>
                {row.is_superuser ? (
                  <Tooltip title={t("roleManagement.superuserLocked")}>
                    <LockRoundedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                  </Tooltip>
                ) : null}
              </Stack>
              <Typography variant="caption" color="text.secondary" noWrap>
                {row.email || t("common.noData")}
              </Typography>
            </Box>
          </Stack>
        ),
        wrap: true,
      },
      {
        id: "currentRole",
        label: t("roleManagement.currentRole"),
        accessor: (row) => row.role || "",
        render: (row) => (
          <Chip
            size="small"
            variant="outlined"
            color={ROLE_TONE[row.role] || "default"}
            label={t(`roleManagement.roles.${row.role}`, { defaultValue: row.role || "—" })}
            sx={{ fontWeight: 600 }}
          />
        ),
        width: 180,
      },
      {
        id: "newRole",
        label: t("roleManagement.newRole"),
        sortable: false,
        render: (row) => {
          const locked = Boolean(row.is_superuser) || row.role === "chief_doctor";
          if (locked) {
            return (
              <Tooltip title={lockReason(row) || ""}>
                <Stack direction="row" spacing={0.75} alignItems="center" color="text.secondary">
                  <LockRoundedIcon sx={{ fontSize: 16 }} />
                  <Typography variant="caption">
                    {row.is_superuser
                      ? t("roleManagement.superuserLocked")
                      : t("roleManagement.chiefLockedTitle")}
                  </Typography>
                </Stack>
              </Tooltip>
            );
          }
          return (
            <TextField
              select
              size="small"
              value={row.role}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setUserRole(row.id, e.target.value)}
              sx={{ minWidth: 180 }}
            >
              {SELECTABLE_ROLES.map((role) => (
                <MenuItem key={role} value={role}>
                  {t(`roleManagement.roles.${role}`)}
                </MenuItem>
              ))}
            </TextField>
          );
        },
        width: 220,
      },
      {
        id: "actions",
        label: t("patients.actions"),
        sortable: false,
        align: "right",
        render: (row) => {
          const locked = Boolean(row.is_superuser) || row.role === "chief_doctor";
          if (locked) return null;
          return (
            <Button
              size="small"
              variant="contained"
              disabled={!!savingById[row.id]}
              onClick={(e) => {
                e.stopPropagation();
                saveRole(row);
              }}
            >
              {savingById[row.id] ? t("detail.saving") : t("roleManagement.save")}
            </Button>
          );
        },
        width: 140,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, theme, savingById]
  );

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto" }}>
      <PageHeader title={t("roleManagement.title")} subtitle={t("roleManagement.subtitle")} />

      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder={t("roleManagement.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setSearch("")}
                    aria-label={t("patients.clearSearch")}
                  >
                    <ClearRoundedIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
        />
      </Box>

      {!loading && filteredUsers.length === 0 ? (
        <EmptyState
          title={t("myQuestionnaires.emptySearchTitle")}
          description={t("myQuestionnaires.emptySearchSubtitle")}
          actions={
            search ? (
              <Button
                variant="outlined"
                startIcon={<ClearRoundedIcon />}
                onClick={() => setSearch("")}
              >
                {t("patients.clearSearch")}
              </Button>
            ) : null
          }
        />
      ) : (
        <DataTable
          columns={columns}
          rows={filteredUsers}
          loading={loading}
          ariaLabel={t("roleManagement.title")}
          defaultSort={{ id: "user", direction: "asc" }}
        />
      )}
    </Box>
  );
}

export default UserRoleManagementPage;
