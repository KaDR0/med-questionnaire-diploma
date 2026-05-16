import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import EditNoteRoundedIcon from "@mui/icons-material/EditNoteRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";

import api from "../api/axios";
import useToast from "../utils/useToast";
import { CardSkeleton } from "../components/ui/LoadingSkeleton";

const ACTION_META = {
  approve: {
    color: "success",
    icon: <CheckCircleRoundedIcon />,
    titleKey: "review.approveAction",
    hintKey: "review.approveHint",
    commentRequired: false,
  },
  "request-changes": {
    color: "warning",
    icon: <EditNoteRoundedIcon />,
    titleKey: "review.changesAction",
    hintKey: "review.changesHint",
    commentRequired: true,
  },
  reject: {
    color: "error",
    icon: <BlockRoundedIcon />,
    titleKey: "review.rejectAction",
    hintKey: "review.rejectHint",
    commentRequired: true,
  },
};

function pickTitle(item) {
  return item?.title_ru || item?.title_en || item?.title || "—";
}

function QuestionnaireReviewPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const toast = useToast();
  const { id } = useParams();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dialogAction, setDialogAction] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`questionnaires/${id}/`)
      .then((response) => {
        if (cancelled) return;
        setItem(response.data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.detail || t("review.loadError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, t]);

  const interpretationPretty = useMemo(() => {
    if (!item?.interpretation_rules) return "";
    try {
      return JSON.stringify(JSON.parse(item.interpretation_rules), null, 2);
    } catch {
      return item.interpretation_rules;
    }
    // The dependency is intentionally narrow: re-render only when the rules
    // string actually changes, even though `item` shape is shallowly equal.
  }, [item?.interpretation_rules]);

  const handleOpenDialog = (action) => {
    setDialogAction(action);
    setComment("");
  };

  const handleCloseDialog = () => {
    if (submitting) return;
    setDialogAction("");
    setComment("");
  };

  const doAction = async () => {
    if (!dialogAction) return;
    const meta = ACTION_META[dialogAction];
    if (meta.commentRequired && !comment.trim()) {
      toast.error(t("review.commentRequired"));
      return;
    }
    try {
      setSubmitting(true);
      await api.post(`questionnaires/${id}/${dialogAction}/`, {
        review_comment: comment,
      });
      toast.success(t("review.actionSuccess"));
      navigate("/questionnaires/pending");
    } catch (err) {
      toast.error(err?.response?.data?.detail || t("review.actionError"));
    } finally {
      setSubmitting(false);
      setDialogAction("");
      setComment("");
    }
  };

  const dialogMeta = dialogAction ? ACTION_META[dialogAction] : null;
  const commentInvalid = dialogMeta?.commentRequired && !comment.trim();

  if (loading) {
    return (
      <Box>
        <CardSkeleton lines={6} />
      </Box>
    );
  }

  if (error || !item) {
    return (
      <Box>
        <Button
          component={Link}
          to="/questionnaires/pending"
          startIcon={<ArrowBackRoundedIcon />}
          sx={{ mb: 2 }}
        >
          {t("review.backToQueue")}
        </Button>
        {error ? <Alert severity="error">{error}</Alert> : null}
      </Box>
    );
  }

  const questions = item.questions || [];
  const statusKey = item.approval_status || "pending_approval";

  return (
    <Box sx={{ pb: { xs: 14, md: 12 } }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} alignItems={{ sm: "center" }} sx={{ mb: 2 }}>
        <Button
          component={Link}
          to="/questionnaires/pending"
          startIcon={<ArrowBackRoundedIcon />}
          variant="text"
          size="small"
        >
          {t("review.backToQueue")}
        </Button>
      </Stack>

      <Card sx={{ mb: 2.5 }}>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: "0.08em" }}>
                {t("pendingQuestionnaires.title")}
              </Typography>
              <Typography variant="h4" sx={{ mt: 0.5, mb: 0.75, lineHeight: 1.2 }}>
                {pickTitle(item)}
              </Typography>
              {item.description ? (
                <Typography color="text.secondary" sx={{ maxWidth: 720 }}>
                  {item.description}
                </Typography>
              ) : null}
            </Box>
            <Stack spacing={1} alignItems={{ xs: "flex-start", md: "flex-end" }}>
              <Chip
                size="small"
                label={t(`myQuestionnaires.status.${statusKey}`)}
                color="warning"
                variant="outlined"
                sx={{ borderRadius: 2, fontWeight: 700 }}
              />
              {item.medical_area ? (
                <Typography variant="caption" color="text.secondary">
                  {item.medical_area}
                </Typography>
              ) : null}
              {item.created_by ? (
                <Typography variant="caption" color="text.secondary">
                  {t("pendingQuestionnaires.author")}: {item.created_by}
                </Typography>
              ) : null}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Stack spacing={2.5}>
        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
              {t("review.sourceBlock")}
            </Typography>
            <Box
              sx={{
                display: "grid",
                gap: 1.25,
                gridTemplateColumns: { xs: "1fr", sm: "180px 1fr" },
                alignItems: "baseline",
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {t("builder.sourceName")}
              </Typography>
              <Typography variant="body2">{item.source_name || "—"}</Typography>

              <Typography variant="body2" color="text.secondary">
                {t("builder.sourceUrl")}
              </Typography>
              {item.source_url ? (
                <Typography
                  component="a"
                  variant="body2"
                  href={item.source_url}
                  target="_blank"
                  rel="noreferrer"
                  sx={{
                    color: "primary.main",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.5,
                    "&:hover": { textDecoration: "underline" },
                    overflowWrap: "anywhere",
                  }}
                >
                  {item.source_url}
                  <OpenInNewRoundedIcon sx={{ fontSize: 14 }} />
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">—</Typography>
              )}

              <Typography variant="body2" color="text.secondary">
                {t("builder.sourceType")}
              </Typography>
              <Typography variant="body2">{item.source_type || "—"}</Typography>

              <Typography variant="body2" color="text.secondary">
                {t("builder.evidenceNote")}
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {item.evidence_note || "—"}
              </Typography>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
              {t("review.scoringBlock")}
            </Typography>
            <Stack spacing={1.25}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={{ xs: 0.25, sm: 2 }}
                sx={{ alignItems: { sm: "baseline" } }}
              >
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 180 }}>
                  {t("builder.scoringMethod")}
                </Typography>
                <Typography variant="body2">{item.scoring_method || "—"}</Typography>
              </Stack>
              {interpretationPretty ? (
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    p: 1.5,
                    borderRadius: 1.5,
                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                    border: "1px solid",
                    borderColor: "divider",
                    fontSize: "0.8125rem",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    whiteSpace: "pre-wrap",
                    overflowX: "auto",
                  }}
                >
                  {interpretationPretty}
                </Box>
              ) : null}
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 1.5 }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {t("review.questionsBlock")}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t("review.questionsHint", { count: questions.length })}
              </Typography>
            </Stack>
            {questions.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                —
              </Typography>
            ) : (
              <Stack divider={<Divider />} spacing={0}>
                {questions.map((q) => (
                  <Box
                    key={q.id}
                    sx={{
                      py: 1.25,
                      "&:first-of-type": { pt: 0 },
                      "&:last-of-type": { pb: 0 },
                    }}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <Box
                        aria-hidden
                        sx={{
                          minWidth: 28,
                          height: 28,
                          borderRadius: 999,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          color: "primary.dark",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                        }}
                      >
                        {q.order}
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {q.text || q.text_ru || q.text_en || "—"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {q.qtype}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Stack>

      {/* Sticky bottom action bar */}
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          top: "auto",
          bottom: 0,
          borderTop: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Toolbar
          sx={{
            gap: 1,
            justifyContent: { xs: "stretch", sm: "flex-end" },
            flexWrap: "wrap",
            py: 1,
            px: { xs: 2, md: 3 },
          }}
        >
          <Tooltip title={t("pendingQuestionnaires.reject")}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<BlockRoundedIcon />}
              onClick={() => handleOpenDialog("reject")}
            >
              {t("pendingQuestionnaires.reject")}
            </Button>
          </Tooltip>
          <Tooltip title={t("pendingQuestionnaires.requestChanges")}>
            <Button
              variant="outlined"
              color="warning"
              startIcon={<EditNoteRoundedIcon />}
              onClick={() => handleOpenDialog("request-changes")}
            >
              {t("pendingQuestionnaires.requestChanges")}
            </Button>
          </Tooltip>
          <Tooltip title={t("pendingQuestionnaires.approve")}>
            <Button
              variant="contained"
              color="success"
              startIcon={<CheckCircleRoundedIcon />}
              onClick={() => handleOpenDialog("approve")}
            >
              {t("pendingQuestionnaires.approve")}
            </Button>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Dialog open={Boolean(dialogAction)} onClose={handleCloseDialog} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pr: 6 }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            {dialogMeta?.icon}
            <span>{dialogMeta ? t(dialogMeta.titleKey) : ""}</span>
          </Stack>
          <IconButton
            aria-label="close"
            onClick={handleCloseDialog}
            sx={{ position: "absolute", right: 8, top: 8 }}
            disabled={submitting}
          >
            <ArrowBackRoundedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {dialogMeta ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t(dialogMeta.hintKey)}
            </Typography>
          ) : null}
          <TextField
            autoFocus
            multiline
            minRows={4}
            fullWidth
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("pendingQuestionnaires.comment")}
            required={dialogMeta?.commentRequired}
            error={Boolean(dialogMeta?.commentRequired && !comment.trim())}
            helperText={
              dialogMeta?.commentRequired && !comment.trim()
                ? t("review.commentRequired")
                : null
            }
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseDialog} disabled={submitting}>
            {t("detail.cancelEdit")}
          </Button>
          <Button
            variant="contained"
            color={dialogMeta?.color || "primary"}
            onClick={doAction}
            disabled={submitting || commentInvalid}
            startIcon={dialogMeta?.icon}
          >
            {t("common.save")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default QuestionnaireReviewPage;
