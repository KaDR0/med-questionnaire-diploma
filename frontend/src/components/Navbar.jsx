import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Box,
  Chip,
  MenuItem,
  TextField,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import LogoLockup from "./brand/LogoLockup";

function Navbar() {
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const { t, i18n } = useTranslation();

  const handleLanguageChange = (event) => {
    i18n.changeLanguage(event.target.value);
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.92),
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid",
        borderColor: "divider",
        color: "text.primary",
      }}
    >
      <Container maxWidth="xl">
        <Toolbar
          disableGutters
          sx={{
            minHeight: 78,
            display: "flex",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", minWidth: 0 }}>
            <LogoLockup variant="toolbar" to="/" showCaption={false} />
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <Chip
              label={t("navbar.webApp")}
              color="primary"
              variant="outlined"
              sx={{ display: { xs: "none", md: "inline-flex" } }}
            />

            <TextField
              select
              size="small"
              value={i18n.language}
              onChange={handleLanguageChange}
              sx={{ minWidth: 100 }}
            >
              <MenuItem value="en">EN</MenuItem>
              <MenuItem value="ru">RU</MenuItem>
              <MenuItem value="kk">KK</MenuItem>
            </TextField>

            {isAuthenticated ? (
              <>
                <Typography variant="body2" color="text.secondary">
                  {t("navbar.doctorPrefix")} {user?.first_name || user?.username}
                </Typography>

                <Button
                  component={Link}
                  to="/"
                  variant={location.pathname === "/" ? "contained" : "text"}
                  color="primary"
                >
                  {t("navbar.patients")}
                </Button>

                <Button
                  component={Link}
                  to="/profile"
                  variant={location.pathname === "/profile" ? "contained" : "text"}
                  color="primary"
                >
                  {t("navbar.profile")}
                </Button>

                <Button color="inherit" onClick={logout}>
                  {t("navbar.logout")}
                </Button>
              </>
            ) : (
              <>
                <Button component={Link} to="/login" color="primary">
                  {t("navbar.login")}
                </Button>
                <Button component={Link} to="/signup" variant="contained" color="primary">
                  {t("navbar.signup")}
                </Button>
              </>
            )}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}

export default Navbar;