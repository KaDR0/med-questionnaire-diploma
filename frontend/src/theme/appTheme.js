import { createTheme, alpha } from "@mui/material/styles";

const primaryMain = "#0b5c6d";
const ink = "#132428";
const inkMuted = "#4a5f68";

/**
 * Medical UI: calm teal accent, cool neutrals, semantic greens/amber/red for vitals.
 * Typography and spacing tuned for long reading sessions (WCAG-friendly contrast).
 */
export const appTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: primaryMain,
      light: "#3a8a9a",
      dark: "#073f4a",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#556e78",
      light: "#8499a1",
      dark: "#3a4d55",
      contrastText: "#ffffff",
    },
    background: {
      default: "#e8f0f3",
      paper: "#fbfdfe",
    },
    text: {
      primary: ink,
      secondary: inkMuted,
    },
    divider: "rgba(11, 92, 109, 0.12)",
    action: {
      hover: "rgba(11, 92, 109, 0.07)",
      selected: "rgba(11, 92, 109, 0.11)",
      active: "rgba(11, 92, 109, 0.14)",
      focus: "rgba(11, 92, 109, 0.18)",
    },
    success: {
      main: "#1a6d48",
      light: "#e4f2ea",
      dark: "#124a32",
      contrastText: "#ffffff",
    },
    warning: {
      main: "#b45309",
      light: "#fdf4e6",
      dark: "#7a3a06",
      contrastText: "#ffffff",
    },
    error: {
      main: "#c4332e",
      light: "#fdecea",
      dark: "#8b2420",
      contrastText: "#ffffff",
    },
    info: {
      main: "#0a7d94",
      light: "#e5f4f7",
      dark: "#065566",
      contrastText: "#ffffff",
    },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: '"Source Sans 3", "Inter", system-ui, -apple-system, sans-serif',
    h3: { fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.22 },
    h4: { fontWeight: 600, letterSpacing: "-0.02em", fontSize: "1.6rem", lineHeight: 1.28 },
    h5: { fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.3 },
    h6: { fontWeight: 600, lineHeight: 1.35 },
    subtitle1: { fontWeight: 600, lineHeight: 1.4 },
    subtitle2: { fontWeight: 600, letterSpacing: "0.02em", lineHeight: 1.4 },
    body1: { lineHeight: 1.65, fontSize: "1rem" },
    body2: { lineHeight: 1.6, fontSize: "0.9375rem" },
    caption: { lineHeight: 1.45, letterSpacing: "0.01em" },
    overline: { letterSpacing: "0.08em", fontWeight: 600, lineHeight: 1.4 },
    button: {
      textTransform: "none",
      fontWeight: 600,
      letterSpacing: "0.02em",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: ({ theme }) => ({
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
          textRendering: "optimizeLegibility",
          color: theme.palette.text.primary,
        }),
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: ({ theme }) => ({
          boxShadow: `0 1px 2px ${alpha(ink, 0.04)}, 0 4px 20px ${alpha(ink, 0.03)}`,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
          borderRadius: theme.shape.borderRadius,
          transition: theme.transitions.create(["box-shadow", "border-color"], {
            duration: theme.transitions.duration.shorter,
          }),
        }),
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 10,
          paddingInline: 18,
          minHeight: 40,
          "&:focus-visible": {
            outline: `2px solid ${alpha(theme.palette.primary.main, 0.55)}`,
            outlineOffset: 2,
          },
        }),
        contained: {
          boxShadow: "none",
          "&:hover": { boxShadow: "none" },
        },
        outlined: ({ theme }) => ({
          borderColor: alpha(theme.palette.primary.main, 0.28),
          "&:hover": {
            borderColor: alpha(theme.palette.primary.main, 0.45),
            backgroundColor: alpha(theme.palette.primary.main, 0.04),
          },
        }),
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 10,
          transition: theme.transitions.create(["border-color", "box-shadow"], {
            duration: theme.transitions.duration.shorter,
          }),
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: alpha(theme.palette.primary.main, 0.35),
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderWidth: "1.5px",
            borderColor: theme.palette.primary.main,
          },
        }),
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: ({ theme }) => ({
          "&.Mui-focused": {
            color: theme.palette.primary.dark,
          },
        }),
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: theme.shape.borderRadius,
          alignItems: "flex-start",
        }),
        standardError: ({ theme }) => ({
          backgroundColor: theme.palette.error.light,
          color: theme.palette.error.dark,
        }),
        standardWarning: ({ theme }) => ({
          backgroundColor: theme.palette.warning.light,
          color: theme.palette.warning.dark,
        }),
        standardSuccess: ({ theme }) => ({
          backgroundColor: theme.palette.success.light,
          color: theme.palette.success.dark,
        }),
        standardInfo: ({ theme }) => ({
          backgroundColor: theme.palette.info.light,
          color: theme.palette.info.dark,
        }),
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderColor: alpha(theme.palette.divider, 0.9),
        }),
      },
    },
    MuiLink: {
      styleOverrides: {
        root: ({ theme }) => ({
          fontWeight: 600,
          textUnderlineOffset: 3,
          "&:focus-visible": {
            outline: `2px solid ${alpha(theme.palette.primary.main, 0.45)}`,
            outlineOffset: 2,
            borderRadius: 2,
          },
        }),
      },
    },
  },
});
