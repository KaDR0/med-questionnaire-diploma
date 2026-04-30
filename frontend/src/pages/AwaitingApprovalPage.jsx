import { Alert, Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import PageHeader from "../components/ui/PageHeader";
import SectionCard from "../components/ui/SectionCard";

function AwaitingApprovalPage() {
  const { t } = useTranslation();

  return (
    <Box sx={{ maxWidth: 760, mx: "auto" }}>
      <PageHeader title={t("pending.title")} subtitle={t("pending.subtitle")} />
      <SectionCard contentSx={{ p: { xs: 2.5, md: 3 } }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          {t("pending.alert")}
        </Alert>
        <Typography variant="body2" color="text.secondary">
          {t("pending.description")}
        </Typography>
      </SectionCard>
    </Box>
  );
}

export default AwaitingApprovalPage;
