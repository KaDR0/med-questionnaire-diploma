import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import BrandLogo from "./BrandLogo";

/**
 * @param {"sidebar" | "toolbar" | "hero"} variant
 * @param {"subtitle" | "brand"} caption — second line under title
 */
function LogoLockup({
  variant = "sidebar",
  disableLink = false,
  to = "/",
  showTitle = true,
  showCaption = true,
  caption = "subtitle",
  animatedCaption = false,
}) {
  const { t } = useTranslation();
  const isHero = variant === "hero";
  const captionText = caption === "brand" ? t("brand.tagline") : t("navbar.subtitle");

  const logoShellSx = {
    color: "primary.main",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    ...(variant === "sidebar" && {
      p: 0.75,
      borderRadius: 2,
      bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === "light" ? 0.09 : 0.16),
    }),
  };

  const inner =
    !showTitle && isHero ? (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 1.25,
        }}
      >
        <Box sx={logoShellSx}>
          <BrandLogo size={64} />
        </Box>
        {showCaption ? (
          <Typography
            variant="body2"
            color="text.secondary"
            className={animatedCaption ? "mq-animate-float" : undefined}
            sx={{
              fontWeight: 600,
              letterSpacing: "0.03em",
              maxWidth: 420,
              lineHeight: 1.5,
            }}
          >
            {captionText}
          </Typography>
        ) : null}
      </Box>
    ) : (
      <Box
        sx={{
          display: "flex",
          alignItems: isHero ? "center" : "flex-start",
          gap: isHero ? 2 : 1.5,
          textAlign: isHero ? "center" : "left",
          flexDirection: isHero ? "column" : "row",
        }}
      >
        <Box sx={logoShellSx}>
          <BrandLogo size={isHero ? 56 : variant === "toolbar" ? 36 : 42} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          {showTitle ? (
            <Typography
              variant={isHero ? "h4" : "subtitle1"}
              sx={{
                fontWeight: variant === "toolbar" ? 700 : 800,
                letterSpacing: "-0.03em",
                lineHeight: 1.15,
                color: "text.primary",
                ...(variant === "toolbar" && {
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: { xs: 160, sm: 280, md: 360 },
                }),
                ...(isHero && { fontSize: { xs: "1.5rem", sm: "1.75rem" } }),
              }}
            >
              {t("navbar.title")}
            </Typography>
          ) : null}
          {showCaption ? (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "block",
                mt: showTitle ? 0.35 : 0,
                fontWeight: caption === "brand" ? 600 : 500,
                letterSpacing: caption === "brand" ? "0.02em" : undefined,
                maxWidth: isHero ? 440 : 210,
                ...(isHero && caption === "brand" && { fontSize: "0.95rem" }),
                ...(animatedCaption && { className: "mq-animate-float" }),
              }}
            >
              {captionText}
            </Typography>
          ) : null}
        </Box>
      </Box>
    );

  if (disableLink) return inner;

  return (
    <Box
      component={Link}
      to={to}
      sx={{
        textDecoration: "none",
        color: "inherit",
        display: "block",
        borderRadius: 2,
        outlineOffset: 4,
        transition: "transform 0.25s ease, opacity 0.25s ease",
        "&:hover": { opacity: 0.92, transform: "translateY(-1px)" },
        "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main" },
      }}
    >
      {inner}
    </Box>
  );
}

export default LogoLockup;
