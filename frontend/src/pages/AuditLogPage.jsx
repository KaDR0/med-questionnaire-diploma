import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ClearRoundedIcon from "@mui/icons-material/ClearRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";

import api from "../api/axios";
import useToast from "../utils/useToast";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import { ListSkeleton } from "../components/ui/LoadingSkeleton";

const ACTION_MAP = {
  patient_created: { tone: "primary", labelKey: "dashboard.activityMap.patientCreated" },
  questionnaire_created: { tone: "primary", labelKey: "dashboard.activityMap.questionnaireCreated" },
  questionnaire_archived: { tone: "default", labelKey: "dashboard.activityMap.questionnaireArchived" },
  questionnaire_restored: { tone: "info", labelKey: "dashboard.activityMap.questionnaireRestored" },
  questionnaire_submitted_for_approval: {
    tone: "warning",
    labelKey: "dashboard.activityMap.questionnaireSubmitted",
  },
  questionnaire_approved: { tone: "success", labelKey: "dashboard.activityMap.questionnaireApproved" },
  questionnaire_rejected: { tone: "error", labelKey: "dashboard.activityMap.questionnaireRejected" },
  questionnaire_changes_requested: {
    tone: "warning",
    labelKey: "dashboard.activityMap.questionnaireChangesRequested",
  },
  questionnaire_session_created: { tone: "default", labelKey: "dashboard.activityMap.legacyAuditEntry" },
  assessment_submitted: { tone: "info", labelKey: "dashboard.activityMap.assessmentSubmitted" },
  public_questionnaire_completed: {
    tone: "default",
    labelKey: "dashboard.activityMap.legacyAuditEntry",
  },
};

function AuditLogPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const toast = useToast();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    api
      .get("audit-logs/")
      .then((response) => {
        if (cancelled) return;
        setItems(response.data || []);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err?.response?.data?.detail || t("auditLog.loadError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availableActions = useMemo(() => {
    const set = new Set();
    items.forEach((i) => set.add(String(i.action || "")));
    return Array.from(set).filter(Boolean).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    const value = search.trim().toLowerCase();
    return items.filter((item) => {
      if (actionFilter !== "all" && item.action !== actionFilter) return false;
      if (!value) return true;
      const actor = (item.user_email || "").toLowerCase();
      const action = (item.action || "").toLowerCase();
      return actor.includes(value) || action.includes(value);
    });
  }, [items, search, actionFilter]);

  const toMessage = (item) => {
    const objectId = item?.object_id ? ` #${item.object_id}` : "";
    const patientId = item?.details?.patient_id ? ` #${item.details.patient_id}` : "";
    const action = String(item?.action || "");
    const meta = ACTION_MAP[action];
    if (!meta) return t("dashboard.activityMap.defaultAction");
    return t(meta.labelKey, { id: objectId, patientId });
  };

  const toneFor = (action) => ACTION_MAP[action]?.tone || "default";

  return (
    <Box>
      <PageHeader title={t("auditLog.title")} subtitle={t("auditLog.subtitle")} />

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <TextField
          size="small"
          select
          label={t("auditLog.filterAll")}
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          sx={{ minWidth: { xs: "100%", md: 260 } }}
        >
          <MenuItem value="all">{t("auditLog.filterAll")}</MenuItem>
          {availableActions.map((action) => (
            <MenuItem key={action} value={action}>
              {action}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          fullWidth
          placeholder={t("auditLog.searchPlaceholder")}
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
      </Stack>

      <Card>
        <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
          {loading ? (
            <ListSkeleton rows={8} />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              dense
              title={t("auditLog.noData")}
              icon={
                <Box
                  sx={{
                    width: 72,
                    height: 72,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    color: "primary.dark",
                    mx: "auto",
                  }}
                  aria-hidden
                >
                  <HistoryRoundedIcon sx={{ fontSize: 32 }} />
                </Box>
              }
            />
          ) : (
            <Stack divider={<Divider />} spacing={0}>
              {filteredItems.map((item) => (
                <Stack
                  key={item.id}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={{ xs: 0.5, sm: 2 }}
                  alignItems={{ sm: "center" }}
                  justifyContent="space-between"
                  sx={{
                    py: 1.5,
                    "&:first-of-type": { pt: 0 },
                    "&:last-of-type": { pb: 0 },
                  }}
                >
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.25 }}>
                      {toMessage(item)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t("dashboard.activityBy", {
                        actor: item.user_email || t("dashboard.systemActor"),
                        time: item.created_at
                          ? new Date(item.created_at).toLocaleString()
                          : t("dashboard.timeUnknown"),
                      })}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={toneFor(item.action)}
                    label={item.action || "—"}
                    sx={{ alignSelf: { xs: "flex-start", sm: "center" }, fontWeight: 600 }}
                  />
                </Stack>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default AuditLogPage;
