import { useEffect, useState } from "react";
import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import PageHeader from "../components/ui/PageHeader";
import SectionCard from "../components/ui/SectionCard";
import api from "../api/axios";
import { useTranslation } from "react-i18next";

function UserRoleManagementPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingById, setSavingById] = useState({});
  const [feedback, setFeedback] = useState("");

  const loadUsers = async () => {
    setError("");
    const response = await api.get("users/roles/");
    setUsers(response.data || []);
  };

  useEffect(() => {
    loadUsers()
      .catch((err) => setError(err?.response?.data?.detail || t("roleManagement.loadError")))
      .finally(() => setLoading(false));
  }, [t]);

  const setUserRole = (id, role) =>
    setUsers((prev) => prev.map((item) => (item.id === id ? { ...item, role } : item)));

  const saveRole = async (user) => {
    try {
      setSavingById((prev) => ({ ...prev, [user.id]: true }));
      setFeedback("");
      await api.patch(`users/${user.id}/assign-role/`, { role: user.role });
      setFeedback(t("roleManagement.saveSuccess"));
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.detail || t("roleManagement.saveError"));
    } finally {
      setSavingById((prev) => ({ ...prev, [user.id]: false }));
    }
  };

  return (
    <Box sx={{ maxWidth: 980, mx: "auto" }}>
      <PageHeader title={t("roleManagement.title")} subtitle={t("roleManagement.subtitle")} />

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {feedback ? <Alert severity="success" sx={{ mb: 2 }}>{feedback}</Alert> : null}
      {loading ? <Alert severity="info">{t("common.loading")}</Alert> : null}

      <Stack spacing={1.5}>
        {users.map((user) => (
          <SectionCard key={user.id} contentSx={{ p: 2 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} justifyContent="space-between">
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.25 }}>{user.full_name}</Typography>
                <Typography variant="body2" color="text.secondary">{user.email || t("common.noData")}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("roleManagement.currentRole")}: {user.role}
                </Typography>
              </Box>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ width: { xs: "100%", md: "auto" } }}>
                <TextField
                  select
                  size="small"
                  label={t("roleManagement.newRole")}
                  value={user.role}
                  onChange={(e) => setUserRole(user.id, e.target.value)}
                  disabled={!!user.is_superuser}
                  sx={{ minWidth: 180 }}
                >
                  <MenuItem value="pending">{t("roleManagement.roles.pending")}</MenuItem>
                  <MenuItem value="patient">{t("roleManagement.roles.patient")}</MenuItem>
                  <MenuItem value="doctor">{t("roleManagement.roles.doctor")}</MenuItem>
                </TextField>
                <Button
                  variant="contained"
                  onClick={() => saveRole(user)}
                  disabled={!!savingById[user.id] || !!user.is_superuser}
                >
                  {t("roleManagement.save")}
                </Button>
              </Stack>
            </Stack>
          </SectionCard>
        ))}
      </Stack>
    </Box>
  );
}

export default UserRoleManagementPage;
