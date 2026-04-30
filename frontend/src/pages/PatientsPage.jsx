import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { useTranslation } from "react-i18next";

import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Grid,
  Chip,
  TextField,
  InputAdornment,
  Stack,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Divider,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import PageHeader from "../components/ui/PageHeader";
import DashboardStatCard from "../components/ui/DashboardStatCard";
import SectionCard from "../components/ui/SectionCard";
import SearchFilterBar from "../components/ui/SearchFilterBar";
import StatusChip from "../components/ui/StatusChip";
import EmptyWorkspaceIllustration from "../components/ui/EmptyWorkspaceIllustration";

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

  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [importingLabs, setImportingLabs] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [labImportResult, setLabImportResult] = useState(null);
  const [feedback, setFeedback] = useState({
    open: false,
    severity: "success",
    message: "",
  });
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
      return name.includes(value) || code.includes(value);
    });
  }, [patients, search]);

  const getSexLabel = (sex) => {
    if (sex === 1) return t("patients.male");
    if (sex === 2) return t("patients.female");
    return t("common.noData");
  };

  const showFeedback = (message, severity = "success") => {
    setFeedback({ open: true, severity, message });
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
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setImportResult(response.data);
      await loadPatients();
      showFeedback(t("patients.importSuccess"));
    } catch (error) {
      console.error("Import patients error:", error);
      const message =
        error?.response?.data?.error || error?.message || t("patients.importError");
      showFeedback(message, "error");
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
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setLabImportResult(response.data);
      await loadPatients();
      showFeedback(t("patients.labImportSuccess"));
    } catch (error) {
      console.error("Import labs error:", error);
      const message =
        error?.response?.data?.error || error?.message || t("patients.labImportError");
      showFeedback(message, "error");
    } finally {
      setImportingLabs(false);
    }
  };

  const handleDownloadLabTemplate = async () => {
    try {
      const response = await api.get("labs/template/", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "lab_import_template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download template error:", error);
      showFeedback(t("patients.labTemplateError"), "error");
    }
  };

  const handleDownloadPatientTemplate = async () => {
    try {
      const response = await api.get("patients/template/", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "patient_import_template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download patient template error:", error);
      showFeedback(t("patients.patientTemplateError"), "error");
    }
  };

  const handleDeletePatient = async (patientId) => {
    const confirmed = window.confirm(t("detail.deletePatientConfirm"));
    if (!confirmed) return;

    try {
      await api.delete(`patients/${patientId}/delete/`);
      await loadPatients();
      showFeedback(t("detail.patientDeleted"));
    } catch (error) {
      console.error("Delete patient error:", error);
      showFeedback(t("detail.patientDeleteError"), "error");
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
      showFeedback(t("patients.createValidationError"), "error");
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
      showFeedback(t("patients.createSuccess"));
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
      showFeedback(message, "error");
    } finally {
      setCreatingPatient(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title={t("patients.dashboard")}
        subtitle={t("patients.dashboardText")}
        actions={
          <Stack spacing={1.5} sx={{ width: "100%" }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              useFlexGap
              sx={{ flexWrap: "wrap", justifyContent: { sm: "flex-end" } }}
            >
              <Button variant="contained" onClick={handleOpenAddDialog}>
                {t("patients.addPatient")}
              </Button>
              <Button variant="outlined" component="label" disabled={importing}>
                {importing ? t("patients.importing") : t("patients.importPatients")}
                <input type="file" hidden accept=".xlsx,.xlsm,.xltx,.xltm" onChange={handleImportFileChange} />
              </Button>
              <Button variant="outlined" component="label" disabled={importingLabs}>
                {importingLabs ? t("patients.labImporting") : t("patients.importLabs")}
                <input type="file" hidden accept=".xlsx,.xlsm,.xltx,.xltm" onChange={handleLabImportFileChange} />
              </Button>
            </Stack>
            <Divider sx={{ borderColor: "divider" }} />
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              useFlexGap
              sx={{ flexWrap: "wrap", justifyContent: { sm: "flex-end" } }}
            >
              <Button size="small" variant="text" onClick={handleDownloadPatientTemplate}>
                {t("patients.downloadPatientTemplate")}
              </Button>
              <Button size="small" variant="text" onClick={handleDownloadLabTemplate}>
                {t("patients.downloadLabTemplate")}
              </Button>
            </Stack>
          </Stack>
        }
      />

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <DashboardStatCard label={t("patients.totalRecords")} value={patients.length} accent="primary" />
        </Grid>
        <Grid item xs={12} md={4}>
          <DashboardStatCard label={t("patients.loaded")} value={filteredPatients.length} accent="info" />
        </Grid>
        <Grid item xs={12} md={4}>
          <DashboardStatCard label={t("patients.status")} value={t("patients.active")} accent="success" />
        </Grid>
      </Grid>

      <Alert
        severity="info"
        variant="outlined"
        sx={{
          mb: 3,
          borderRadius: 2,
          bgcolor: alpha(theme.palette.info.main, 0.06),
          borderColor: alpha(theme.palette.info.main, 0.22),
          "& .MuiAlert-message": { width: "100%" },
        }}
        className="mq-animate-fade-up-delay"
      >
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.75 }}>
          {t("patients.tipsTitle")}
        </Typography>
        <Stack spacing={0.65} sx={{ pl: 0.25 }}>
          <Typography variant="body2" color="text.secondary" sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
            <Box component="span" sx={{ color: "info.main", fontWeight: 800, mt: 0.15 }}>
              ·
            </Box>
            {t("patients.tip1")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
            <Box component="span" sx={{ color: "info.main", fontWeight: 800, mt: 0.15 }}>
              ·
            </Box>
            {t("patients.tip2")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
            <Box component="span" sx={{ color: "info.main", fontWeight: 800, mt: 0.15 }}>
              ·
            </Box>
            {t("patients.tip3")}
          </Typography>
        </Stack>
      </Alert>

      <Alert
        severity="success"
        variant="outlined"
        sx={{
          mb: 3,
          borderRadius: 2,
          bgcolor: alpha(theme.palette.success.main, 0.05),
          borderColor: alpha(theme.palette.success.main, 0.2),
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {`${t("patients.patientRecord")}: ${t("detail.overview")}, ${t("detail.labs")}, ${t("detail.assessments")}.`}
        </Typography>
      </Alert>

      <Box sx={{ mb: 3 }}>
        <SearchFilterBar>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            {t("patients.searchTitle")}
          </Typography>
          <TextField
            fullWidth
            placeholder={t("patients.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start">🔎</InputAdornment>,
            }}
          />
        </SearchFilterBar>
      </Box>

      {importResult ? (
        <SectionCard title={t("patients.importSummary")} contentSx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                {t("patients.importSummary")}
              </Typography>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
                <Chip label={`${t("patients.created")}: ${importResult.created || 0}`} color="success" />
                <Chip label={`${t("patients.skipped")}: ${importResult.skipped || 0}`} color="warning" />
                <Chip
                  label={`${t("patients.errorsCount")}: ${importResult.errors?.length || 0}`}
                  color={importResult.errors?.length ? "error" : "default"}
                />
              </Stack>

              {importResult.imported_patients?.length ? (
                <Box sx={{ mb: importResult.errors?.length ? 2 : 0 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {t("patients.importedPatients")}
                  </Typography>
                  <Stack spacing={1}>
                    {importResult.imported_patients.slice(0, 5).map((patient) => (
                      <Typography key={patient.id} variant="body2">
                        <strong>{patient.patient_code}</strong> - {patient.full_name}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              ) : null}

              {importResult.errors?.length ? (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  {importResult.errors.join(" ")}
                </Alert>
              ) : null}
        </SectionCard>
      ) : null}

      {labImportResult ? (
        <SectionCard title={t("patients.labImportSummary")} contentSx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                {t("patients.labImportSummary")}
              </Typography>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
                <Chip
                  label={`${t("patients.labResultsCreated")}: ${labImportResult.created_results || 0}`}
                  color="success"
                />
                <Chip
                  label={`${t("patients.labValuesCreated")}: ${labImportResult.created_values || 0}`}
                  color="info"
                />
                <Chip label={`${t("patients.skipped")}: ${labImportResult.skipped || 0}`} color="warning" />
              </Stack>
              {labImportResult.errors?.length ? (
                <Alert severity="warning">{labImportResult.errors.join(" ")}</Alert>
              ) : null}
        </SectionCard>
      ) : null}

      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          {t("patients.records")}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t("patients.browse")}
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
          <CircularProgress />
        </Box>
      ) : filteredPatients.length === 0 ? (
        <Card
          sx={{
            overflow: "hidden",
            background: `linear-gradient(165deg, ${alpha(theme.palette.primary.main, 0.07)} 0%, ${theme.palette.background.paper} 42%)`,
          }}
        >
          <CardContent sx={{ py: 5, px: { xs: 2, sm: 4 } }}>
            <EmptyWorkspaceIllustration />
            <Typography variant="h6" align="center" fontWeight={700} sx={{ mb: 1 }}>
              {patients.length === 0 ? t("patients.emptyTitle") : t("patients.emptySearchTitle")}
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ maxWidth: 420, mx: "auto", mb: 1.5 }}>
              {patients.length === 0 ? t("patients.emptySubtitle") : t("patients.emptySearchSubtitle")}
            </Typography>
            {patients.length === 0 ? (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ maxWidth: 440, mx: "auto" }}>
                {t("patients.emptyHintImport")}
              </Typography>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2.5}>
            {filteredPatients.map((patient) => (
              <Grid item xs={12} md={6} lg={4} key={patient.id}>
                <Card
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    transition: "border-color 0.18s ease, box-shadow 0.18s ease",
                    "&:hover": {
                      borderColor: alpha(theme.palette.primary.main, 0.35),
                      boxShadow: `0 10px 28px ${alpha(theme.palette.primary.main, 0.08)}`,
                    },
                  }}
                >
                  <CardContent
                    sx={{
                      p: 3,
                      display: "flex",
                      flexDirection: "column",
                      height: "100%",
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 2,
                        mb: 2,
                      }}
                    >
                      <Stack direction="row" spacing={1.75} sx={{ minWidth: 0, flex: 1 }} alignItems="flex-start">
                        <Box
                          sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 2,
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 800,
                            fontSize: "0.9rem",
                            letterSpacing: "0.02em",
                            color: "primary.dark",
                            bgcolor: alpha(theme.palette.primary.main, 0.14),
                            border: "1px solid",
                            borderColor: alpha(theme.palette.primary.main, 0.22),
                          }}
                          aria-hidden
                        >
                          {initialsFromFullName(patient.full_name)}
                        </Box>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography
                            variant="h6"
                            noWrap
                            title={patient.full_name}
                            sx={{
                              fontWeight: 700,
                              lineHeight: 1.2,
                              mb: 1,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              height: 34,
                            }}
                          >
                            {patient.full_name}
                          </Typography>

                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              lineHeight: 1.2,
                              height: 22,
                            }}
                          >
                            {t("patients.profileOverview")}
                          </Typography>
                        </Box>
                      </Stack>

                      <Chip
                        label={patient.patient_code || t("patients.noId")}
                        color="primary"
                        variant="outlined"
                        sx={{ flexShrink: 0 }}
                      />
                    </Box>

                    <Box
                      sx={{
                        display: "grid",
                        gap: 1.1,
                        flexGrow: 1,
                      }}
                    >
                      <Typography variant="body2">
                        <strong>{t("patients.age")}:</strong>{" "}
                        {patient.age ?? t("common.noData")}
                      </Typography>
                      <Typography variant="body2">
                        <strong>{t("patients.sex")}:</strong>{" "}
                        {getSexLabel(patient.sex)}
                      </Typography>
                      <Typography variant="body2">
                        <strong>{t("patients.statusLabel")}:</strong>{" "}
                        <StatusChip
                          label={patient.status_label || t(`detail.statusOptions.${patient.status}`)}
                          status={patient.status}
                        />
                      </Typography>
                      <Typography variant="body2">
                        <strong>{t("patients.nextVisitCard")}:</strong>{" "}
                        {patient.next_visit_date ? patient.next_visit_date : t("patients.nextVisitNone")}
                      </Typography>
                    </Box>

                    <Stack spacing={1} sx={{ mt: 2.5 }}>
                      <Button
                        component={Link}
                        to={`/patients/${patient.id}`}
                        variant="contained"
                        fullWidth
                        sx={{ borderRadius: 10, py: 1.15 }}
                      >
                        {t("patients.openProfile")}
                      </Button>
                      <Button
                        component={Link}
                        to={`/patients/${patient.id}/questionnaires`}
                        variant="outlined"
                        fullWidth
                        sx={{ borderRadius: 10 }}
                      >
                        {t("detail.openQuestionnaires")}
                      </Button>
                      <Button
                        color="error"
                        variant="text"
                        fullWidth
                        onClick={() => handleDeletePatient(patient.id)}
                      >
                        {t("detail.deletePatient")}
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
        </Grid>
      )}
      <Snackbar
        open={feedback.open}
        autoHideDuration={2500}
        onClose={() => setFeedback((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={feedback.severity}
          sx={{ width: "100%" }}
          onClose={() => setFeedback((prev) => ({ ...prev, open: false }))}
        >
          {feedback.message}
        </Alert>
      </Snackbar>

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
              InputLabelProps={{ shrink: true }}
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