import { useState } from "react";
import {
  Avatar,
  Box,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ru", label: "Русский" },
  { code: "kk", label: "Қазақша" },
];

function initialsOf(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

/**
 * Compact user menu for the TopBar: avatar trigger opens a menu with profile link,
 * language switcher and logout. Profile route is optional (omit for patient role).
 */
export default function UserMenu({ user, onLogout, profileTo, roleLabel }) {
  const { t, i18n } = useTranslation();
  const [anchorEl, setAnchorEl] = useState(null);
  const [langAnchor, setLangAnchor] = useState(null);
  const open = Boolean(anchorEl);
  const langOpen = Boolean(langAnchor);

  const displayName =
    user?.first_name?.trim() || user?.username?.trim() || user?.email?.trim() || "User";
  const initials = initialsOf(
    `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || displayName
  );
  const currentLang = String(i18n.language || "en").split("-")[0].toLowerCase();

  const handleClose = () => setAnchorEl(null);
  const handleLangClose = () => setLangAnchor(null);

  const handleSelectLanguage = (code) => {
    i18n.changeLanguage(code);
    handleLangClose();
    handleClose();
  };

  return (
    <>
      <Tooltip title={t("topbar.openMenu")}>
        <IconButton
          onClick={(e) => setAnchorEl(e.currentTarget)}
          aria-label={t("topbar.openMenu")}
          aria-haspopup="true"
          aria-expanded={open ? "true" : undefined}
          sx={{
            p: 0.5,
            borderRadius: 999,
            transition: "background-color 0.15s ease",
            "&:hover": {
              backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.06),
            },
          }}
        >
          <Avatar
            sx={{
              width: 36,
              height: 36,
              fontSize: "0.875rem",
              fontWeight: 700,
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
              color: "primary.dark",
            }}
          >
            {initials}
          </Avatar>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { mt: 1, minWidth: 240 } } }}
      >
        <Box sx={{ px: 1.5, py: 1.25 }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Avatar
              sx={{
                width: 40,
                height: 40,
                fontWeight: 700,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14),
                color: "primary.dark",
              }}
            >
              {initials}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
                {displayName}
              </Typography>
              {roleLabel ? (
                <Typography variant="caption" color="text.secondary" noWrap>
                  {roleLabel}
                </Typography>
              ) : null}
            </Box>
          </Stack>
        </Box>
        <Divider sx={{ my: 0.5 }} />

        {profileTo ? (
          <MenuItem component={RouterLink} to={profileTo} onClick={handleClose}>
            <ListItemIcon>
              <PersonOutlineRoundedIcon fontSize="small" />
            </ListItemIcon>
            {t("navbar.profile")}
          </MenuItem>
        ) : null}

        <MenuItem onClick={(e) => setLangAnchor(e.currentTarget)}>
          <ListItemIcon>
            <LanguageRoundedIcon fontSize="small" />
          </ListItemIcon>
          {t("navbar.language")}
          <Typography variant="caption" color="text.secondary" sx={{ ml: "auto", pl: 1 }}>
            {currentLang.toUpperCase()}
          </Typography>
        </MenuItem>

        <Divider sx={{ my: 0.5 }} />

        <MenuItem
          onClick={() => {
            handleClose();
            onLogout?.();
          }}
        >
          <ListItemIcon>
            <LogoutRoundedIcon fontSize="small" />
          </ListItemIcon>
          {t("navbar.logout")}
        </MenuItem>
      </Menu>

      <Menu
        anchorEl={langAnchor}
        open={langOpen}
        onClose={handleLangClose}
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { minWidth: 160 } } }}
      >
        {LANGUAGES.map((lang) => {
          const selected = lang.code === currentLang;
          return (
            <MenuItem
              key={lang.code}
              selected={selected}
              onClick={() => handleSelectLanguage(lang.code)}
            >
              <ListItemIcon>
                {selected ? <CheckRoundedIcon fontSize="small" /> : <Box sx={{ width: 20 }} />}
              </ListItemIcon>
              {lang.label}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
