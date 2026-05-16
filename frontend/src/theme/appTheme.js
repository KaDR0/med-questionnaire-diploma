import { createTheme, alpha } from "@mui/material/styles";

const primaryMain = "#0b5c6d";
const ink = "#132428";
const inkMuted = "#4a5f68";

const surfaceCanvas = "#f5f7fa";
const surfacePaper = "#ffffff";
const surfaceSubtle = "#eef2f6";
const surfaceMuted = "#f1f5f8";

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
      default: surfaceCanvas,
      paper: surfacePaper,
    },
    surface: {
      canvas: surfaceCanvas,
      paper: surfacePaper,
      subtle: surfaceSubtle,
      muted: surfaceMuted,
    },
    text: {
      primary: ink,
      secondary: inkMuted,
    },
    divider: "rgba(19, 36, 40, 0.10)",
    action: {
      hover: "rgba(11, 92, 109, 0.06)",
      selected: "rgba(11, 92, 109, 0.10)",
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
          backgroundColor: theme.palette.background.default,
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
          boxShadow: `0 1px 2px ${alpha(ink, 0.04)}, 0 4px 18px ${alpha(ink, 0.03)}`,
          border: `1px solid ${alpha(theme.palette.divider, 1)}`,
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
    MuiIconButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 10,
          "&:focus-visible": {
            outline: `2px solid ${alpha(theme.palette.primary.main, 0.5)}`,
            outlineOffset: 2,
          },
        }),
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 10,
          backgroundColor: theme.palette.background.paper,
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
    MuiTabs: {
      styleOverrides: {
        root: ({ theme }) => ({
          minHeight: 44,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }),
        indicator: ({ theme }) => ({
          height: 3,
          borderRadius: "3px 3px 0 0",
          backgroundColor: theme.palette.primary.main,
        }),
      },
    },
    MuiTab: {
      styleOverrides: {
        root: ({ theme }) => ({
          textTransform: "none",
          fontWeight: 600,
          minHeight: 44,
          paddingInline: 18,
          color: theme.palette.text.secondary,
          "&.Mui-selected": {
            color: theme.palette.primary.dark,
          },
          "&:hover": {
            color: theme.palette.primary.main,
            backgroundColor: alpha(theme.palette.primary.main, 0.04),
          },
        }),
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: theme.palette.surface?.subtle || surfaceSubtle,
          "& .MuiTableCell-root": {
            fontWeight: 700,
            color: theme.palette.text.secondary,
            letterSpacing: "0.02em",
            fontSize: "0.8125rem",
            textTransform: "uppercase",
            borderBottom: `1px solid ${theme.palette.divider}`,
          },
        }),
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderBottom: `1px solid ${theme.palette.divider}`,
          paddingTop: 14,
          paddingBottom: 14,
        }),
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: ({ theme }) => ({
          "&:last-child .MuiTableCell-root": {
            borderBottom: 0,
          },
          "&.MuiTableRow-hover:hover": {
            backgroundColor: theme.palette.action.hover,
          },
        }),
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: alpha(theme.palette.text.primary, 0.06),
        }),
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: ({ theme }) => ({
          backgroundColor: alpha(theme.palette.text.primary, 0.92),
          color: theme.palette.common.white,
          fontSize: "0.8125rem",
          fontWeight: 500,
          padding: "6px 10px",
          borderRadius: 8,
        }),
        arrow: ({ theme }) => ({
          color: alpha(theme.palette.text.primary, 0.92),
        }),
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: ({ theme }) => ({
          borderRadius: theme.shape.borderRadius * 1.25,
          boxShadow: `0 12px 48px ${alpha(ink, 0.12)}, 0 2px 6px ${alpha(ink, 0.06)}`,
        }),
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          fontSize: "1.125rem",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: ({ theme }) => ({
          backgroundColor: theme.palette.background.paper,
          borderRight: `1px solid ${theme.palette.divider}`,
        }),
      },
    },
    MuiMenu: {
      defaultProps: {
        elevation: 8,
      },
      styleOverrides: {
        paper: ({ theme }) => ({
          borderRadius: 10,
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: `0 8px 28px ${alpha(ink, 0.10)}, 0 2px 4px ${alpha(ink, 0.05)}`,
        }),
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 6,
          margin: "2px 4px",
          minHeight: 36,
          "&.Mui-selected": {
            backgroundColor: alpha(theme.palette.primary.main, 0.10),
          },
        }),
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 8,
          paddingTop: 8,
          paddingBottom: 8,
          "&.Mui-selected": {
            backgroundColor: alpha(theme.palette.primary.main, 0.11),
            "&:hover": {
              backgroundColor: alpha(theme.palette.primary.main, 0.15),
            },
          },
        }),
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }),
      },
    },
    MuiBreadcrumbs: {
      styleOverrides: {
        root: ({ theme }) => ({
          fontSize: "0.875rem",
          color: theme.palette.text.secondary,
          "& a": {
            color: theme.palette.text.secondary,
            textDecoration: "none",
            "&:hover": {
              color: theme.palette.primary.main,
              textDecoration: "underline",
            },
          },
        }),
        separator: ({ theme }) => ({
          color: alpha(theme.palette.text.secondary, 0.5),
        }),
      },
    },
  },
});
