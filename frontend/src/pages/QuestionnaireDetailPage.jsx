import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import CalculateRoundedIcon from "@mui/icons-material/CalculateRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";

import api from "../api/axios";
import { useTranslation } from "react-i18next";
import PageHeader from "../components/ui/PageHeader";
import { CardSkeleton } from "../components/ui/LoadingSkeleton";

function QuestionnaireDetailPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`questionnaires/${id}/`)
      .then((response) => setItem(response.data))
      .catch((err) =>
        setError(err?.response?.data?.detail || t("questionnaireDetail.loadError"))
      )
      .finally(() => setLoading(false));
  }, [id, t]);

  const interpretationPretty = useMemo(() => {
    if (!item?.interpretation_rules) return "";
    try {
      return JSON.stringify(JSON.parse(item.interpretation_rules), null, 2);
    } catch {
      return item.interpretation_rules;
    }
  }, [item?.interpretation_rules]);

  if (loading) {
    return (
      <Box>
        <PageHeader title={t("questionnaireDetail.back")} />
        <Stack spacing={2.5}>
          <CardSkeleton lines={3} />
          <CardSkeleton lines={4} />
          <CardSkeleton lines={6} />
        </Stack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackRoundedIcon />}
          onClick={() => navigate("/questionnaires/my")}
        >
          {t("questionnaireDetail.back")}
        </Button>
      </Box>
    );
  }

  if (!item) return null;

  const title =
    item.title_ru || item.title_en || item.title_kk || item.title || "";

  return (
    <Box>
      <PageHeader
        title={title}
        subtitle={item.description || ""}
        actions={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<ArrowBackRoundedIcon />}
              onClick={() => navigate("/questionnaires/my")}
            >
              {t("questionnaireDetail.back")}
            </Button>
            <Button
              variant="contained"
              startIcon={<EditRoundedIcon />}
              onClick={() => navigate(`/questionnaires/${id}/edit`)}
            >
              {t("questionnaireDetail.edit")}
            </Button>
          </Stack>
        }
      />

      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 2.5 }}>
        <Chip
          label={item.approval_status}
          color={item.approval_status === "approved" ? "success" : "warning"}
          variant={item.approval_status === "approved" ? "filled" : "outlined"}
          size="small"
        />
        <Chip
          label={item.medical_area || t("myQuestionnaires.noArea")}
          variant="outlined"
          size="small"
        />
        {item.risk_target ? (
          <Chip label={item.risk_target} variant="outlined" size="small" />
        ) : null}
        {item.version ? (
          <Chip label={`v${item.version}`} variant="outlined" size="small" />
        ) : null}
      </Stack>

      <Stack spacing={2.25}>
        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.5 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: "primary.main",
                }}
              >
                <LinkRoundedIcon fontSize="small" />
              </Box>
              <Typography variant="h6">
                {t("questionnaireDetail.source")}
              </Typography>
            </Stack>
            <Typography sx={{ mb: 0.5 }}>{item.source_name || "—"}</Typography>
            {item.source_url ? (
              <Typography
                component="a"
                href={item.source_url}
                target="_blank"
                rel="noreferrer"
                variant="body2"
                sx={{
                  color: "primary.main",
                  textDecoration: "none",
                  wordBreak: "break-all",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                {item.source_url}
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary">
                —
              </Typography>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.5 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: alpha(theme.palette.info.main, 0.12),
                  color: "info.main",
                }}
              >
                <CalculateRoundedIcon fontSize="small" />
              </Box>
              <Typography variant="h6">
                {t("questionnaireDetail.scoring")}
              </Typography>
            </Stack>
            <Typography sx={{ mb: 1.5 }}>
              {item.scoring_method || "—"}
            </Typography>
            <Box
              component="pre"
              sx={{
                whiteSpace: "pre-wrap",
                m: 0,
                p: 1.5,
                borderRadius: 1,
                bgcolor: "background.default",
                border: "1px solid",
                borderColor: "divider",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 13,
                lineHeight: 1.6,
                color: "text.secondary",
                overflowX: "auto",
              }}
            >
              {interpretationPretty || "—"}
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.5 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: alpha(theme.palette.secondary.main, 0.12),
                  color: "secondary.main",
                }}
              >
                <HelpOutlineRoundedIcon fontSize="small" />
              </Box>
              <Typography variant="h6">
                {t("questionnaireDetail.questions")}
              </Typography>
              <Chip
                label={(item.questions || []).length}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ ml: "auto" }}
              />
            </Stack>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={1.5}>
              {(item.questions || []).map((question) => (
                <Box
                  key={question.id}
                  sx={{
                    p: 1.75,
                    borderRadius: 1,
                    border: "1px solid",
                    borderColor: "divider",
                    bgcolor: "background.default",
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: "primary.main",
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      {question.order}
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontWeight: 600, mb: 0.5 }}>
                        {question.text ||
                          question.text_ru ||
                          question.text_en ||
                          question.text_kk}
                      </Typography>
                      <Chip
                        label={question.qtype}
                        size="small"
                        variant="outlined"
                        sx={{ height: 20, fontSize: "0.7rem" }}
                      />
                      {question.qtype === "single_choice" ? (
                        <Stack spacing={0.5} sx={{ mt: 1 }}>
                          {(question.options || []).map((option, idx) => (
                            <Typography
                              key={idx}
                              variant="body2"
                              color="text.secondary"
                              sx={{ pl: 1.5 }}
                            >
                              • {option.text}{" "}
                              <Box
                                component="span"
                                sx={{
                                  color: "text.disabled",
                                  fontSize: "0.85em",
                                }}
                              >
                                (score: {option.score})
                              </Box>
                            </Typography>
                          ))}
                        </Stack>
                      ) : null}
                    </Box>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}

export default QuestionnaireDetailPage;
