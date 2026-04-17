import { useId } from "react";
import { Box } from "@mui/material";

/**
 * Wordless mark: clinical shield + ECG pulse (trust + monitoring).
 * Uses currentColor so parent can set `color` / theme.
 */
function BrandLogo({ size = 40, animated = true, "aria-hidden": ariaHidden = true }) {
  const uid = useId().replace(/:/g, "");
  const gradId = `brandLogoGrad-${uid}`;

  return (
    <Box
      component="svg"
      viewBox="0 0 64 64"
      aria-hidden={ariaHidden}
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        overflow: "visible",
      }}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: "currentColor" }} stopOpacity={1} />
          <stop offset="100%" style={{ stopColor: "currentColor" }} stopOpacity={0.65} />
        </linearGradient>
      </defs>
      <path
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={2.4}
        strokeLinejoin="round"
        strokeLinecap="round"
        d="M32 6 52 15v19c0 14-9 22-20 26-11-4-20-12-20-26V15L32 6z"
        opacity={0.35}
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        d="M32 6 52 15v19c0 14-9 22-20 26-11-4-20-12-20-26V15L32 6z"
      />
      <path
        className={animated ? "mq-logo-ecg" : undefined}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 34h6l3-9 5 18 6-22 5 16 4-6h11"
        pathLength={100}
      />
      <circle cx="50" cy="31" r="3.2" fill="currentColor" opacity={0.9} />
    </Box>
  );
}

export default BrandLogo;
