import { useId, useMemo, useRef, useState, useCallback } from "react";
import { Box, Paper, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { alpha } from "@mui/material/styles";
import { linearNiceTicks, padYDomain } from "../../utils/chartScale";

const VIEW_W = 440;
const VIEW_H = 248;
const M = { top: 14, right: 18, bottom: 46, left: 52 };

/**
 * Line / area chart with Y scale, horizontal grid, sparse X date labels.
 */
function MedicalLineChart({
  points,
  getY,
  getKey = (_, i) => i,
  segmentColor,
  pointColor,
  showArea = true,
  formatY = (v) => (Math.abs(v - Math.round(v)) < 1e-6 ? String(Math.round(v)) : v.toFixed(2)),
  formatX,
  pointTitle,
  /** Short label above/below each point (e.g. questionnaire name). */
  pointCaption,
}) {
  const theme = useTheme();
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null);
  const uid = useId().replace(/:/g, "");
  const gradId = `mlc-grad-${uid}`;
  const clipId = `mlc-clip-${uid}`;

  const layout = useMemo(() => {
    if (!points?.length || points.length < 2) return null;
    const ys = points.map((p) => getY(p));
    const rawMin = Math.min(...ys);
    const rawMax = Math.max(...ys);
    const padded = padYDomain(rawMin, rawMax, 0.1);
    const { min: y0, max: y1, ticks } = linearNiceTicks(padded.min, padded.max, 5);

    const plotTop = pointCaption ? 36 : M.top;
    const innerW = VIEW_W - M.left - M.right;
    const innerH = VIEW_H - plotTop - M.bottom;
    const n = points.length;
    const xAt = (i) => M.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const yAt = (v) => plotTop + innerH - ((v - y0) / (y1 - y0)) * innerH;

    const lineD = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(getY(p))}`)
      .join(" ");
    const lastX = xAt(n - 1);
    const firstX = xAt(0);
    const baseY = plotTop + innerH;
    const areaD = `${lineD} L ${lastX},${baseY} L ${firstX},${baseY} Z`;

    const xLabelIdx = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i);

    return { y0, y1, ticks, xAt, yAt, innerW, innerH, lineD, areaD, xLabelIdx, baseY, plotTop };
  }, [points, getY, pointCaption]);

  if (!layout) return null;

  const { y0, y1, ticks, xAt, yAt, innerW, innerH, lineD, areaD, xLabelIdx, baseY, plotTop } = layout;
  const n = points.length;
  const gridStroke = alpha(theme.palette.text.primary, 0.1);
  const axisStroke = alpha(theme.palette.text.primary, 0.22);
  const labelFill = theme.palette.text.secondary;

  const tooltipText = useCallback(
    (point, i) => {
      if (pointTitle) return pointTitle(point, i);
      if (formatX) return `${formatX(point, i)} · ${formatY(getY(point))}`;
      return formatY(getY(point));
    },
    [pointTitle, formatX, formatY, getY],
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

  const onPointEnter = useCallback(
    (e, point, i) => {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setHover({
        left: e.clientX - rect.left,
        top: e.clientY - rect.top,
        text: tooltipText(point, i),
      });
    },
    [tooltipText],
  );

  return (
    <Box ref={wrapRef} sx={{ position: "relative", width: "100%" }}>
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", maxHeight: 280 }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.palette.primary.main} stopOpacity={0.22} />
          <stop offset="100%" stopColor={theme.palette.primary.main} stopOpacity={0.04} />
        </linearGradient>
        <clipPath id={clipId}>
          <rect x={M.left} y={plotTop} width={innerW} height={innerH} rx={6} />
        </clipPath>
      </defs>

      <rect
        x={M.left}
        y={plotTop}
        width={innerW}
        height={innerH}
        rx={8}
        fill={alpha(theme.palette.primary.main, 0.04)}
        stroke={alpha(theme.palette.primary.main, 0.12)}
        strokeWidth={1}
      />

      {ticks.map((tv) => {
        const yy = yAt(tv);
        if (yy < plotTop - 1 || yy > plotTop + innerH + 1) return null;
        return (
          <g key={`yt-${tv}`}>
            <line
              x1={M.left}
              y1={yy}
              x2={M.left + innerW}
              y2={yy}
              stroke={gridStroke}
              strokeWidth={1}
              strokeDasharray="4 6"
            />
            <text
              x={M.left - 10}
              y={yy}
              fill={labelFill}
              fontSize={11}
              fontWeight={600}
              textAnchor="end"
              dominantBaseline="middle"
              style={{ fontFamily: theme.typography.fontFamily }}
            >
              {formatY(tv)}
            </text>
          </g>
        );
      })}

      <line x1={M.left} y1={plotTop} x2={M.left} y2={baseY} stroke={axisStroke} strokeWidth={1.5} />

      <g clipPath={`url(#${clipId})`}>
        {showArea ? <path d={areaD} fill={`url(#${gradId})`} /> : null}
        {points.slice(1).map((point, index) => {
          const prev = points[index];
          const c = segmentColor(prev, point, index);
          return (
            <line
              key={`seg-${getKey(point, index + 1)}`}
              x1={xAt(index)}
              y1={yAt(getY(prev))}
              x2={xAt(index + 1)}
              y2={yAt(getY(point))}
              stroke={c}
              strokeWidth={2.75}
              strokeLinecap="round"
            />
          );
        })}
        {points.map((point, i) => {
          const c = pointColor(point, i);
          return (
            <circle
              key={`pt-${getKey(point, i)}`}
              cx={xAt(i)}
              cy={yAt(getY(point))}
              r={4.5}
              fill={c}
              stroke={theme.palette.background.paper}
              strokeWidth={2}
            >
              <title>{tooltipText(point, i)}</title>
            </circle>
          );
        })}
      </g>

      <line
        x1={M.left}
        y1={baseY}
        x2={M.left + innerW}
        y2={baseY}
        stroke={axisStroke}
        strokeWidth={1.5}
      />

      {xLabelIdx.map((i) => {
        const p = points[i];
        const tx = xAt(i);
        return (
          <text
            key={`xl-${i}`}
            x={tx}
            y={VIEW_H - 12}
            fill={labelFill}
            fontSize={10}
            fontWeight={600}
            textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
            style={{ fontFamily: theme.typography.fontFamily }}
          >
            {formatX ? formatX(p, i) : ""}
          </text>
        );
      })}

      <g style={{ pointerEvents: "all" }}>
        {points.map((point, i) => (
          <circle
            key={`hit-${getKey(point, i)}`}
            cx={xAt(i)}
            cy={yAt(getY(point))}
            r={18}
            fill="transparent"
            style={{ cursor: "pointer" }}
            onMouseEnter={(e) => onPointEnter(e, point, i)}
            onMouseMove={moveTip}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </g>

      {pointCaption ? (
        <g pointerEvents="none">
          {points.map((point, i) => {
            const raw = pointCaption(point, i);
            if (raw == null || String(raw).trim() === "") return null;
            const s = String(raw);
            const capLen = n <= 4 ? 32 : n <= 8 ? 20 : 14;
            const cap = s.length > capLen ? `${s.slice(0, Math.max(1, capLen - 1))}…` : s;
            const px = xAt(i);
            const py = yAt(getY(point));
            const preferBelow = py < plotTop + innerH * 0.42;
            let ty = preferBelow ? py + 12 : py - 4;
            ty = Math.max(plotTop + 9, Math.min(ty, baseY - 20));
            return (
              <text
                key={`cap-${getKey(point, i)}`}
                x={px}
                y={ty}
                fill={labelFill}
                fontSize={8.75}
                fontWeight={700}
                textAnchor="middle"
                dominantBaseline={preferBelow ? "hanging" : "alphabetic"}
                style={{ fontFamily: theme.typography.fontFamily }}
              >
                {cap}
              </text>
            );
          })}
        </g>
      ) : null}
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

export default MedicalLineChart;
