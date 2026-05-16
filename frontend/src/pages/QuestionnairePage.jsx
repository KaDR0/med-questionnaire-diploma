import { useEffect, useMemo, useState } from "react";
import { useParams, Link as RouterLink } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import LibraryBooksRoundedIcon from "@mui/icons-material/LibraryBooksRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";

import api from "../api/axios";
import { useTranslation } from "react-i18next";
import PageHeader from "../components/ui/PageHeader";
import KpiCard from "../components/ui/KpiCard";
import SectionCard from "../components/ui/SectionCard";
import { CardSkeleton } from "../components/ui/LoadingSkeleton";
import EmptyState from "../components/ui/EmptyState";

function QuestionnairePage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
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
      return (
        questionnaire.title_ru ||
        questionnaire.title_en ||
        questionnaire.title_kk ||
        questionnaire.title
      );
    }
    if (i18n.language === "kk") {
      return (
        questionnaire.title_kk ||
        questionnaire.title_en ||
        questionnaire.title_ru ||
        questionnaire.title
      );
    }
    return (
      questionnaire.title_en ||
      questionnaire.title_ru ||
      questionnaire.title_kk ||
      questionnaire.title
    );
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

  const activeCount = questionnaires.filter((q) => q.is_active).length;

  return (
    <Box>
      <PageHeader
        title={t("questionnaires.title")}
        subtitle={t("questionnaires.subtitle")}
        actions={
          <Chip
            label={`${t("questionnaires.patientId")}: ${id}`}
            color="primary"
            variant="outlined"
          />
        }
      />

      <Grid container spacing={2.25} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <KpiCard
            label={t("questionnaires.available")}
            value={questionnaires.length}
            icon={<LibraryBooksRoundedIcon />}
            tone="primary"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <KpiCard
            label={t("questionnaires.active")}
            value={activeCount}
            icon={<FactCheckRoundedIcon />}
            tone="success"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <KpiCard
            label={t("questionnaires.patientId")}
            value={id}
            tone="info"
          />
        </Grid>
      </Grid>

      <SectionCard
        title={t("questionnaires.library")}
        subtitle={t("questionnaires.choose")}
        contentSx={{ mb: 2.5 }}
      >
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 8 }}>
            <TextField
              fullWidth
              placeholder={t("patients.searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              select
              fullWidth
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
        <Grid container spacing={2.25}>
          {[0, 1, 2].map((i) => (
            <Grid size={{ xs: 12, md: 6, lg: 4 }} key={i}>
              <CardSkeleton lines={5} />
            </Grid>
          ))}
        </Grid>
      ) : filteredQuestionnaires.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              title={t("questionnaires.none")}
              description={t("questionnaires.choose")}
            />
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2.25}>
          {filteredQuestionnaires.map((questionnaire) => (
            <Grid size={{ xs: 12, md: 6, lg: 4 }} key={questionnaire.id}>
              <Card
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  transition: "transform .2s ease, box-shadow .2s ease, border-color .2s ease",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    borderColor: "primary.light",
                    boxShadow: `0 12px 28px ${alpha(
                      theme.palette.primary.main,
                      0.12
                    )}`,
                  },
                }}
              >
                <CardContent
                  sx={{
                    p: { xs: 2.5, md: 3 },
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="flex-start"
                    justifyContent="space-between"
                    sx={{ mb: 1.5 }}
                  >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography
                        variant="h6"
                        sx={{ fontWeight: 700, lineHeight: 1.35, mb: 0.5 }}
                      >
                        {getLocalizedTitle(questionnaire)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
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
                      variant={questionnaire.is_active ? "filled" : "outlined"}
                    />
                  </Stack>

                  <Stack spacing={0.5} sx={{ mb: 2, flex: 1 }}>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 0.5 }}>
                      {questionnaire.target_condition_code ? (
                        <Chip
                          label={questionnaire.target_condition_code}
                          size="small"
                          variant="outlined"
                          sx={{ height: 22, fontSize: "0.72rem" }}
                        />
                      ) : null}
                      {questionnaire.disease_name ? (
                        <Chip
                          label={questionnaire.disease_name}
                          size="small"
                          variant="outlined"
                          sx={{ height: 22, fontSize: "0.72rem" }}
                        />
                      ) : null}
                      {questionnaire.version ? (
                        <Chip
                          label={`v${questionnaire.version}`}
                          size="small"
                          variant="outlined"
                          sx={{ height: 22, fontSize: "0.72rem" }}
                        />
                      ) : null}
                    </Stack>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        lineHeight: 1.6,
                      }}
                    >
                      {getLocalizedDescription(questionnaire) || t("common.noData")}
                    </Typography>
                    {questionnaire.min_completion_percent != null ? (
                      <Typography variant="caption" color="text.secondary">
                        {t("questionnaires.minCompletion")}:{" "}
                        {questionnaire.min_completion_percent}%
                      </Typography>
                    ) : null}
                  </Stack>

                  <Button
                    component={RouterLink}
                    to={`/patients/${id}/questionnaires/${questionnaire.id}`}
                    variant="contained"
                    endIcon={<OpenInNewRoundedIcon />}
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
