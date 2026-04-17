import { useId } from "react";
import { Box } from "@mui/material";

/** Compact inline SVG for empty lists (no external assets). */
function EmptyWorkspaceIllustration({ size = 112 }) {
  const uid = useId().replace(/:/g, "");
  const gid = `ewi-grad-${uid}`;
  return (
    <Box
      component="svg"
      viewBox="0 0 120 120"
      width={size}
      height={size}
      aria-hidden
      sx={{ display: "block", mx: "auto", mb: 2, opacity: 0.92 }}
    >
      <defs>
        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0c6475" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#0a7d94" stopOpacity="0.12" />
        </linearGradient>
      </defs>
      <rect x="12" y="8" width="96" height="104" rx="12" fill={`url(#${gid})`} stroke="#0c6475" strokeWidth="1.5" opacity="0.25" />
      <path
        fill="none"
        stroke="#0c6475"
        strokeWidth="2.2"
        strokeLinecap="round"
        d="M28 42h64M28 58h40M28 74h52"
        opacity="0.45"
      />
      <path
        fill="none"
        stroke="#0c6475"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M38 28h44l8 10v52H30V38l8-10z"
        opacity="0.55"
      />
      <circle cx="88" cy="32" r="6" fill="#0c6475" opacity="0.35" />
    </Box>
  );
}

export default EmptyWorkspaceIllustration;
