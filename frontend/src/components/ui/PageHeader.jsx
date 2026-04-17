import { Box, Divider, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

function PageHeader({ title, subtitle, actions }) {
  return (
    <Stack
      direction={{ xs: "column", lg: "row" }}
      justifyContent="space-between"
      alignItems={{ xs: "stretch", lg: "flex-start" }}
      spacing={2.5}
      sx={{ mb: 3.5 }}
    >
      <Box sx={{ minWidth: 0, flex: { lg: "1 1 40%" } }}>
        <Typography variant="h4" className="mq-animate-fade-up" sx={{ mb: subtitle ? 1 : 0, color: "text.primary" }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography
            variant="body1"
            color="text.secondary"
            className="mq-animate-fade-up-delay"
            sx={{ maxWidth: 680, lineHeight: 1.65 }}
          >
            {subtitle}
          </Typography>
        ) : null}
        <Divider
          sx={{
            mt: 2,
            maxWidth: subtitle ? 560 : 320,
            borderColor: (theme) => alpha(theme.palette.primary.main, 0.14),
          }}
        />
      </Box>
      {actions ? (
        <Box
          sx={{
            width: { xs: "100%", lg: "auto" },
            flex: { lg: "0 0 auto" },
            alignSelf: { lg: "flex-start" },
          }}
        >
          {actions}
        </Box>
      ) : null}
    </Stack>
  );
}

export default PageHeader;
