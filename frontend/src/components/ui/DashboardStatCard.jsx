import { Box, Card, CardContent, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

/**
 * @param {"primary" | "info" | "success"} accent
 */
function DashboardStatCard({ label, value, accent = "primary" }) {
  const theme = useTheme();
  const bar =
    accent === "info"
      ? theme.palette.info.main
      : accent === "success"
        ? theme.palette.success.main
        : theme.palette.primary.main;
  const tint =
    accent === "info"
      ? alpha(theme.palette.info.main, 0.08)
      : accent === "success"
        ? alpha(theme.palette.success.main, 0.09)
        : alpha(theme.palette.primary.main, 0.08);

  return (
    <Card
      sx={{
        overflow: "hidden",
        height: "100%",
        background: `linear-gradient(135deg, ${tint} 0%, ${theme.palette.background.paper} 48%, ${theme.palette.background.paper} 100%)`,
      }}
    >
      <Box sx={{ display: "flex", minHeight: 96 }}>
        <Box
          sx={{
            width: 4,
            flexShrink: 0,
            bgcolor: bar,
            opacity: 0.92,
            borderRadius: "10px 0 0 10px",
          }}
          aria-hidden
        />
        <CardContent sx={{ flex: 1, py: 2, px: 2.25, "&:last-child": { pb: 2 } }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: "0.04em" }}>
            {label}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.75, letterSpacing: "-0.02em", color: "text.primary" }}>
            {value}
          </Typography>
        </CardContent>
      </Box>
    </Card>
  );
}

export default DashboardStatCard;
