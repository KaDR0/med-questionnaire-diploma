import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

import RuleRoundedIcon from "@mui/icons-material/RuleRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ClearRoundedIcon from "@mui/icons-material/ClearRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";

import api from "../api/axios";
import useToast from "../utils/useToast";
import PageHeader from "../components/ui/PageHeader";
import KpiCard from "../components/ui/KpiCard";
import DataTable from "../components/ui/DataTable";
import EmptyState from "../components/ui/EmptyState";

function pickTitle(item) {
  return item.title_ru || item.title_en || item.title || "—";
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function PendingQuestionnairesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .get("questionnaires/pending-approval/")
      .then((response) => {
        if (cancelled) return;
        setItems(response.data || []);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error(t("pendingQuestionnaires.loadError"));
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
      const source = (item.source_name || "").toLowerCase();
      const author = (item.created_by || "").toLowerCase();
      return title.includes(value) || source.includes(value) || author.includes(value);
    });
  }, [items, search]);

  const stats = useMemo(() => {
    if (!items.length) return { queue: 0, oldest: null, authors: 0 };
    const authorsSet = new Set(items.map((i) => i.created_by).filter(Boolean));
    const oldestDate = items.reduce((acc, item) => {
      const ts = item.updated_at || item.created_at;
      if (!ts) return acc;
      const d = new Date(ts).getTime();
      if (Number.isNaN(d)) return acc;
      return acc === null || d < acc ? d : acc;
    }, null);
    return {
      queue: items.length,
      oldest: oldestDate ? new Date(oldestDate) : null,
      authors: authorsSet.size,
    };
  }, [items]);

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
            {row.medical_area ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }} noWrap>
                {row.medical_area}
              </Typography>
            ) : null}
          </Box>
        ),
        wrap: true,
      },
      {
        id: "source",
        label: t("pendingQuestionnaires.source"),
        accessor: (row) => row.source_name || "",
        render: (row) => (
          <Typography
            variant="body2"
            color={row.source_name ? "text.primary" : "text.secondary"}
          >
            {row.source_name || t("pendingQuestionnaires.notSpecified")}
          </Typography>
        ),
        width: 220,
      },
      {
        id: "author",
        label: t("pendingQuestionnaires.author"),
        accessor: (row) => row.created_by || "",
        render: (row) => (
          <Typography variant="body2" color={row.created_by ? "text.primary" : "text.secondary"}>
            {row.created_by || "—"}
          </Typography>
        ),
        width: 200,
      },
      {
        id: "submitted",
        label: t("pendingQuestionnaires.submitted"),
        accessor: (row) => row.updated_at || row.created_at || "",
        render: (row) => (
          <Typography variant="body2" color="text.secondary">
            {formatDate(row.updated_at || row.created_at)}
          </Typography>
        ),
        width: 140,
      },
      {
        id: "actions",
        label: t("patients.actions"),
        sortable: false,
        align: "right",
        render: (row) => (
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Tooltip title={t("pendingQuestionnaires.review")}>
              <Button
                component={Link}
                to={`/questionnaires/review/${row.id}`}
                onClick={(e) => e.stopPropagation()}
                size="small"
                variant="contained"
                startIcon={<VisibilityRoundedIcon />}
              >
                {t("pendingQuestionnaires.review")}
              </Button>
            </Tooltip>
          </Stack>
        ),
        width: 170,
      },
    ],
    [t]
  );

  const showEmpty = !loading && items.length === 0;
  const showEmptyFilter = !loading && items.length > 0 && filteredItems.length === 0;

  return (
    <Box>
      <PageHeader
        title={t("pendingQuestionnaires.title")}
        subtitle={t("pendingQuestionnaires.subtitle")}
      />

      <Box
        sx={{
          display: "grid",
          gap: 2.25,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
          mb: 3,
        }}
      >
        <KpiCard
          label={t("pendingQuestionnaires.kpiQueue")}
          value={stats.queue}
          tone={stats.queue > 0 ? "warning" : "info"}
          icon={<RuleRoundedIcon />}
          emphasised={stats.queue > 0}
        />
        <KpiCard
          label={t("pendingQuestionnaires.kpiOldest")}
          value={stats.oldest ? stats.oldest.toLocaleDateString() : "—"}
          tone="info"
        />
        <KpiCard
          label={t("pendingQuestionnaires.kpiAuthors")}
          value={stats.authors}
          tone="primary"
        />
      </Box>

      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder={t("pendingQuestionnaires.searchPlaceholder")}
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
          title={t("pendingQuestionnaires.empty")}
          description={t("pendingQuestionnaires.emptyDescription")}
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
          ariaLabel={t("pendingQuestionnaires.title")}
          onRowClick={(row) => navigate(`/questionnaires/review/${row.id}`)}
          defaultSort={{ id: "submitted", direction: "asc" }}
        />
      )}
    </Box>
  );
}

export default PendingQuestionnairesPage;
