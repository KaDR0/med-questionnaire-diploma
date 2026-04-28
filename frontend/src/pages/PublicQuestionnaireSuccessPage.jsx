import { Box, Card, CardContent, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";

function PublicQuestionnaireSuccessPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", px: 2 }}>
      <Box sx={{ maxWidth: 560, mx: "auto", width: "100%" }}>
        <Card sx={{ border: "1px solid", borderColor: alpha(theme.palette.success.main, 0.24) }}>
          <CardContent sx={{ py: 5, textAlign: "center" }}>
            <Typography sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1, mb: 1, color: "success.main" }}>[OK]</Typography>
            <Typography variant="h4" sx={{ mb: 1.5 }}>{t("publicPages.successTitle")}</Typography>
            <Typography color="text.secondary">{t("publicPages.successSubtitle")}</Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}

export default PublicQuestionnaireSuccessPage;
