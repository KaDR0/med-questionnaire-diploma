import { Box, Container, Typography, Stack, Chip } from "@mui/material";
import { useTranslation } from "react-i18next";

function Footer() {
  const { t } = useTranslation();

  return (
    <Box
      component="footer"
      sx={{
        mt: 4,
        py: 2.5,
        borderTop: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={1.5}
        >
          <Box>
            <Typography variant="subtitle2" fontWeight={600}>
              {t("footer.title")}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t("footer.subtitle")}
            </Typography>
          </Box>

          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            <Chip label={t("footer.react")} size="small" variant="outlined" />
            <Chip label={t("footer.django")} size="small" variant="outlined" />
            <Chip label={t("footer.api")} size="small" variant="outlined" />
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

export default Footer;