import { Box, Button, Card, CardContent, Container, Grid, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LogoLockup from "../components/brand/LogoLockup";

const featureKeys = [
  "patients",
  "questionnaires",
  "results",
  "monitoring",
  "history",
  "risk",
];

const audienceKeys = ["doctors", "clinics", "education"];
const advantageKeys = ["structured", "interface", "history", "workflow"];

function AboutPage() {
  const { t } = useTranslation();

  return (
    <Box className="mq-workspace-bg" sx={{ minHeight: "100vh" }}>
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        <Stack spacing={3}>
          <Card className="mq-animate-fade-up">
            <CardContent sx={{ p: { xs: 3, md: 4 } }}>
              <Stack spacing={2.5} sx={{ maxWidth: 720 }} alignItems={{ xs: "stretch", md: "flex-start" }}>
                <Box sx={{ alignSelf: "center", width: "100%", maxWidth: 400 }}>
                  <LogoLockup
                    variant="hero"
                    disableLink
                    showTitle={false}
                    caption="brand"
                    animatedCaption
                  />
                </Box>
                <Typography
                  variant="overline"
                  color="text.secondary"
                  className="mq-animate-fade-up-delay"
                  sx={{ fontWeight: 600, letterSpacing: "0.08em" }}
                >
                  {t("about.badge")}
                </Typography>
                <Typography
                  variant="h3"
                  className="mq-animate-fade-up-delay-2"
                  sx={{ fontSize: { xs: "1.75rem", md: "2.25rem" }, lineHeight: 1.2, fontWeight: 600 }}
                >
                  {t("about.heroTitle")}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 640 }}>
                  {t("about.heroSubtitle")}
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ pt: 0.5 }}>
                  <Button component={Link} to="/login" variant="contained">
                    {t("about.heroPrimary")}
                  </Button>
                  <Button component={Link} to="/signup" variant="outlined">
                    {t("about.heroSecondary")}
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Grid container spacing={3} className="mq-stagger-fade">
            <Grid item xs={12} md={7}>
              <Card sx={{ height: "100%" }}>
                <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                  <Typography variant="h4" sx={{ mb: 1.5 }}>
                    {t("about.platformTitle")}
                  </Typography>
                  <Typography color="text.secondary" sx={{ lineHeight: 1.8 }}>
                    {t("about.platformText")}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={5}>
              <Card sx={{ height: "100%" }}>
                <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                  <Typography variant="h4" sx={{ mb: 2 }}>
                    {t("about.footerTitle")}
                  </Typography>
                  <Typography color="text.secondary" sx={{ lineHeight: 1.8 }}>
                    {t("about.footerSubtitle")}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card>
            <CardContent sx={{ p: { xs: 3, md: 4 } }}>
              <Typography variant="h4" sx={{ mb: 3 }}>
                {t("about.featuresTitle")}
              </Typography>
              <Grid container spacing={2} className="mq-stagger-fade">
                {featureKeys.map((key) => (
                  <Grid item xs={12} sm={6} lg={4} key={key}>
                    <Card variant="outlined" sx={{ height: "100%", boxShadow: "none" }}>
                      <CardContent>
                        <Typography variant="h6" sx={{ mb: 1 }}>
                          {t(`about.features.${key}.title`)}
                        </Typography>
                        <Typography color="text.secondary">
                          {t(`about.features.${key}.text`)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card sx={{ height: "100%" }}>
                <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                  <Typography variant="h4" sx={{ mb: 2.5 }}>
                    {t("about.audienceTitle")}
                  </Typography>
                  <Stack spacing={1.5}>
                    {audienceKeys.map((key) => (
                      <Box
                        key={key}
                        sx={{
                          p: 2,
                          borderRadius: 3,
                          bgcolor: "grey.50",
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Typography sx={{ fontWeight: 600 }}>{t(`about.audience.${key}`)}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={{ height: "100%" }}>
                <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                  <Typography variant="h4" sx={{ mb: 2.5 }}>
                    {t("about.advantagesTitle")}
                  </Typography>
                  <Stack spacing={1.5}>
                    {advantageKeys.map((key) => (
                      <Box
                        key={key}
                        sx={{
                          p: 2,
                          borderRadius: 3,
                          bgcolor: "grey.50",
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Typography sx={{ fontWeight: 600 }}>{t(`about.advantages.${key}`)}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Box
            sx={{
              pt: 2,
              pb: 1,
              textAlign: "center",
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              {t("about.footerTitle")}
            </Typography>
            <Typography color="text.secondary">{t("about.footerSubtitle")}</Typography>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}

export default AboutPage;
