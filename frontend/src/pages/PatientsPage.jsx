import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ClearRoundedIcon from "@mui/icons-material/ClearRounded";
import FileUploadRoundedIcon from "@mui/icons-material/FileUploadRounded";
import ScienceRoundedIcon from "@mui/icons-material/ScienceRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";

import api from "../api/axios";
import useToast from "../utils/useToast";
import PageHeader from "../components/ui/PageHeader";
import KpiCard from "../components/ui/KpiCard";
import DataTable from "../components/ui/DataTable";
import StatusChip from "../components/ui/StatusChip";
import EmptyState from "../components/ui/EmptyState";

function initialsFromFullName(name) {
  const s = String(name || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function PatientsPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const toast = useToast();

  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [importingLabs, setImportingLabs] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [labImportResult, setLabImportResult] = useState(null);

  const [importAnchor, setImportAnchor] = useState(null);
  const importMenuOpen = Boolean(importAnchor);

  const patientsFileRef = useRef(null);
  const labsFileRef = useRef(null);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [creatingPatient, setCreatingPatient] = useState(false);
  const [patientFieldErrors, setPatientFieldErrors] = useState({});
  const [newPatient, setNewPatient] = useState({
    patient_code: "",
    full_name: "",
    email: "",
    age: "",
    sex: "",
    height_cm: "",
    weight_kg: "",
    next_visit_date: "",
  });

  const loadPatients = async () => {
    const response = await api.get("patients/");
    setPatients(response.data);
  };

  useEffect(() => {
    loadPatients()
      .catch((error) => {
        console.error("Error loading patients:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const filteredPatients = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return patients;
    return patients.filter((patient) => {
      const name = patient.full_name?.toLowerCase() || "";
      const code = patient.patient_code?.toLowerCase() || "";
      const email = patient.email?.toLowerCase() || "";
      return name.includes(value) || code.includes(value) || email.includes(value);
    });
  }, [patients, search]);

  const highRiskCount = useMemo(
    () =>
      patients.filter((p) => p.status === "attention" || p.status === "critical").length,
    [patients]
  );

  const getSexLabel = (sex) => {
    if (sex === 1) return t("patients.male");
    if (sex === 2) return t("patients.female");
    return t("common.noData");
  };

  const handleImportPatientsClick = () => {
    setImportAnchor(null);
    patientsFileRef.current?.click();
  };

  const handleImportLabsClick = () => {
    setImportAnchor(null);
    labsFileRef.current?.click();
  };

  const handleImportFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setImporting(true);
      setImportResult(null);
      const formData = new FormData();
      formData.append("file", file);
      const response = await api.post("patients/import/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImportResult(response.data);
      await loadPatients();
      toast.success(t("patients.importSuccess"));
    } catch (error) {
      console.error("Import patients error:", error);
      const message =
        error?.response?.data?.error || error?.message || t("patients.importError");
      toast.error(message);
    } finally {
      setImporting(false);
    }
  };

  const handleLabImportFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setImportingLabs(true);
      setLabImportResult(null);
      const formData = new FormData();
      formData.append("file", file);
      const response = await api.post("labs/import/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setLabImportResult(response.data);
      await loadPatients();
      toast.success(t("patients.labImportSuccess"));
    } catch (error) {
      console.error("Import labs error:", error);
      const message =
        error?.response?.data?.error || error?.message || t("patients.labImportError");
      toast.error(message);
    } finally {
      setImportingLabs(false);
    }
  };

  const downloadBlob = (data, filename) => {
    const url = window.URL.createObjectURL(new Blob([data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadLabTemplate = async () => {
    setImportAnchor(null);
    try {
      const response = await api.get("labs/template/", { responseType: "blob" });
      downloadBlob(response.data, "lab_import_template.xlsx");
    } catch (error) {
      console.error("Download template error:", error);
      toast.error(t("patients.labTemplateError"));
    }
  };

  const handleDownloadPatientTemplate = async () => {
    setImportAnchor(null);
    try {
      const response = await api.get("patients/template/", { responseType: "blob" });
      downloadBlob(response.data, "patient_import_template.xlsx");
    } catch (error) {
      console.error("Download patient template error:", error);
      toast.error(t("patients.patientTemplateError"));
    }
  };

  const handleDeletePatient = async (patientId, event) => {
    event?.stopPropagation?.();
    const confirmed = window.confirm(t("detail.deletePatientConfirm"));
    if (!confirmed) return;
    try {
      await api.delete(`patients/${patientId}/delete/`);
      await loadPatients();
      toast.success(t("detail.patientDeleted"));
    } catch (error) {
      console.error("Delete patient error:", error);
      toast.error(t("detail.patientDeleteError"));
    }
  };

  const resetNewPatientForm = () => {
    setNewPatient({
      patient_code: "",
      full_name: "",
      email: "",
      age: "",
      sex: "",
      height_cm: "",
      weight_kg: "",
      next_visit_date: "",
    });
    setPatientFieldErrors({});
  };

  const handleOpenAddDialog = () => setAddDialogOpen(true);
  const handleCloseAddDialog = () => {
    if (creatingPatient) return;
    setAddDialogOpen(false);
    resetNewPatientForm();
  };

  const handleNewPatientFieldChange = (field, value) => {
    setNewPatient((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreatePatient = async () => {
    if (!newPatient.full_name.trim()) {
      toast.error(t("patients.createValidationError"));
      return;
    }
    try {
      setCreatingPatient(true);
      setPatientFieldErrors({});
      const payload = {
        patient_code: newPatient.patient_code.trim() || null,
        full_name: newPatient.full_name.trim(),
        email: newPatient.email.trim() || null,
        age: newPatient.age === "" ? null : Number(newPatient.age),
        sex: newPatient.sex === "" ? null : Number(newPatient.sex),
        height_cm: newPatient.height_cm === "" ? null : Number(newPatient.height_cm),
        weight_kg: newPatient.weight_kg === "" ? null : Number(newPatient.weight_kg),
        next_visit_date: newPatient.next_visit_date || null,
        data: {},
      };
      await api.post("patients/", payload);
      await loadPatients();
      toast.success(t("patients.createSuccess"));
      setAddDialogOpen(false);
      resetNewPatientForm();
    } catch (error) {
      console.error("Create patient error:", error);
      const fieldErrors = error?.response?.data || {};
      setPatientFieldErrors(fieldErrors);
      const message =
        fieldErrors?.patient_code?.[0] ||
        error?.response?.data?.full_name?.[0] ||
        error?.response?.data?.detail ||
        t("patients.createError");
      toast.error(message);
    } finally {
      setCreatingPatient(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        id: "patient",
        label: t("patients.fullName"),
        accessor: (row) => row.full_name || "",
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
              {initialsFromFullName(row.full_name)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>
                {row.full_name || t("patients.noId")}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {row.patient_code ? `#${row.patient_code}` : t("patients.noId")}
                {row.email ? ` · ${row.email}` : ""}
              </Typography>
            </Box>
          </Stack>
        ),
        wrap: true,
      },
      {
        id: "age",
        label: t("patients.age"),
        accessor: (row) => (row.age == null ? null : Number(row.age)),
        render: (row) => row.age ?? t("common.noData"),
        width: 90,
      },
      {
        id: "sex",
        label: t("patients.sex"),
        accessor: (row) => row.sex,
        render: (row) => getSexLabel(row.sex),
        width: 110,
      },
      {
        id: "status",
        label: t("patients.statusLabel"),
        accessor: (row) => row.status || "",
        render: (row) =>
          row.status ? (
            <StatusChip
              label={row.status_label || t(`detail.statusOptions.${row.status}`)}
              status={row.status}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              {t("common.noData")}
            </Typography>
          ),
        width: 160,
      },
      {
        id: "next",
        label: t("patients.nextVisitCard"),
        accessor: (row) => row.next_visit_date || "",
        render: (row) =>
          row.next_visit_date ? (
            <Typography variant="body2">{row.next_visit_date}</Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {t("patients.nextVisitNone")}
            </Typography>
          ),
        width: 150,
      },
      {
        id: "actions",
        label: t("patients.actions"),
        sortable: false,
        align: "right",
        render: (row) => (
          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            <Tooltip title={t("patients.openProfile")}>
              <IconButton
                size="small"
                component={Link}
                to={`/patients/${row.id}`}
                onClick={(e) => e.stopPropagation()}
                aria-label={t("patients.openProfile")}
              >
                <OpenInNewRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t("detail.deletePatient")}>
              <IconButton
                size="small"
                color="error"
                onClick={(e) => handleDeletePatient(row.id, e)}
                aria-label={t("detail.deletePatient")}
              >
                <DeleteOutlineRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        ),
        width: 140,
      },
    ],
    // getSexLabel and handleDeletePatient close over `t`/component state but are
    // referentially unstable on every render; including them would needlessly
    // rebuild the column descriptors on every keystroke in the search box.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, theme]
  );

  return (
    <Box>
      <PageHeader
        title={t("patients.dashboard")}
        subtitle={t("patients.dashboardText")}
        actions={
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            useFlexGap
            sx={{ flexWrap: "wrap", justifyContent: { sm: "flex-end" } }}
          >
            <Button
              variant="contained"
              startIcon={<AddRoundedIcon />}
              onClick={handleOpenAddDialog}
            >
              {t("patients.addPatient")}
            </Button>
            <Button
              variant="outlined"
              startIcon={<CloudUploadRoundedIcon />}
              endIcon={
                <Box
                  component="span"
                  sx={{ display: "inline-flex", "& svg": { fontSize: 18 } }}
                  aria-hidden
                >
                  <DownloadRoundedIcon fontSize="inherit" />
                </Box>
              }
              onClick={(e) => setImportAnchor(e.currentTarget)}
              aria-controls={importMenuOpen ? "import-menu" : undefined}
              aria-haspopup="true"
              aria-expanded={importMenuOpen ? "true" : undefined}
              disabled={importing || importingLabs}
            >
              {t("patients.importMenu")}
            </Button>
            <Menu
              id="import-menu"
              anchorEl={importAnchor}
              open={importMenuOpen}
              onClose={() => setImportAnchor(null)}
              slotProps={{ paper: { sx: { mt: 1, minWidth: 280 } } }}
            >
              <MenuItem onClick={handleImportPatientsClick} disabled={importing}>
                <ListItemIcon>
                  <FileUploadRoundedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={importing ? t("patients.importing") : t("patients.importPatients")}
                />
              </MenuItem>
              <MenuItem onClick={handleImportLabsClick} disabled={importingLabs}>
                <ListItemIcon>
                  <ScienceRoundedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={importingLabs ? t("patients.labImporting") : t("patients.importLabs")}
                />
              </MenuItem>
              <MenuItem onClick={handleDownloadPatientTemplate}>
                <ListItemIcon>
                  <DescriptionRoundedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={t("patients.downloadPatientTemplate")} />
              </MenuItem>
              <MenuItem onClick={handleDownloadLabTemplate}>
                <ListItemIcon>
                  <DescriptionRoundedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={t("patients.downloadLabTemplate")} />
              </MenuItem>
            </Menu>
          </Stack>
        }
      />

      {/* hidden file inputs triggered programmatically from the Menu items above */}
      <input
        ref={patientsFileRef}
        type="file"
        hidden
        accept=".xlsx,.xlsm,.xltx,.xltm"
        onChange={handleImportFileChange}
      />
      <input
        ref={labsFileRef}
        type="file"
        hidden
        accept=".xlsx,.xlsm,.xltx,.xltm"
        onChange={handleLabImportFileChange}
      />

      <Box sx={{ display: "grid", gap: 2.25, gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, mb: 3 }}>
        <KpiCard
          label={t("patients.totalRecords")}
          value={patients.length}
          tone="primary"
        />
        <KpiCard
          label={t("patients.statusLabel")}
          value={highRiskCount}
          tone={highRiskCount > 0 ? "warning" : "success"}
          hint={
            highRiskCount > 0
              ? t("dashboard.attentionNeeded")
              : t("dashboard.allStable")
          }
        />
        <KpiCard
          label={t("patients.loaded")}
          value={filteredPatients.length}
          tone="info"
          hint={
            search
              ? t("patients.filteredCount", {
                  filtered: filteredPatients.length,
                  total: patients.length,
                })
              : t("patients.totalCount", { count: patients.length })
          }
        />
      </Box>

      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          placeholder={t("patients.searchPlaceholder")}
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
                  <Tooltip title={t("patients.clearSearch")}>
                    <IconButton
                      size="small"
                      onClick={() => setSearch("")}
                      aria-label={t("patients.clearSearch")}
                    >
                      <ClearRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ) : null,
            },
          }}
        />
      </Box>

      {importResult ? (
        <Alert
          severity={importResult.errors?.length ? "warning" : "success"}
          onClose={() => setImportResult(null)}
          sx={{ mb: 2 }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            {t("patients.importSummary")}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            <Chip
              size="small"
              label={`${t("patients.created")}: ${importResult.created || 0}`}
              color="success"
              variant="outlined"
            />
            <Chip
              size="small"
              label={`${t("patients.skipped")}: ${importResult.skipped || 0}`}
              color="warning"
              variant="outlined"
            />
            {importResult.errors?.length ? (
              <Chip
                size="small"
                label={`${t("patients.errorsCount")}: ${importResult.errors.length}`}
                color="error"
                variant="outlined"
              />
            ) : null}
          </Stack>
          {importResult.errors?.length ? (
            <Typography variant="body2" sx={{ mt: 1 }}>
              {importResult.errors.join(" ")}
            </Typography>
          ) : null}
        </Alert>
      ) : null}

      {labImportResult ? (
        <Alert
          severity={labImportResult.errors?.length ? "warning" : "success"}
          onClose={() => setLabImportResult(null)}
          sx={{ mb: 2 }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            {t("patients.labImportSummary")}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            <Chip
              size="small"
              label={`${t("patients.labResultsCreated")}: ${labImportResult.created_results || 0}`}
              color="success"
              variant="outlined"
            />
            <Chip
              size="small"
              label={`${t("patients.labValuesCreated")}: ${labImportResult.created_values || 0}`}
              color="info"
              variant="outlined"
            />
            <Chip
              size="small"
              label={`${t("patients.skipped")}: ${labImportResult.skipped || 0}`}
              color="warning"
              variant="outlined"
            />
          </Stack>
          {labImportResult.errors?.length ? (
            <Typography variant="body2" sx={{ mt: 1 }}>
              {labImportResult.errors.join(" ")}
            </Typography>
          ) : null}
        </Alert>
      ) : null}

      {!loading && filteredPatients.length === 0 ? (
        <EmptyState
          title={
            patients.length === 0
              ? t("patients.emptyTitle")
              : t("patients.emptySearchTitle")
          }
          description={
            patients.length === 0
              ? t("patients.emptySubtitle")
              : t("patients.emptySearchSubtitle")
          }
          actions={
            patients.length === 0 ? (
              <Button
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={handleOpenAddDialog}
              >
                {t("patients.addPatient")}
              </Button>
            ) : (
              <Button
                variant="outlined"
                startIcon={<ClearRoundedIcon />}
                onClick={() => setSearch("")}
              >
                {t("patients.clearSearch")}
              </Button>
            )
          }
        />
      ) : (
        <DataTable
          columns={columns}
          rows={filteredPatients}
          loading={loading}
          ariaLabel={t("patients.records")}
          onRowClick={(row) => navigate(`/patients/${row.id}`)}
          defaultSort={{ id: "patient", direction: "asc" }}
        />
      )}

      <Dialog open={addDialogOpen} onClose={handleCloseAddDialog} fullWidth maxWidth="sm">
        <DialogTitle>{t("patients.addPatient")}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label={t("patients.patientCode")}
              value={newPatient.patient_code}
              onChange={(e) => handleNewPatientFieldChange("patient_code", e.target.value)}
              helperText={patientFieldErrors?.patient_code?.[0] || t("patients.patientCodeHint")}
              error={Boolean(patientFieldErrors?.patient_code?.length)}
            />
            <TextField
              label={t("patients.fullName")}
              value={newPatient.full_name}
              onChange={(e) => handleNewPatientFieldChange("full_name", e.target.value)}
              required
            />
            <TextField
              label={t("patients.email")}
              type="email"
              value={newPatient.email}
              onChange={(e) => handleNewPatientFieldChange("email", e.target.value)}
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                type="number"
                label={t("patients.age")}
                fullWidth
                value={newPatient.age}
                onChange={(e) => handleNewPatientFieldChange("age", e.target.value)}
              />
              <TextField
                select
                label={t("patients.sex")}
                fullWidth
                value={newPatient.sex}
                onChange={(e) => handleNewPatientFieldChange("sex", e.target.value)}
              >
                <MenuItem value="">{t("common.noData")}</MenuItem>
                <MenuItem value="1">{t("patients.male")}</MenuItem>
                <MenuItem value="2">{t("patients.female")}</MenuItem>
              </TextField>
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                type="number"
                label={t("patients.height")}
                fullWidth
                value={newPatient.height_cm}
                onChange={(e) => handleNewPatientFieldChange("height_cm", e.target.value)}
              />
              <TextField
                type="number"
                label={t("patients.weight")}
                fullWidth
                value={newPatient.weight_kg}
                onChange={(e) => handleNewPatientFieldChange("weight_kg", e.target.value)}
              />
            </Stack>
            <TextField
              label={t("detail.nextVisit")}
              type="date"
              fullWidth
              value={newPatient.next_visit_date}
              onChange={(e) => handleNewPatientFieldChange("next_visit_date", e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddDialog} disabled={creatingPatient}>
            {t("detail.cancelEdit")}
          </Button>
          <Button variant="contained" onClick={handleCreatePatient} disabled={creatingPatient}>
            {creatingPatient ? t("detail.saving") : t("patients.createPatient")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default PatientsPage;
