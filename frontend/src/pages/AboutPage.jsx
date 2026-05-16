import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
import MonitorHeartRoundedIcon from "@mui/icons-material/MonitorHeartRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import LocalHospitalRoundedIcon from "@mui/icons-material/LocalHospitalRounded";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import PersonAddAlt1RoundedIcon from "@mui/icons-material/PersonAddAlt1Rounded";

import LogoLockup from "../components/brand/LogoLockup";
import AuthScaffold from "../components/AuthScaffold";

const featureMeta = [
  { key: "patients", icon: <PeopleAltRoundedIcon /> },
  { key: "questionnaires", icon: <FactCheckRoundedIcon /> },
  { key: "results", icon: <AssessmentRoundedIcon /> },
  { key: "monitoring", icon: <MonitorHeartRoundedIcon /> },
  { key: "history", icon: <HistoryRoundedIcon /> },
  { key: "risk", icon: <WarningAmberRoundedIcon /> },
];

const audienceMeta = [
  { key: "doctors", icon: <LocalHospitalRoundedIcon /> },
  { key: "clinics", icon: <BusinessRoundedIcon /> },
  { key: "education", icon: <SchoolRoundedIcon /> },
];

const advantageKeys = ["structured", "interface", "history", "workflow"];

function AboutPage() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <AuthScaffold>
      <Container
        maxWidth="lg"
        sx={{ py: { xs: 4, md: 6 }, px: { xs: 2, sm: 3 } }}
      >
        <Stack spacing={3}>
          <Card
            className="mq-animate-fade-up"
            sx={{
              overflow: "hidden",
              position: "relative",
              background: `linear-gradient(135deg, ${alpha(
                theme.palette.primary.main,
                0.08
              )} 0%, ${alpha(theme.palette.background.paper, 0)} 60%)`,
            }}
          >
            <CardContent sx={{ p: { xs: 3, md: 5 } }}>
              <Stack
                spacing={2.5}
                sx={{ maxWidth: 760 }}
                alignItems={{ xs: "stretch", md: "flex-start" }}
              >
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
                  color="primary.main"
                  className="mq-animate-fade-up-delay"
                  sx={{ fontWeight: 700, letterSpacing: "0.08em" }}
                >
                  {t("about.badge")}
                </Typography>
                <Typography
                  variant="h3"
                  className="mq-animate-fade-up-delay-2"
                  sx={{
                    fontSize: { xs: "1.875rem", md: "2.5rem" },
                    lineHeight: 1.15,
                    fontWeight: 700,
                  }}
                >
                  {t("about.heroTitle")}
                </Typography>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ maxWidth: 640, lineHeight: 1.7 }}
                >
                  {t("about.heroSubtitle")}
                </Typography>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.25}
                  sx={{ pt: 0.5 }}
                >
                  <Button
                    component={RouterLink}
                    to="/login"
                    variant="contained"
                    size="large"
                    startIcon={<LoginRoundedIcon />}
                  >
                    {t("about.heroPrimary")}
                  </Button>
                  <Button
                    component={RouterLink}
                    to="/signup"
                    variant="outlined"
                    size="large"
                    startIcon={<PersonAddAlt1RoundedIcon />}
                  >
                    {t("about.heroSecondary")}
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Grid container spacing={3} className="mq-stagger-fade">
            <Grid size={{ xs: 12, md: 7 }}>
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
            <Grid size={{ xs: 12, md: 5 }}>
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
                {featureMeta.map(({ key, icon }) => (
                  <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={key}>
                    <Card
                      variant="outlined"
                      sx={{
                        height: "100%",
                        boxShadow: "none",
                        transition: "transform .2s ease, border-color .2s ease",
                        "&:hover": {
                          transform: "translateY(-2px)",
                          borderColor: "primary.light",
                        },
                      }}
                    >
                      <CardContent>
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 1.5,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            mb: 1.5,
                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                            color: "primary.main",
                          }}
                        >
                          {icon}
                        </Box>
                        <Typography
                          variant="h6"
                          sx={{ mb: 0.75, fontWeight: 700 }}
                        >
                          {t(`about.features.${key}.title`)}
                        </Typography>
                        <Typography
                          color="text.secondary"
                          sx={{ lineHeight: 1.7 }}
                        >
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
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: "100%" }}>
                <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                  <Typography variant="h4" sx={{ mb: 2.5 }}>
                    {t("about.audienceTitle")}
                  </Typography>
                  <Stack spacing={1.5}>
                    {audienceMeta.map(({ key, icon }) => (
                      <Stack
                        key={key}
                        direction="row"
                        spacing={1.5}
                        alignItems="center"
                        sx={{
                          p: 2,
                          borderRadius: 1,
                          bgcolor: "background.default",
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Box
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                            color: "primary.main",
                            flexShrink: 0,
                          }}
                        >
                          {icon}
                        </Box>
                        <Typography sx={{ fontWeight: 600 }}>
                          {t(`about.audience.${key}`)}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
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
                          borderRadius: 1,
                          bgcolor: "background.default",
                          border: "1px solid",
                          borderColor: "divider",
                          position: "relative",
                          pl: 3,
                          "&::before": {
                            content: '""',
                            position: "absolute",
                            left: 10,
                            top: "50%",
                            transform: "translateY(-50%)",
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            bgcolor: "primary.main",
                          },
                        }}
                      >
                        <Typography sx={{ fontWeight: 600 }}>
                          {t(`about.advantages.${key}`)}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Box sx={{ textAlign: "center", py: 2 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              justifyContent="center"
            >
              <Button
                component={RouterLink}
                to="/login"
                variant="contained"
                size="large"
                startIcon={<LoginRoundedIcon />}
              >
                {t("about.heroPrimary")}
              </Button>
              <Button
                component={RouterLink}
                to="/signup"
                variant="outlined"
                size="large"
                startIcon={<PersonAddAlt1RoundedIcon />}
              >
                {t("about.heroSecondary")}
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Container>
    </AuthScaffold>
  );
}

export default AboutPage;
