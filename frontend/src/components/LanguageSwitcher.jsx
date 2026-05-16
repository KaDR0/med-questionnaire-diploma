import { MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

const SUPPORTED = ["en", "ru", "kk"];

function normalizeLanguage(lng) {
  if (!lng) return "en";
  const base = String(lng).split("-")[0].toLowerCase();
  return SUPPORTED.includes(base) ? base : "en";
}

/**
 * Unified language control (EN / RU / KK). Uses i18n.changeLanguage; persistence is handled in i18n.js (localStorage).
 */
export default function LanguageSwitcher({
  fullWidth = false,
  showLabel = true,
  size = "small",
  compact = false,
}) {
  const { t, i18n } = useTranslation();
  const value = normalizeLanguage(i18n.language);

  const handleChange = (event) => {
    i18n.changeLanguage(event.target.value);
  };

  return (
    <Stack spacing={compact ? 0 : 0.75} sx={{ width: fullWidth ? "100%" : "auto", minWidth: compact ? 0 : 108 }}>
      {showLabel ? (
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          {t("navbar.language")}
        </Typography>
      ) : null}
      <TextField
        select
        size={size}
        value={value}
        onChange={handleChange}
        fullWidth={fullWidth}
        aria-label={t("navbar.language")}
        sx={{
          ...(!fullWidth && !compact ? { minWidth: 108 } : {}),
          ...(compact ? { maxWidth: 100 } : {}),
        }}
        slotProps={{
          select: {
            "aria-label": t("navbar.language"),
            MenuProps: { disableScrollLock: true },
          },
        }}
      >
        <MenuItem value="en">EN</MenuItem>
        <MenuItem value="ru">RU</MenuItem>
        <MenuItem value="kk">KK</MenuItem>
      </TextField>
    </Stack>
  );
}
