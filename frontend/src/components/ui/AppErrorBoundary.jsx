import React from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { withTranslation } from "react-i18next";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";

/**
 * Top-level error boundary. Catches render-time errors inside the React tree and shows
 * a calm, branded fallback with a retry/return-home affordance. Network errors should
 * be handled per-request — this is the safety net for unexpected exceptions.
 */
class AppErrorBoundaryInner extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Surface to console for now — wire to a logging endpoint later if needed.
    console.error("AppErrorBoundary caught an error:", error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  handleHome = () => {
    if (typeof window !== "undefined") {
      window.location.assign("/");
    }
  };

  render() {
    const { t, children } = this.props;
    if (!this.state.hasError) return children;

    return (
      <Box
        role="alert"
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "background.default",
          p: 3,
        }}
      >
        <Box
          sx={{
            maxWidth: 480,
            width: "100%",
            textAlign: "center",
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
            p: { xs: 3, md: 4 },
            boxShadow: "0 2px 14px rgba(19, 36, 40, 0.06)",
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            {t("errors.boundaryTitle")}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            {t("errors.boundaryMessage")}
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} justifyContent="center">
            <Button
              variant="contained"
              startIcon={<RefreshRoundedIcon />}
              onClick={this.handleRetry}
            >
              {t("errors.boundaryRetry")}
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<HomeRoundedIcon />}
              onClick={this.handleHome}
            >
              {t("errors.boundaryHome")}
            </Button>
          </Stack>
        </Box>
      </Box>
    );
  }
}

const AppErrorBoundary = withTranslation()(AppErrorBoundaryInner);
export default AppErrorBoundary;
