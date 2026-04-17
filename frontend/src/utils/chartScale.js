/**
 * “Nice” linear ticks for chart Y axes (readable step sizes).
 */
export function linearNiceTicks(dataMin, dataMax, tickTarget = 5) {
  if (!Number.isFinite(dataMin) || !Number.isFinite(dataMax)) {
    return { min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1] };
  }
  if (dataMin === dataMax) {
    const pad = Math.abs(dataMin) < 1e-9 ? 1 : Math.abs(dataMin) * 0.08;
    return {
      min: dataMin - pad,
      max: dataMax + pad,
      ticks: [dataMin - pad, dataMin, dataMax + pad].filter((v, i, a) => a.indexOf(v) === i),
    };
  }
  const span = dataMax - dataMin;
  const rough = span / Math.max(tickTarget - 1, 1);
  const pow10 = 10 ** Math.floor(Math.log10(Math.max(rough, 1e-12)));
  const n = rough / pow10;
  const nice = n <= 1.5 ? 1 : n <= 3 ? 2 : n <= 7 ? 5 : 10;
  const step = nice * pow10;
  const vmin = Math.floor(dataMin / step) * step;
  const vmax = Math.ceil(dataMax / step) * step;
  const ticks = [];
  for (let v = vmin; v <= vmax + step * 1e-9; v += step) {
    ticks.push(Number.parseFloat(v.toPrecision(12)));
  }
  if (ticks.length < 2) ticks.push(vmax);
  return { min: vmin, max: vmax, ticks };
}

export function padYDomain(minY, maxY, ratio = 0.08) {
  const span = maxY - minY;
  const pad = Math.max(span * ratio, 1e-6);
  return { min: minY - pad, max: maxY + pad };
}
