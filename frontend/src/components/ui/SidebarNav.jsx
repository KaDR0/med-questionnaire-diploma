import {
  Badge,
  Box,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Link, useLocation, matchPath } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LogoLockup from "../brand/LogoLockup";

/**
 * Sidebar navigation rendered inside both the doctor/chief AppShell and the patient PatientShell.
 *
 * Props:
 * - groups: Array<{ id: string, label: string, items: NavItem[] }>
 * - homeTo: string         — logo link target
 * - footer?: ReactNode     — optional bottom slot (e.g. workspace footnote)
 *
 * NavItem: {
 *   id: string,
 *   label: string,
 *   to: string,
 *   icon?: ReactElement,
 *   badge?: number | string,
 *   matchPaths?: string[]  — extra route patterns that should mark this item as active
 * }
 *
 * Active matching:
 *   - exact equality on pathname, OR
 *   - any matchPath() against item.to or any of item.matchPaths
 */
export default function SidebarNav({ groups = [], homeTo = "/", footer = null }) {
  const location = useLocation();
  const { t } = useTranslation();

  const isItemActive = (item) => {
    const path = location.pathname;
    if (path === item.to) return true;
    const patterns = [item.to, ...(item.matchPaths || [])];
    return patterns.some((p) => {
      if (!p) return false;
      // Treat `/foo` as a prefix match for `/foo/*`
      if (p === "/") return path === "/";
      return matchPath({ path: p, end: false }, path) !== null;
    });
  };

  return (
    <Box
      component="aside"
      aria-label={t("navbar.mainNav")}
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        p: 2,
        gap: 1.5,
      }}
    >
      <Box sx={{ px: 0.5 }}>
        <LogoLockup variant="sidebar" caption="subtitle" to={homeTo} />
      </Box>

      <Divider sx={{ borderColor: "divider" }} />

      <Box
        component="nav"
        aria-label={t("navbar.mainNav")}
        sx={{
          flex: 1,
          overflowY: "auto",
          mr: -1,
          pr: 1,
          // Slim scrollbar for the nav rail
          "&::-webkit-scrollbar": { width: 6 },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: (theme) => alpha(theme.palette.text.primary, 0.12),
            borderRadius: 3,
          },
        }}
      >
        <Stack spacing={1.25}>
          {groups.map((group) => (
            <List
              key={group.id}
              dense
              disablePadding
              subheader={
                group.label ? (
                  <ListSubheader
                    component="div"
                    disableSticky
                    sx={{
                      px: 1.25,
                      py: 0.5,
                      lineHeight: 1.4,
                      bgcolor: "transparent",
                      color: "text.secondary",
                      fontSize: "0.6875rem",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                    }}
                  >
                    {group.label}
                  </ListSubheader>
                ) : undefined
              }
            >
              {group.items.map((item) => {
                const active = isItemActive(item);
                return (
                  <ListItemButton
                    key={item.id}
                    component={Link}
                    to={item.to}
                    selected={active}
                    aria-current={active ? "page" : undefined}
                    sx={{
                      mb: 0.25,
                      pl: 1.5,
                      pr: 1,
                      borderLeft: "3px solid",
                      borderLeftColor: active ? "primary.main" : "transparent",
                      borderRadius: "0 10px 10px 0",
                      transition: "background-color 0.15s ease, border-color 0.15s ease",
                    }}
                  >
                    {item.icon ? (
                      <ListItemIcon
                        sx={{
                          minWidth: 34,
                          color: active ? "primary.dark" : "text.secondary",
                          "& .MuiSvgIcon-root": { fontSize: 20 },
                        }}
                      >
                        {item.icon}
                      </ListItemIcon>
                    ) : null}
                    <ListItemText
                      primary={item.label}
                      slotProps={{
                        primary: {
                          sx: {
                            fontWeight: 600,
                            fontSize: "0.9375rem",
                            color: active ? "text.primary" : "text.primary",
                          },
                        },
                      }}
                    />
                    {item.badge !== undefined && item.badge !== null && item.badge !== 0 ? (
                      <Badge
                        color={item.badgeColor || "primary"}
                        badgeContent={item.badge}
                        max={99}
                        sx={{
                          mr: 1,
                          "& .MuiBadge-badge": {
                            position: "static",
                            transform: "none",
                            fontWeight: 700,
                            fontSize: "0.6875rem",
                            height: 18,
                            minWidth: 18,
                            px: 0.6,
                            borderRadius: 9,
                          },
                        }}
                      />
                    ) : null}
                  </ListItemButton>
                );
              })}
            </List>
          ))}
        </Stack>
      </Box>

      {footer ? (
        <>
          <Divider sx={{ borderColor: "divider" }} />
          <Box sx={{ pt: 0.5 }}>{footer}</Box>
        </>
      ) : null}
    </Box>
  );
}

export function SidebarFootnote({ children }) {
  return (
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: "block", lineHeight: 1.45 }}
    >
      {children}
    </Typography>
  );
}
