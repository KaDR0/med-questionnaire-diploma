import { useCallback, useRef, useState } from "react";
import { Box, Paper, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { alpha } from "@mui/material/styles";

const VIEW_W = 440;
const VIEW_H = 208;
const M = { top: 10, right: 16, bottom: 42, left: 72 };

const LEVEL_FRAC = {
  critical: 0.1,
  high: 0.28,
  elevated: 0.5,
  moderate: 0.5,
  low: 0.8,
};

/** Band vertical range as fraction of inner height from top (0 = top). */
const BANDS = [
  { key: "critical", y0: 0, y1: 0.18, palette: "error" },
  { key: "high", y0: 0.18, y1: 0.42, palette: "error" },
  { key: "moderate", y0: 0.42, y1: 0.68, palette: "warning" },
  { key: "low", y0: 0.68, y1: 1, palette: "success" },
];

function levelToFrac(level) {
  return LEVEL_FRAC[level] ?? 0.8;
}

/**
 * Step chart for discrete risk levels with labeled bands.
 */
function RiskTimelineChart({ points, colorForLevel, formatDate, axisLabels, formatTooltip }) {
  const theme = useTheme();
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null);

  const innerW = VIEW_W - M.left - M.right;
  const innerH = VIEW_H - M.top - M.bottom;
  const baseY = M.top + innerH;
  const n = points.length;

  const xAt = (i) => M.left + (n <= 1 ? innerW / 2 : (i / Math.max(n - 1, 1)) * innerW);
  const yAt = (level) => M.top + levelToFrac(level) * innerH;

  const gridStroke = alpha(theme.palette.text.primary, 0.12);
  const axisStroke = alpha(theme.palette.text.primary, 0.22);
  const labelFill = theme.palette.text.secondary;

  const tipText = useCallback(
    (point) => {
      if (formatTooltip) return formatTooltip(point);
      return `${formatDate(point.label)}\n${point.overall_risk_level}`;
    },
    [formatDate, formatTooltip],
  );

  const moveTip = useCallback((e) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setHover((prev) =>
      prev
        ? {
            ...prev,
            left: e.clientX - rect.left,
            top: e.clientY - rect.top,
          }
        : prev,
    );
  }, []);

  const onEnter = useCallback(
    (e, point) => {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setHover({
        left: e.clientX - rect.left,
        top: e.clientY - rect.top,
        text: tipText(point),
      });
    },
    [tipText],
  );

  return (
    <Box ref={wrapRef} sx={{ position: "relative", width: "100%" }}>
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", maxHeight: 240 }}
    >
      <rect
        x={M.left}
        y={M.top}
        width={innerW}
        height={innerH}
        rx={8}
        fill={alpha(theme.palette.primary.main, 0.03)}
        stroke={alpha(theme.palette.primary.main, 0.1)}
        strokeWidth={1}
      />

      {BANDS.map((band) => {
        const py0 = M.top + band.y0 * innerH;
        const py1 = M.top + band.y1 * innerH;
        const pal = theme.palette[band.palette];
        return (
          <g key={band.key}>
            <rect
              x={M.left}
              y={py0}
              width={innerW}
              height={Math.max(py1 - py0, 0.5)}
              fill={alpha(pal.main, band.key === "low" ? 0.06 : 0.05)}
            />
            <line
              x1={M.left}
              y1={py1}
              x2={M.left + innerW}
              y2={py1}
              stroke={gridStroke}
              strokeWidth={1}
              strokeDasharray="5 5"
            />
            <text
              x={10}
              y={(py0 + py1) / 2}
              fill={labelFill}
              fontSize={10}
              fontWeight={700}
              dominantBaseline="middle"
              style={{ fontFamily: theme.typography.fontFamily }}
            >
              {axisLabels?.[band.key] ?? band.key}
            </text>
          </g>
        );
      })}

      <line x1={M.left} y1={M.top} x2={M.left} y2={baseY} stroke={axisStroke} strokeWidth={1.5} />

      {points.map((point, index, arr) => {
        if (index === 0) return null;
        const prev = arr[index - 1];
        return (
          <line
            key={`rline-${point.id}`}
            x1={xAt(index - 1)}
            y1={yAt(prev.overall_risk_level)}
            x2={xAt(index)}
            y2={yAt(point.overall_risk_level)}
            stroke={colorForLevel(point.overall_risk_level)}
            strokeWidth={3}
            strokeLinecap="round"
          />
        );
      })}

      {points.map((point, i) => (
        <circle
          key={`rpt-${point.id}`}
          cx={xAt(i)}
          cy={yAt(point.overall_risk_level)}
          r={4.5}
          fill={colorForLevel(point.overall_risk_level)}
          stroke={theme.palette.background.paper}
          strokeWidth={2}
        >
          <title>{tipText(point)}</title>
        </circle>
      ))}

      <g style={{ pointerEvents: "all" }}>
        {points.map((point, i) => (
          <circle
            key={`rhit-${point.id}`}
            cx={xAt(i)}
            cy={yAt(point.overall_risk_level)}
            r={18}
            fill="transparent"
            style={{ cursor: "pointer" }}
            onMouseEnter={(e) => onEnter(e, point)}
            onMouseMove={moveTip}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </g>

      <line
        x1={M.left}
        y1={baseY}
        x2={M.left + innerW}
        y2={baseY}
        stroke={axisStroke}
        strokeWidth={1.5}
      />

      {[0, Math.floor((n - 1) / 2), n - 1]
        .filter((v, i, a) => a.indexOf(v) === i)
        .map((i) => (
          <text
            key={`rx-${i}`}
            x={xAt(i)}
            y={VIEW_H - 10}
            fill={labelFill}
            fontSize={10}
            fontWeight={600}
            textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
            style={{ fontFamily: theme.typography.fontFamily }}
          >
            {formatDate(points[i]?.label)}
          </text>
        ))}
    </svg>

      {hover ? (
        <Paper
          elevation={6}
          sx={{
            position: "absolute",
            left: hover.left + 10,
            top: hover.top,
            transform: "translateY(calc(-100% - 10px))",
            pointerEvents: "none",
            zIndex: 20,
            px: 1.5,
            py: 1.1,
            maxWidth: 280,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
            boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, 0.12)}`,
          }}
        >
          <Typography variant="caption" sx={{ display: "block", whiteSpace: "pre-wrap", fontWeight: 600, lineHeight: 1.45 }}>
            {hover.text}
          </Typography>
        </Paper>
      ) : null}
    </Box>
  );
}

export default RiskTimelineChart;
