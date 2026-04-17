import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/axios";
import { useTranslation } from "react-i18next";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Button,
  Grid,
  Chip,
  TextField,
  MenuItem,
  InputAdornment,
} from "@mui/material";
import PageHeader from "../components/ui/PageHeader";
import DashboardStatCard from "../components/ui/DashboardStatCard";
import SectionCard from "../components/ui/SectionCard";
import ActionBar from "../components/ui/ActionBar";

function QuestionnairePage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const [questionnaires, setQuestionnaires] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("questionnaires/")
      .then((response) => {
        setQuestionnaires(response.data);
      })
      .catch((error) => {
        console.error("Error loading questionnaires:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const getLocalizedTitle = (questionnaire) => {
    if (i18n.language === "ru") {
      return questionnaire.title_ru || questionnaire.title_en || questionnaire.title_kk || questionnaire.title;
    }
    if (i18n.language === "kk") {
      return questionnaire.title_kk || questionnaire.title_en || questionnaire.title_ru || questionnaire.title;
    }
    return questionnaire.title_en || questionnaire.title_ru || questionnaire.title_kk || questionnaire.title;
  };

  const getLocalizedDescription = (questionnaire) => {
    if (i18n.language === "ru") {
      return (
        questionnaire.description_ru ||
        questionnaire.description_en ||
        questionnaire.description_kk ||
        questionnaire.description
      );
    }
    if (i18n.language === "kk") {
      return (
        questionnaire.description_kk ||
        questionnaire.description_en ||
        questionnaire.description_ru ||
        questionnaire.description
      );
    }
    return (
      questionnaire.description_en ||
      questionnaire.description_ru ||
      questionnaire.description_kk ||
      questionnaire.description
    );
  };

  const filteredQuestionnaires = useMemo(() => {
    const query = search.trim().toLowerCase();
    return questionnaires.filter((questionnaire) => {
      const title = getLocalizedTitle(questionnaire).toLowerCase();
      const desc = (getLocalizedDescription(questionnaire) || "").toLowerCase();
      const statusMatches =
        statusFilter === "all" ||
        (statusFilter === "active" && questionnaire.is_active) ||
        (statusFilter === "inactive" && !questionnaire.is_active);
      const searchMatches = !query || title.includes(query) || desc.includes(query);
      return statusMatches && searchMatches;
    });
  }, [questionnaires, search, statusFilter]);

  return (
    <Box>
      <PageHeader
        title={t("questionnaires.title")}
        subtitle={t("questionnaires.subtitle")}
        actions={
          <ActionBar>
            <Chip label={`${t("questionnaires.patientId")}: ${id}`} color="primary" variant="outlined" />
          </ActionBar>
        }
      />

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <DashboardStatCard label={t("questionnaires.available")} value={filteredQuestionnaires.length} />
        </Grid>
        <Grid item xs={12} md={4}>
          <DashboardStatCard label={t("questionnaires.patientId")} value={id} />
        </Grid>
        <Grid item xs={12} md={4}>
          <DashboardStatCard label={t("questionnaires.library")} value={t("questionnaires.active")} />
        </Grid>
      </Grid>

      <SectionCard title={t("questionnaires.library")} subtitle={t("questionnaires.choose")} contentSx={{ mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              size="small"
              placeholder={t("patients.searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start">🔎</InputAdornment> }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              select
              fullWidth
              size="small"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <MenuItem value="all">{t("questionnaires.available")}</MenuItem>
              <MenuItem value="active">{t("questionnaires.active")}</MenuItem>
              <MenuItem value="inactive">{t("questionnaires.inactive")}</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </SectionCard>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
          <CircularProgress />
        </Box>
      ) : filteredQuestionnaires.length === 0 ? (
        <Card>
          <CardContent sx={{ py: 5 }}>
            <Typography align="center" color="text.secondary">
              {t("questionnaires.none")}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2.5}>
          {filteredQuestionnaires.map((questionnaire) => (
              <Grid item xs={12} md={6} lg={4} key={questionnaire.id}>
                <Card
                  sx={(theme) => ({
                    height: "100%",
                    borderRadius: 4,
                    border: "1px solid",
                    borderColor: "divider",
                    boxShadow: `0 10px 24px ${theme.palette.mode === "light" ? "rgba(12, 100, 117, 0.07)" : "rgba(0,0,0,0.2)"}`,
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: `0 16px 34px ${theme.palette.mode === "light" ? "rgba(12, 100, 117, 0.12)" : "rgba(0,0,0,0.28)"}`,
                    },
                  })}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 2,
                        mb: 2,
                      }}
                    >
                      <Box>
                        <Typography variant="h6" gutterBottom>
                          {getLocalizedTitle(questionnaire)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {questionnaire.kind_label || t("questionnaires.record")}
                        </Typography>
                      </Box>

                      <Chip
                        label={
                          questionnaire.is_active
                            ? t("questionnaires.active")
                            : t("questionnaires.inactive")
                        }
                        color={questionnaire.is_active ? "success" : "default"}
                        size="small"
                      />
                    </Box>

                    <Box sx={{ display: "grid", gap: 1.1, mb: 2.5 }}>
                      <Typography variant="body2">
                        <strong>{t("questionnaires.targetCondition")}:</strong>{" "}
                        {questionnaire.target_condition_code || t("common.noData")}
                      </Typography>
                      <Typography variant="body2">
                        <strong>{t("questionnaires.disease")}:</strong>{" "}
                        {questionnaire.disease_name || t("common.noData")}
                      </Typography>
                      <Typography variant="body2">
                        <strong>{t("questionnaires.minCompletion")}:</strong>{" "}
                        {questionnaire.min_completion_percent ?? t("common.noData")}%
                      </Typography>
                      <Typography variant="body2">
                        <strong>{t("questionnaires.version")}:</strong>{" "}
                        {questionnaire.version || t("common.noData")}
                      </Typography>
                      <Typography variant="body2">
                        <strong>{t("questionnaires.description")}:</strong>{" "}
                        {getLocalizedDescription(questionnaire) || t("common.noData")}
                      </Typography>
                    </Box>

                    <Button
                      component={Link}
                      to={`/patients/${id}/questionnaires/${questionnaire.id}`}
                      variant="contained"
                      fullWidth
                    >
                      {t("questionnaires.open")}
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

export default QuestionnairePage;