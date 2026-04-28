import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import api from "../api/axios";
import { useTranslation } from "react-i18next";

function QuestionnaireReviewPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [error, setError] = useState("");
  const [dialogAction, setDialogAction] = useState("");
  const [comment, setComment] = useState("");
  const [snackbar, setSnackbar] = useState("");

  useEffect(() => {
    api
      .get(`questionnaires/${id}/`)
      .then((response) => setItem(response.data))
      .catch((err) => setError(err?.response?.data?.detail || t("review.loadError")));
  }, [id, t]);

  const interpretationPretty = useMemo(() => {
    if (!item?.interpretation_rules) return "";
    try {
      return JSON.stringify(JSON.parse(item.interpretation_rules), null, 2);
    } catch {
      return item.interpretation_rules;
    }
  }, [item?.interpretation_rules]);

  const doAction = async (action) => {
    try {
      await api.post(`questionnaires/${id}/${action}/`, { review_comment: comment });
      setSnackbar(t("review.actionSuccess"));
      navigate("/questionnaires/pending");
    } catch (err) {
      setError(err?.response?.data?.detail || t("review.actionError"));
    }
  };

  return (
    <Box>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {!item ? null : (
        <Stack spacing={2}>
          <Typography variant="h4">{item.title_ru || item.title_en || item.title}</Typography>
          <Typography color="text.secondary">{item.description || "-"}</Typography>
          <Card sx={{ border: "1px solid", borderColor: alpha(theme.palette.primary.main, 0.16) }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>{t("review.sourceBlock")}</Typography>
              <Typography>{item.source_name || "-"}</Typography>
              <Typography component="a" href={item.source_url} target="_blank" rel="noreferrer">{item.source_url || "-"}</Typography>
              <Typography>{item.source_type || "-"}</Typography>
              <Typography>{item.evidence_note || "-"}</Typography>
            </CardContent>
          </Card>
          <Card sx={{ border: "1px solid", borderColor: alpha(theme.palette.info.main, 0.16) }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>{t("review.scoringBlock")}</Typography>
              <Typography>{item.scoring_method || "-"}</Typography>
              <Box component="pre" sx={{ whiteSpace: "pre-wrap", m: 0 }}>{interpretationPretty || "-"}</Box>
            </CardContent>
          </Card>
          <Card sx={{ border: "1px solid", borderColor: alpha(theme.palette.secondary.main, 0.2) }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>{t("review.questionsBlock")}</Typography>
              {(item.questions || []).map((question) => (
                <Box key={question.id} sx={{ mb: 1.5 }}>
                  <Typography fontWeight={700}>#{question.order} {question.text || question.text_ru || question.text_en}</Typography>
                  <Typography variant="body2" color="text.secondary">{question.qtype}</Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ position: "sticky", bottom: 8, py: 1, bgcolor: "background.default", borderRadius: 1 }}
          >
            <Button variant="contained" onClick={() => doAction("approve")}>{t("pendingQuestionnaires.approve")}</Button>
            <Button variant="outlined" color="warning" onClick={() => setDialogAction("request-changes")}>{t("pendingQuestionnaires.requestChanges")}</Button>
            <Button variant="outlined" color="error" onClick={() => setDialogAction("reject")}>{t("pendingQuestionnaires.reject")}</Button>
          </Stack>
        </Stack>
      )}
      <Dialog open={Boolean(dialogAction)} onClose={() => setDialogAction("")} fullWidth maxWidth="sm">
        <DialogTitle>{t("review.commentRequired")}</DialogTitle>
        <DialogContent>
          <TextField
            multiline
            minRows={4}
            fullWidth
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("pendingQuestionnaires.comment")}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogAction("")}>{t("detail.cancelEdit")}</Button>
          <Button
            variant="contained"
            onClick={() => {
              doAction(dialogAction);
              setDialogAction("");
            }}
            disabled={!comment.trim()}
          >
            {t("common.save")}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={Boolean(snackbar)} autoHideDuration={2500} message={snackbar} onClose={() => setSnackbar("")} />
    </Box>
  );
}

export default QuestionnaireReviewPage;
