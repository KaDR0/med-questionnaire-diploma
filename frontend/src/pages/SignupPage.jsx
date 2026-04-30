import { Link } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import LogoLockup from "../components/brand/LogoLockup";

function SignupPage() {
  const { t } = useTranslation();

  return (
    <Box
      className="mq-workspace-bg"
      sx={{ minHeight: "100vh", display: "flex", alignItems: "center", py: 6 }}
    >
      <Container maxWidth="sm" sx={{ width: "100%" }}>
        <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }} className="mq-animate-fade-up">
          <LogoLockup variant="hero" disableLink caption="brand" animatedCaption />
        </Box>
        <Card className="mq-animate-fade-up-delay">
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Typography variant="h4" gutterBottom>
              {t("signupSelector.title")}
            </Typography>

            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {t("signupSelector.subtitle")}
            </Typography>

            <Stack spacing={1.25} sx={{ mb: 2.5 }}>
              <Button component={Link} to="/signup/patient" variant="contained" fullWidth>
                {t("signupSelector.patientButton")}
              </Button>
              <Button component={Link} to="/signup/doctor" variant="outlined" fullWidth>
                {t("signupSelector.doctorButton")}
              </Button>
            </Stack>

            <Typography variant="body2" color="text.secondary">
              {t("signup.hasAccount")}{" "}
              <Link to="/login" style={{ color: "inherit", fontWeight: 600 }}>
                {t("signup.login")}
              </Link>
            </Typography>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}

export default SignupPage;