import { useEffect, useRef, useState } from "react";
import { Alert, Avatar, Box, Button, Chip, Divider, Grid, Snackbar, Stack, Typography } from "@mui/material";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import api from "../api/axios";
import PageHeader from "../components/ui/PageHeader";
import DashboardStatCard from "../components/ui/DashboardStatCard";
import SectionCard from "../components/ui/SectionCard";

function ProfilePage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const [photoDataUrl, setPhotoDataUrl] = useState(user?.photo_data_url || "");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [feedback, setFeedback] = useState({ open: false, severity: "success", message: "" });
  const initials = `${user?.first_name?.[0] || ""}${user?.last_name?.[0] || ""}`.toUpperCase() || "DR";
  const fullName = `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || user?.username || t("profile.doctorFallback");
  const profile = {
    credentials: t("profile.credentials"),
    specialty: t("profile.specialtyValue"),
    subspecialty: t("profile.subspecialtyValue"),
    department: t("profile.departmentValue"),
    clinic: t("profile.clinicValue"),
    location: t("profile.locationValue"),
    languages: [t("profile.languageEnglish"), t("profile.languageRussian"), t("profile.languageKazakh")],
    experienceYears: "12+",
    availability: t("profile.availabilityValue"),
    about: t("profile.aboutText"),
    expertise: [
      t("profile.expertise1"),
      t("profile.expertise2"),
      t("profile.expertise3"),
      t("profile.expertise4"),
      t("profile.expertise5"),
    ],
    conditions: [
      t("profile.condition1"),
      t("profile.condition2"),
      t("profile.condition3"),
      t("profile.condition4"),
      t("profile.condition5"),
    ],
    procedures: [
      t("profile.procedure1"),
      t("profile.procedure2"),
      t("profile.procedure3"),
      t("profile.procedure4"),
    ],
    education: [
      t("profile.education1"),
      t("profile.education2"),
      t("profile.education3"),
    ],
    certifications: [
      t("profile.certification1"),
      t("profile.certification2"),
      t("profile.certification3"),
    ],
    practiceInfo: [
      t("profile.practiceInfo1"),
      t("profile.practiceInfo2"),
      t("profile.practiceInfo3"),
      t("profile.practiceInfo4"),
    ],
    research: [
      t("profile.research1"),
      t("profile.research2"),
      t("profile.research3"),
    ],
  };

  useEffect(() => {
    setPhotoDataUrl(user?.photo_data_url || "");
  }, [user?.photo_data_url]);

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

  return (
    <Box sx={{ maxWidth: 1240, mx: "auto" }}>
      <PageHeader title={t("profile.title")} subtitle={t("profile.subtitle")} />

      <SectionCard contentSx={{ mb: 3, p: { xs: 2.5, md: 3 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          spacing={2}
        >
          <Stack direction="row" spacing={2.25} alignItems="center">
            <Avatar sx={{ width: 88, height: 88, bgcolor: "primary.main", fontWeight: 700, fontSize: 30 }}>
              {photoDataUrl ? (
                <Box component="img" src={photoDataUrl} alt={fullName} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                initials
              )}
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ mb: 0.25 }}>
                {fullName}
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 0.75 }}>
                {profile.credentials}
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 1 }}>
                <Chip label={profile.specialty} size="small" color="primary" />
                <Chip label={profile.department} size="small" variant="outlined" />
                <Chip label={t("profile.acceptingPatients")} size="small" sx={{ bgcolor: "success.light", color: "success.dark" }} />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {profile.clinic} - {profile.location}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
                <Button size="small" variant="outlined" onClick={handleOpenPhotoPicker} disabled={uploadingPhoto}>
                  {uploadingPhoto ? t("profile.uploadingPhoto") : t("profile.uploadPhoto")}
                </Button>
                {photoDataUrl ? (
                  <Button size="small" color="error" onClick={handleRemovePhoto} disabled={uploadingPhoto}>
                    {t("profile.removePhoto")}
                  </Button>
                ) : null}
              </Stack>
            </Box>
          </Stack>
          <Box sx={{ textAlign: { xs: "left", md: "right" } }}>
            <Typography variant="body2" color="text.secondary">
              {t("profile.email")}
            </Typography>
            <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{user?.email || "—"}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t("profile.schedule")}
            </Typography>
            <Typography sx={{ fontWeight: 600, mb: 1.25 }}>{profile.availability}</Typography>
            <Button variant="contained" size="small">
              {t("profile.viewSchedule")}
            </Button>
          </Box>
        </Stack>
      </SectionCard>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handlePhotoSelected}
      />

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <DashboardStatCard label={t("profile.specialty")} value={profile.specialty} />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <DashboardStatCard label={t("profile.department")} value={t("profile.preventiveCare")} />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <DashboardStatCard
            label={t("profile.experience")}
            value={t("profile.experienceYears", { years: profile.experienceYears })}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <DashboardStatCard label={t("profile.languages")} value={profile.languages.length} />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <DashboardStatCard label={t("profile.primaryLocation")} value={t("profile.mainCampus")} />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <DashboardStatCard label={t("profile.status")} value={t("profile.available")} />
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={8}>
          <SectionCard title={t("profile.professionalSummary")}>
            <Typography sx={{ lineHeight: 1.75 }}>{profile.about}</Typography>
          </SectionCard>
        </Grid>

        <Grid item xs={12} lg={4}>
          <SectionCard title={t("profile.practiceInformation")}>
            <Stack spacing={2}>
              {profile.practiceInfo.map((item) => (
                <Typography key={item}>{item}</Typography>
              ))}
              <Divider />
              <Typography variant="body2" color="text.secondary">
                {t("profile.languages")}: {profile.languages.join(", ")}
              </Typography>
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
        <Grid item xs={12} lg={6}>
          <SectionCard title={t("profile.clinicalExpertise")}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t("profile.areasOfExpertise")}
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 2 }}>
              {profile.expertise.map((item) => (
                <Chip key={item} label={item} variant="outlined" />
              ))}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t("profile.conditionsTreated")}
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 2 }}>
              {profile.conditions.map((item) => (
                <Chip key={item} label={item} size="small" />
              ))}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t("profile.proceduresServices")}
            </Typography>
            <Stack spacing={1}>
              {profile.procedures.map((item) => (
                <Typography key={item}>- {item}</Typography>
              ))}
            </Stack>
          </SectionCard>
        </Grid>

        <Grid item xs={12} lg={6}>
          <SectionCard title={t("profile.educationTraining")}>
            <Stack spacing={1.5}>
              {profile.education.map((item, index) => (
                <Box key={item}>
                  <Typography sx={{ fontWeight: 600 }}>{item}</Typography>
                  {index !== profile.education.length - 1 ? <Divider sx={{ mt: 1.5 }} /> : null}
                </Box>
              ))}
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t("profile.boardCertifications")}
            </Typography>
            <Stack spacing={1}>
              {profile.certifications.map((item) => (
                <Typography key={item}>- {item}</Typography>
              ))}
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
        <Grid item xs={12}>
          <SectionCard title={t("profile.academicResearch")}>
            <Stack spacing={1}>
              {profile.research.map((item) => (
                <Typography key={item}>- {item}</Typography>
              ))}
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>
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