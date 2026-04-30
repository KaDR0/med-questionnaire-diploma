import { useEffect, useRef, useState } from "react";
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
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import api from "../api/axios";
import PageHeader from "../components/ui/PageHeader";
import SectionCard from "../components/ui/SectionCard";

function ProfilePage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const [photoDataUrl, setPhotoDataUrl] = useState(user?.photo_data_url || "");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [feedback, setFeedback] = useState({ open: false, severity: "success", message: "" });
  const [editOpen, setEditOpen] = useState(false);
  const defaultProfile = {
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    email: user?.email || "",
    specialty: t("profile.specialtyValue"),
    experience_years: "5+",
    department: t("profile.departmentValue"),
    workplace: t("profile.workplaceDefault"),
    work_direction: t("profile.directionDefault"),
    competencies: t("profile.competenciesDefault"),
    phone: "+7 (727) 000-00-00",
    schedule: t("profile.availabilityValue"),
    status: t("profile.available"),
    about: t("profile.aboutText"),
  };
  const [profile, setProfile] = useState(defaultProfile);
  const [editForm, setEditForm] = useState(defaultProfile);
  const initials = `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`.toUpperCase() || "DR";
  const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || user?.username || t("profile.doctorFallback");

  useEffect(() => {
    setPhotoDataUrl(user?.photo_data_url || "");
  }, [user?.photo_data_url]);

  useEffect(() => {
    let alive = true;
    api
      .get("auth/me/")
      .then((response) => {
        if (!alive) return;
        const payload = response.data || {};
        const next = {
          first_name: payload.first_name || defaultProfile.first_name,
          last_name: payload.last_name || defaultProfile.last_name,
          email: payload.email || defaultProfile.email,
          specialty: payload.specialty || defaultProfile.specialty,
          experience_years: payload.experience_years || defaultProfile.experience_years,
          department: payload.department || defaultProfile.department,
          workplace: payload.workplace || defaultProfile.workplace,
          work_direction: payload.work_direction || defaultProfile.work_direction,
          competencies: payload.competencies || defaultProfile.competencies,
          phone: payload.phone || defaultProfile.phone,
          schedule: payload.schedule || defaultProfile.schedule,
          status: payload.status || defaultProfile.status,
          about: payload.short_info || defaultProfile.about,
        };
        setProfile(next);
        setEditForm(next);
        setLoadingProfile(false);
      })
      .catch(() => {
        if (!alive) return;
        setProfile(defaultProfile);
        setEditForm(defaultProfile);
        setLoadingProfile(false);
      });
    return () => {
      alive = false;
    };
  }, [t]);

  const handleOpenPhotoPicker = () => fileInputRef.current?.click();

  const handlePhotoSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) return;
      try {
        setUploadingPhoto(true);
        await api.patch("auth/profile-photo/", { photo_data_url: dataUrl, user_id: user?.id });
        setPhotoDataUrl(dataUrl);
        setFeedback({ open: true, severity: "success", message: t("profile.photoUploadSuccess") });
      } catch (error) {
        console.error("Profile photo upload error:", error);
        const message = error?.response?.data?.error || t("profile.photoUploadError");
        setFeedback({ open: true, severity: "error", message });
      } finally {
        setUploadingPhoto(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = async () => {
    try {
      setUploadingPhoto(true);
      await api.patch("auth/profile-photo/", { photo_data_url: "", user_id: user?.id });
      setPhotoDataUrl("");
      setFeedback({ open: true, severity: "success", message: t("profile.photoRemoveSuccess") });
    } catch (error) {
      console.error("Profile photo remove error:", error);
      const message = error?.response?.data?.error || t("profile.photoRemoveError");
      setFeedback({ open: true, severity: "error", message });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const openEdit = () => {
    setEditForm(profile);
    setEditOpen(true);
  };

  const closeEdit = () => setEditOpen(false);

  const saveProfile = async () => {
    const normalized = {
      ...editForm,
      phone: String(editForm.phone || "").trim(),
      about: String(editForm.about || "").trim(),
    };
    try {
      setSavingProfile(true);
      const response = await api.patch("auth/profile/", {
        first_name: normalized.first_name,
        last_name: normalized.last_name,
        email: normalized.email,
        specialty: normalized.specialty,
        experience_years: normalized.experience_years,
        department: normalized.department,
        workplace: normalized.workplace,
        work_direction: normalized.work_direction,
        competencies: normalized.competencies,
        phone: normalized.phone,
        schedule: normalized.schedule,
        status: normalized.status,
        short_info: normalized.about,
      });
      const payload = response.data || {};
      const next = {
        first_name: payload.first_name || normalized.first_name,
        last_name: payload.last_name || normalized.last_name,
        email: payload.email || normalized.email,
        specialty: payload.specialty || normalized.specialty,
        experience_years: payload.experience_years || normalized.experience_years,
        department: payload.department || normalized.department,
        workplace: payload.workplace || normalized.workplace,
        work_direction: payload.work_direction || normalized.work_direction,
        competencies: payload.competencies || normalized.competencies,
        phone: payload.phone || normalized.phone,
        schedule: payload.schedule || normalized.schedule,
        status: payload.status || normalized.status,
        about: payload.short_info || normalized.about,
      };
      setProfile(next);
      setEditForm(next);
      setEditOpen(false);
      setFeedback({ open: true, severity: "success", message: t("profile.profileSaved") });
    } catch (error) {
      const message = error?.response?.data?.error || t("profile.profileSaveError");
      setFeedback({ open: true, severity: "error", message });
    } finally {
      setSavingProfile(false);
    }
  };

  const setField = (field, value) => setEditForm((prev) => ({ ...prev, [field]: value }));

  return (
    <Box sx={{ maxWidth: 980, mx: "auto" }}>
      <PageHeader title={t("profile.title")} subtitle={t("profile.subtitle")} />
      {loadingProfile ? <Alert severity="info" sx={{ mb: 2 }}>{t("common.loading")}</Alert> : null}

      <SectionCard contentSx={{ mb: 2.5, p: { xs: 2.25, md: 2.75 } }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2.25} justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar sx={{ width: 80, height: 80, bgcolor: "primary.main", fontWeight: 700, fontSize: 28 }}>
              {photoDataUrl ? (
                <Box component="img" src={photoDataUrl} alt={fullName} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                initials
              )}
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ mb: 0.25 }}>{fullName}</Typography>
              <Stack direction="row" spacing={0.8} useFlexGap sx={{ flexWrap: "wrap", mb: 0.8 }}>
                <Chip label={profile.specialty} size="small" color="primary" />
                <Chip label={t("profile.experienceYears", { years: profile.experience_years })} size="small" variant="outlined" />
                <Chip label={profile.department} size="small" variant="outlined" />
                <Chip label={profile.status} size="small" variant="outlined" />
              </Stack>
              <Typography variant="body2" color="text.secondary">{profile.workplace}</Typography>
            </Box>
          </Stack>
          <Stack direction={{ xs: "row", md: "column" }} spacing={1} sx={{ alignItems: { md: "flex-end" } }}>
            <Button size="small" variant="outlined" onClick={handleOpenPhotoPicker} disabled={uploadingPhoto}>
              {uploadingPhoto ? t("profile.uploadingPhoto") : t("profile.uploadPhoto")}
            </Button>
            <Button size="small" variant="contained" onClick={openEdit}>
              {t("profile.editProfile")}
            </Button>
            {photoDataUrl ? (
              <Button size="small" color="error" onClick={handleRemovePhoto} disabled={uploadingPhoto}>
                {t("profile.removePhoto")}
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </SectionCard>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handlePhotoSelected}
      />

      <SectionCard contentSx={{ p: { xs: 2.25, md: 2.75 } }}>
        <Stack spacing={1.25}>
          <Typography variant="body2"><strong>{t("profile.specialty")}:</strong> {profile.specialty}</Typography>
          <Typography variant="body2"><strong>{t("profile.experience")}:</strong> {t("profile.experienceYears", { years: profile.experience_years })}</Typography>
          <Typography variant="body2"><strong>{t("profile.department")}:</strong> {profile.department}</Typography>
          <Typography variant="body2"><strong>{t("profile.workplace")}:</strong> {profile.workplace}</Typography>
          <Typography variant="body2"><strong>{t("profile.email")}:</strong> {profile.email || "—"}</Typography>
          <Typography variant="body2"><strong>{t("profile.phone")}:</strong> {profile.phone || "—"}</Typography>
          <Typography variant="body2"><strong>{t("profile.schedule")}:</strong> {profile.schedule}</Typography>
          <Typography variant="body2"><strong>{t("profile.status")}:</strong> {profile.status}</Typography>
        </Stack>
      </SectionCard>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2.5} sx={{ mt: 2.5 }}>
        <SectionCard title={t("profile.aboutSection")} contentSx={{ p: { xs: 2.25, md: 2.5 }, minHeight: 170, flex: 1 }}>
          <Typography variant="body2" sx={{ lineHeight: 1.7 }}>{profile.about || "—"}</Typography>
        </SectionCard>
        <SectionCard title={t("profile.professionalInfoSection")} contentSx={{ p: { xs: 2.25, md: 2.5 }, minHeight: 170, flex: 1 }}>
          <Stack spacing={1}>
            <Typography variant="body2"><strong>{t("profile.specialization")}:</strong> {profile.specialty}</Typography>
            <Typography variant="body2"><strong>{t("profile.workDirection")}:</strong> {profile.work_direction || "—"}</Typography>
            <Typography variant="body2"><strong>{t("profile.competencies")}:</strong> {profile.competencies || "—"}</Typography>
          </Stack>
        </SectionCard>
      </Stack>

      <Dialog open={editOpen} onClose={closeEdit} fullWidth maxWidth="sm">
        <DialogTitle>{t("profile.editProfile")}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label={t("profile.firstName")}
                value={editForm.first_name}
                onChange={(e) => setField("first_name", e.target.value)}
                fullWidth
              />
              <TextField
                label={t("profile.lastName")}
                value={editForm.last_name}
                onChange={(e) => setField("last_name", e.target.value)}
                fullWidth
              />
            </Stack>
            <TextField
              label={t("profile.email")}
              value={editForm.email}
              onChange={(e) => setField("email", e.target.value)}
              fullWidth
            />
            <TextField
              select
              label={t("profile.specialty")}
              value={editForm.specialty}
              onChange={(e) => setField("specialty", e.target.value)}
            >
              <MenuItem value={t("profile.specialtyOptionTherapy")}>{t("profile.specialtyOptionTherapy")}</MenuItem>
              <MenuItem value={t("profile.specialtyOptionCardio")}>{t("profile.specialtyOptionCardio")}</MenuItem>
              <MenuItem value={t("profile.specialtyOptionEndo")}>{t("profile.specialtyOptionEndo")}</MenuItem>
            </TextField>
            <TextField
              label={t("profile.experience")}
              value={editForm.experience_years}
              onChange={(e) => setField("experience_years", e.target.value)}
            />
            <TextField
              select
              label={t("profile.department")}
              value={editForm.department}
              onChange={(e) => setField("department", e.target.value)}
            >
              <MenuItem value={t("profile.departmentOptionOutpatient")}>{t("profile.departmentOptionOutpatient")}</MenuItem>
              <MenuItem value={t("profile.departmentOptionPreventive")}>{t("profile.departmentOptionPreventive")}</MenuItem>
              <MenuItem value={t("profile.departmentOptionDiagnostics")}>{t("profile.departmentOptionDiagnostics")}</MenuItem>
            </TextField>
            <TextField
              label={t("profile.workplace")}
              value={editForm.workplace}
              onChange={(e) => setField("workplace", e.target.value)}
            />
            <TextField
              label={t("profile.phone")}
              value={editForm.phone}
              onChange={(e) => setField("phone", e.target.value)}
            />
            <TextField
              label={t("profile.schedule")}
              value={editForm.schedule}
              onChange={(e) => setField("schedule", e.target.value)}
            />
            <TextField
              select
              label={t("profile.status")}
              value={editForm.status}
              onChange={(e) => setField("status", e.target.value)}
            >
              <MenuItem value={t("profile.available")}>{t("profile.available")}</MenuItem>
              <MenuItem value={t("profile.statusBusy")}>{t("profile.statusBusy")}</MenuItem>
              <MenuItem value={t("profile.statusOnLeave")}>{t("profile.statusOnLeave")}</MenuItem>
            </TextField>
            <TextField
              label={t("profile.workDirection")}
              value={editForm.work_direction}
              onChange={(e) => setField("work_direction", e.target.value)}
            />
            <TextField
              label={t("profile.competencies")}
              value={editForm.competencies}
              onChange={(e) => setField("competencies", e.target.value)}
            />
            <TextField
              label={t("profile.shortInfo")}
              value={editForm.about}
              onChange={(e) => setField("about", e.target.value)}
              multiline
              minRows={3}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEdit} disabled={savingProfile}>{t("profile.cancelEdit")}</Button>
          <Button variant="contained" onClick={saveProfile} disabled={savingProfile}>
            {savingProfile ? t("detail.saving") : t("profile.saveProfile")}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={feedback.open}
        autoHideDuration={2800}
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
    </Box>
  );
}

export default ProfilePage;