import { Box, Stack, Typography } from "@mui/material";
import EmptyWorkspaceIllustration from "./EmptyWorkspaceIllustration";

/**
 * Empty state for lists, tables, dashboards.
 *
 * Props:
 * - title: string                — main message ("No patients yet")
 * - description?: string         — supporting paragraph
 * - icon?: ReactElement          — custom icon (defaults to clinical illustration)
 * - actions?: ReactNode          — buttons / links rendered under the description
 * - dense?: boolean              — tighter paddings for inline / in-card usage
 */
export default function EmptyState({
  title,
  description = null,
  icon = null,
  actions = null,
  dense = false,
}) {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        textAlign: "center",
        py: dense ? 4 : 6,
        px: 2,
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "center", mb: dense ? 1.5 : 2 }}>
        {icon ? icon : <EmptyWorkspaceIllustration size={dense ? 84 : 112} />}
      </Box>
      <Typography variant={dense ? "subtitle1" : "h6"} sx={{ fontWeight: 700, mb: 1 }}>
        {title}
      </Typography>
      {description ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ maxWidth: 480, mx: "auto", mb: actions ? 2 : 0 }}
        >
          {description}
        </Typography>
      ) : null}
      {actions ? (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.25}
          justifyContent="center"
          sx={{ mt: 1 }}
        >
          {actions}
        </Stack>
      ) : null}
    </Box>
  );
}
