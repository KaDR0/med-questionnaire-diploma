import { AppBar, Box, IconButton, Stack, Toolbar, Tooltip } from "@mui/material";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import { useTranslation } from "react-i18next";
import BreadcrumbsBar from "./BreadcrumbsBar";
import UserMenu from "./UserMenu";

/**
 * Sticky top header shared by both shells. Hosts breadcrumbs, contextual actions and the
 * user menu. The sidebar toggle is shown on small screens; supply `onToggleSidebar` to wire it.
 *
 * Props:
 * - homeTo: string                         — breadcrumbs "Home" target
 * - user: { first_name, last_name, ... }   — current user
 * - roleLabel?: string                     — caption shown under the user's name
 * - profileTo?: string                     — link to a profile page (omit for patient role)
 * - onLogout: () => void
 * - onToggleSidebar?: () => void           — open mobile drawer
 * - actions?: ReactNode                    — slot for page-level actions (e.g. notifications)
 */
export default function TopBar({
  homeTo = "/",
  user,
  roleLabel,
  profileTo,
  onLogout,
  onToggleSidebar,
  actions = null,
}) {
  const { t } = useTranslation();

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        zIndex: (theme) => theme.zIndex.appBar,
      }}
    >
      <Toolbar
        disableGutters
        sx={{
          minHeight: 60,
          px: { xs: 1.5, md: 3 },
          gap: 1.5,
          display: "flex",
          alignItems: "center",
        }}
      >
        {onToggleSidebar ? (
          <Tooltip title={t("topbar.toggleMenu")}>
            <IconButton
              edge="start"
              onClick={onToggleSidebar}
              aria-label={t("topbar.toggleMenu")}
              sx={{ display: { lg: "none" }, mr: 0.5 }}
            >
              <MenuRoundedIcon />
            </IconButton>
          </Tooltip>
        ) : null}

        <Box sx={{ minWidth: 0, flex: 1, display: "flex", alignItems: "center" }}>
          <BreadcrumbsBar homeTo={homeTo} />
        </Box>

        <Stack direction="row" alignItems="center" spacing={1} sx={{ flexShrink: 0 }}>
          {actions}
          {user ? (
            <UserMenu
              user={user}
              roleLabel={roleLabel}
              profileTo={profileTo}
              onLogout={onLogout}
            />
          ) : null}
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
