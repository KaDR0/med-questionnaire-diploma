import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Link as RouterLink } from "react-router-dom";

/**
 * Compact KPI tile for dashboards.
 *
 * Props:
 * - label: string                    — short uppercase caption
 * - value: number | string           — primary metric value
 * - icon?: ReactElement              — material icon component
 * - tone?: "primary" | "info" | "success" | "warning" | "error"
 * - hint?: ReactNode                 — small caption below the value (e.g. "+3 this week")
 * - to?: string                      — when provided, the whole card becomes a router link
 * - emphasised?: boolean             — slightly stronger background tint (for alert-like KPIs)
 *
 * Visual design: a thin colored leading bar (4px) keeps the card calm while still encoding
 * meaning via color. Icon lives in a soft tinted circle on the right — never larger than the
 * number, never competing with it for attention.
 */
export default function KpiCard({
  label,
  value,
  icon = null,
  tone = "primary",
  hint = null,
  to = null,
  emphasised = false,
}) {
  const theme = useTheme();
  const paletteKey =
    ["primary", "info", "success", "warning", "error"].includes(tone) ? tone : "primary";
  const baseColor = theme.palette[paletteKey].main;
  const bgTint = alpha(baseColor, emphasised ? 0.08 : 0.05);

  const clickable = Boolean(to);
  const cardSx = {
    height: "100%",
    overflow: "hidden",
    background: `linear-gradient(135deg, ${bgTint} 0%, ${theme.palette.background.paper} 55%, ${theme.palette.background.paper} 100%)`,
    transition: "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
    ...(clickable && {
      cursor: "pointer",
      "&:hover": {
        transform: "translateY(-1px)",
        borderColor: alpha(baseColor, 0.35),
        boxShadow: `0 8px 24px ${alpha(baseColor, 0.1)}`,
      },
      "&:focus-visible": {
        outline: `2px solid ${alpha(baseColor, 0.55)}`,
        outlineOffset: 2,
      },
    }),
  };

  const linkProps = clickable
    ? { component: RouterLink, to, role: "link", tabIndex: 0 }
    : {};

  return (
    <Card {...linkProps} sx={cardSx} aria-label={typeof label === "string" ? label : undefined}>
      <Box sx={{ display: "flex", minHeight: 104 }}>
        <Box
          sx={{
            width: 4,
            flexShrink: 0,
            bgcolor: baseColor,
            opacity: 0.92,
            borderRadius: "10px 0 0 10px",
          }}
          aria-hidden
        />
        <CardContent sx={{ flex: 1, py: 2, px: 2.25, "&:last-child": { pb: 2 } }}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1.5}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  color: "text.secondary",
                  display: "block",
                  textTransform: "uppercase",
                  fontSize: "0.6875rem",
                }}
              >
                {label}
              </Typography>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  mt: 0.5,
                  letterSpacing: "-0.02em",
                  color: "text.primary",
                  lineHeight: 1.1,
                }}
              >
                {value}
              </Typography>
              {hint ? (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: 0.75 }}
                >
                  {hint}
                </Typography>
              ) : null}
            </Box>
            {icon ? (
              <Box
                aria-hidden
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: alpha(baseColor, 0.12),
                  color: baseColor,
                  flexShrink: 0,
                  "& .MuiSvgIcon-root": { fontSize: 22 },
                }}
              >
                {icon}
              </Box>
            ) : null}
          </Stack>
        </CardContent>
      </Box>
    </Card>
  );
}
