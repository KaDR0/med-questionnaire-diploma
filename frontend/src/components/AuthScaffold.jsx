import { Box } from "@mui/material";
import LanguageSwitcher from "./LanguageSwitcher";

/**
 * Centered auth/marketing pages: provides top-right language switcher + full-width background.
 * Pass additional `sx` on the root via `sx` prop (e.g. flex centering for login).
 */
export default function AuthScaffold({ children, sx = {} }) {
  return (
    <Box
      className="mq-workspace-bg"
      sx={{
        minHeight: "100vh",
        position: "relative",
        ...sx,
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: { xs: 12, sm: 16 },
          right: { xs: 12, sm: 24 },
          zIndex: 2,
        }}
      >
        <LanguageSwitcher showLabel={false} compact />
      </Box>
      {children}
    </Box>
  );
}
