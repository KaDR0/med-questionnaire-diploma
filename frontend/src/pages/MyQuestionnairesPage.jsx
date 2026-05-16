import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ClearRoundedIcon from "@mui/icons-material/ClearRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";

import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import useToast from "../utils/useToast";
import PageHeader from "../components/ui/PageHeader";
import KpiCard from "../components/ui/KpiCard";
import DataTable from "../components/ui/DataTable";
import EmptyState from "../components/ui/EmptyState";

const STATUS_COLOR = {
  draft: "default",
  pending_approval: "warning",
  approved: "success",
  rejected: "error",
  changes_requested: "warning",
  archived: "default",
};

const STATUS_ORDER = [
  "all",
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "changes_requested",
  "archived",
];

function pickTitle(item) {
  return item.title_ru || item.title_en || item.title || "—";
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function MyQuestionnairesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const isChiefDoctor = user?.role === "chief_doctor";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = async () => {
    try {
      const response = await api.get("questionnaires/");
      setItems(response.data || []);
    } catch {
      toast.error(t("myQuestionnaires.loadError"));
    }
  };

  useEffect(() => {
    load()
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const total = items.length;
    const byStatus = items.reduce((acc, item) => {
      const key = item.approval_status || "draft";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return {
      total,
      draft: byStatus.draft || 0,
      pending: byStatus.pending_approval || 0,
      approved: byStatus.approved || 0,
      rejected: byStatus.rejected || 0,
      changes: byStatus.changes_requested || 0,
      archived: byStatus.archived || 0,
      byStatus,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const value = search.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== "all") {
        const itemStatus = item.approval_status || "draft";
        if (itemStatus !== statusFilter) return false;
      }
      if (!value) return true;
      const title = pickTitle(item).toLowerCase();
      const area = (item.medical_area || "").toLowerCase();
      const risk = (item.risk_target || "").toLowerCase();
      return title.includes(value) || area.includes(value) || risk.includes(value);
    });
  }, [items, search, statusFilter]);

  const submitForApproval = async (id) => {
    try {
      await api.post(`questionnaires/${id}/submit-for-approval/`);
      await load();
      toast.success(t("myQuestionnaires.submitSuccess"));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t("myQuestionnaires.submitError"));
    }
  };

  const deleteQuestionnaire = async (id) => {
    if (!window.confirm(t("myQuestionnaires.deleteConfirm"))) return;
    try {
      await api.delete(`questionnaires/${id}/`);
      await load();
      toast.success(t("myQuestionnaires.deleteSuccess"));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t("myQuestionnaires.deleteError"));
    }
  };

  const renderStatusChip = (status) => {
    const key = status || "draft";
    const color = STATUS_COLOR[key] || "default";
    return (
      <Chip
        size="small"
        variant="outlined"
        color={color}
        label={t(`myQuestionnaires.status.${key}`)}
        sx={{ borderRadius: 2, fontWeight: 600, borderWidth: 1.25 }}
      />
    );
  };

  const columns = useMemo(
    () => [
      {
        id: "title",
        label: t("myQuestionnaires.titleColumn"),
        accessor: (row) => pickTitle(row),
        render: (row) => (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.25 }} noWrap>
              {pickTitle(row)}
            </Typography>
            {row.description ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }} noWrap>
                {row.description}
              </Typography>
            ) : null}
          </Box>
        ),
        wrap: true,
      },
      {
        id: "area",
        label: t("myQuestionnaires.medicalArea"),
        accessor: (row) => row.medical_area || "",
        render: (row) => (
          <Typography variant="body2" color={row.medical_area ? "text.primary" : "text.secondary"}>
            {row.medical_area || t("myQuestionnaires.noArea")}
          </Typography>
        ),
        width: 200,
      },
      {
        id: "risk",
        label: t("myQuestionnaires.riskTarget"),
        accessor: (row) => row.risk_target || "",
        render: (row) =>
          row.risk_target ? (
            <Typography variant="body2">{row.risk_target}</Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              —
            </Typography>
          ),
        width: 180,
      },
      {
        id: "status",
        label: t("patients.statusLabel"),
        accessor: (row) => row.approval_status || "draft",
        render: (row) => renderStatusChip(row.approval_status),
        width: 170,
      },
      {
        id: "updated",
        label: t("myQuestionnaires.updated"),
        accessor: (row) => row.updated_at || row.created_at || "",
        render: (row) => (
          <Typography variant="body2" color="text.secondary">
            {formatDate(row.updated_at || row.created_at)}
          </Typography>
        ),
        width: 130,
      },
      {
        id: "actions",
        label: t("patients.actions"),
        sortable: false,
        align: "right",
        render: (row) => {
          const editable = ["draft", "rejected", "changes_requested"].includes(
            row.approval_status || "draft"
          );
          const submittable = editable;
          return (
            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
              <Tooltip title={t("myQuestionnaires.view")}>
                <IconButton
                  size="small"
                  component={Link}
                  to={`/questionnaires/${row.id}`}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={t("myQuestionnaires.view")}
                >
                  <OpenInNewRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {editable ? (
                <Tooltip title={t("myQuestionnaires.edit")}>
                  <IconButton
                    size="small"
                    component={Link}
                    to={`/questionnaires/${row.id}/edit`}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={t("myQuestionnaires.edit")}
                  >
                    <EditRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : null}
              {submittable ? (
                <Tooltip title={t("myQuestionnaires.submitForApproval")}>
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      submitForApproval(row.id);
                    }}
                    aria-label={t("myQuestionnaires.submitForApproval")}
                  >
                    <SendRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : null}
              {isChiefDoctor ? (
                <Tooltip title={t("myQuestionnaires.delete")}>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteQuestionnaire(row.id);
                    }}
                    aria-label={t("myQuestionnaires.delete")}
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : null}
            </Stack>
          );
        },
        width: 180,
      },
    ],
    // Action handlers close over `t`, `isChiefDoctor` and internal state setters;
    // we intentionally only depend on `t` and `isChiefDoctor` so that the columns
    // don't rebuild on every keystroke in the search box.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, isChiefDoctor]
  );

  const showEmptyAll = !loading && items.length === 0;
  const showEmptyFilter = !loading && items.length > 0 && filteredItems.length === 0;

  return (
    <Box>
      <PageHeader
        title={t("myQuestionnaires.title")}
        subtitle={t("myQuestionnaires.subtitle")}
        actions={
          <Button
            component={Link}
            to="/questionnaires/create"
            variant="contained"
            startIcon={<AddRoundedIcon />}
          >
            {t("myQuestionnaires.create")}
          </Button>
        }
      />

      <Box
        sx={{
          display: "grid",
          gap: 2.25,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
          mb: 3,
        }}
      >
        <KpiCard label={t("myQuestionnaires.kpiTotal")} value={counts.total} tone="primary" />
        <KpiCard label={t("myQuestionnaires.kpiDrafts")} value={counts.draft} tone="info" />
        <KpiCard
          label={t("myQuestionnaires.kpiPending")}
          value={counts.pending}
          tone={counts.pending > 0 ? "warning" : "info"}
          emphasised={counts.pending > 0}
        />
        <KpiCard label={t("myQuestionnaires.kpiApproved")} value={counts.approved} tone="success" />
      </Box>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        alignItems={{ xs: "stretch", md: "center" }}
        sx={{ mb: 2 }}
      >
        <Tabs
          value={statusFilter}
          onChange={(_e, val) => setStatusFilter(val)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            minHeight: 36,
            flex: 1,
            "& .MuiTab-root": { minHeight: 36, textTransform: "none", fontWeight: 600 },
          }}
        >
          {STATUS_ORDER.map((status) => {
            const count =
              status === "all" ? counts.total : counts.byStatus[status] || 0;
            const label =
              status === "all"
                ? t("myQuestionnaires.filterAll")
                : t(`myQuestionnaires.status.${status}`);
            return (
              <Tab
                key={status}
                value={status}
                label={
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <span>{label}</span>
                    <Chip
                      size="small"
                      label={count}
                      sx={{
                        height: 18,
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        "& .MuiChip-label": { px: 0.75 },
                      }}
                    />
                  </Stack>
                }
              />
            );
          })}
        </Tabs>

        <TextField
          size="small"
          placeholder={t("myQuestionnaires.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: { xs: "100%", md: 320 } }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearch("")} aria-label={t("patients.clearSearch")}>
                    <ClearRoundedIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
        />
      </Stack>

      {showEmptyAll ? (
        <EmptyState
          title={t("myQuestionnaires.empty")}
          description={t("myQuestionnaires.emptyDescription")}
          actions={
            <Button
              component={Link}
              to="/questionnaires/create"
              variant="contained"
              startIcon={<AddRoundedIcon />}
            >
              {t("myQuestionnaires.create")}
            </Button>
          }
        />
      ) : showEmptyFilter ? (
        <EmptyState
          title={t("myQuestionnaires.emptySearchTitle")}
          description={t("myQuestionnaires.emptySearchSubtitle")}
          actions={
            <Button
              variant="outlined"
              startIcon={<ClearRoundedIcon />}
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
              }}
            >
              {t("patients.clearSearch")}
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          rows={filteredItems}
          loading={loading}
          ariaLabel={t("myQuestionnaires.title")}
          onRowClick={(row) => navigate(`/questionnaires/${row.id}`)}
          defaultSort={{ id: "updated", direction: "desc" }}
        />
      )}
    </Box>
  );
}

export default MyQuestionnairesPage;
