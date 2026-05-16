import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { SnackbarProvider } from "notistack";
import { AuthProvider } from "./context/AuthContext";
import { appTheme } from "./theme/appTheme";
import AppErrorBoundary from "./components/ui/AppErrorBoundary";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <SnackbarProvider
        maxSnack={3}
        autoHideDuration={4000}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        dense
        preventDuplicate
      >
        <AppErrorBoundary>
          <AuthProvider>
            <App />
          </AuthProvider>
        </AppErrorBoundary>
      </SnackbarProvider>
    </ThemeProvider>
  </React.StrictMode>
);
