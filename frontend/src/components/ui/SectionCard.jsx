import { Card, CardContent, Divider, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

function SectionCard({ title, subtitle, children, contentSx }) {
  return (
    <Card>
      <CardContent sx={{ p: { xs: 2.75, md: 3.25 }, ...(contentSx || {}) }}>
        {title ? (
          <>
            <Typography variant="h6" className="mq-animate-fade-up" sx={{ letterSpacing: "-0.01em" }}>
              {title}
            </Typography>
            {subtitle ? (
              <Typography
                variant="body2"
                color="text.secondary"
                className="mq-animate-fade-up-delay"
                sx={{ mb: 1.75, mt: 0.5, lineHeight: 1.6 }}
              >
                {subtitle}
              </Typography>
            ) : null}
            <Divider sx={{ mb: 2.25, borderColor: (theme) => alpha(theme.palette.divider, 0.85) }} />
          </>
        ) : null}
        {children}
      </CardContent>
    </Card>
  );
}

export default SectionCard;
