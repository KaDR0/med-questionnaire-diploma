import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ClearRoundedIcon from "@mui/icons-material/ClearRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";

import api from "../api/axios";
import useToast from "../utils/useToast";
import PageHeader from "../components/ui/PageHeader";
import DataTable from "../components/ui/DataTable";
import EmptyState from "../components/ui/EmptyState";

function pickTitle(item) {
  return item.title_ru || item.title_en || item.title || "—";
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function QuestionnaireArchivePage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .get("questionnaires/archived/")
      .then((response) => {
        if (cancelled) return;
        setItems(response.data || []);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err?.response?.data?.detail || t("archive.loadError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredItems = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return items;
    return items.filter((item) => {
      const title = pickTitle(item).toLowerCase();
      const area = (item.medical_area || "").toLowerCase();
      return title.includes(value) || area.includes(value);
    });
  }, [items, search]);

  const restoreQuestionnaire = async (id) => {
    try {
      await api.post(`questionnaires/${id}/restore/`);
      setItems((prev) => prev.filter((item) => item.id !== id));
      toast.success(t("archive.restoreSuccess"));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t("archive.restoreError"));
    }
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
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }} noWrap>
              {row.medical_area || t("archive.noArea")}
            </Typography>
          </Box>
        ),
        wrap: true,
      },
      {
        id: "archivedBy",
        label: t("archive.archivedBy"),
        accessor: (row) => row.archived_by_email || "",
        render: (row) => (
          <Typography variant="body2" color={row.archived_by_email ? "text.primary" : "text.secondary"}>
            {row.archived_by_email || t("archive.system")}
          </Typography>
        ),
        width: 230,
      },
      {
        id: "archivedAt",
        label: t("archive.archivedAt"),
        accessor: (row) => row.archived_at || "",
        render: (row) => (
          <Typography variant="body2" color="text.secondary">
            {formatDateTime(row.archived_at)}
          </Typography>
        ),
        width: 200,
      },
      {
        id: "actions",
        label: t("patients.actions"),
        sortable: false,
        align: "right",
        render: (row) => (
          <Tooltip title={t("archive.restore")}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<RestoreRoundedIcon />}
              onClick={(e) => {
                e.stopPropagation();
                restoreQuestionnaire(row.id);
              }}
            >
              {t("archive.restore")}
            </Button>
          </Tooltip>
        ),
        width: 160,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t]
  );

  const showEmpty = !loading && items.length === 0;
  const showEmptyFilter = !loading && items.length > 0 && filteredItems.length === 0;

  return (
    <Box>
      <PageHeader title={t("archive.title")} subtitle={t("archive.subtitle")} />

      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder={t("archive.searchPlaceholder")}
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

      {showEmpty ? (
        <EmptyState
          title={t("archive.empty")}
          description={t("archive.emptyDescription")}
          icon={
            <Box
              sx={{
                width: 96,
                height: 96,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: (theme) => theme.palette.action.hover,
                color: "text.secondary",
                mx: "auto",
              }}
              aria-hidden
            >
              <Inventory2RoundedIcon sx={{ fontSize: 42 }} />
            </Box>
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
              onClick={() => setSearch("")}
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
          ariaLabel={t("archive.title")}
          defaultSort={{ id: "archivedAt", direction: "desc" }}
        />
      )}
    </Box>
  );
}

export default QuestionnaireArchivePage;
