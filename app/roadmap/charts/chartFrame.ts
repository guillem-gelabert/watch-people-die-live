// Drawing scaffolding shared by the story's SVG figures. The five amplitude scatters used to
// carry an identical copy-pasted block of margins, domains and tick logic; the design handoff
// gives each chart its own margins on purpose, so what is shared here is the *rules* (how a
// percent grid is spaced, how a fit line is computed, how a dot's alpha encodes income) rather
// than one frame every chart has to fit into.
//
// Everything is pure except the two d3 append helpers at the bottom, so the rules can be
// unit-tested under the node-environment Vitest config.
import * as d3 from "d3";

// The five seasonality proxies, keyed by identity. This order is the design's `data-proxy`
// index: it drives each proxy's colour and the reader's "Your #N" note, so it must never be
// reordered to match how the charts happen to appear on the page.
export const PROXY = {
  gdp: 0,
  neighbour: 1,
  climate: 2,
  latitude: 3,
  pop65: 4,
} as const;

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// Per-figure margins from the handoff. The latitude chart's deep top margin holds the
// tropic/polar-circle captions; the Köppen chart's deep bottom margin holds the zone labels
// above its axis title; the curve chart has almost no left margin because it has no y-axis.
export const MARGINS: Record<"latitude" | "koppen" | "amp" | "curve", Margin> = {
  latitude: { top: 46, right: 14, bottom: 30, left: 36 },
  koppen: { top: 20, right: 10, bottom: 42, left: 36 },
  amp: { top: 14, right: 12, bottom: 32, left: 42 },
  curve: { top: 16, right: 26, bottom: 24, left: 14 },
};

// The amplitude scatters share one fixed y-domain in percent so the three read against each
// other: a proxy that explains nothing looks flat next to one that doesn't. Ticks are placed by
// hand rather than by d3 — evenly spaced round numbers inside a domain whose ends are deliberate
// padding, not data.
export const AMP_Y_DOMAIN: [number, number] = [-2, 32];
export const AMP_Y_TICKS = [0, 10, 20, 30];

// The curve chart's y-domain, as a multiple of a country's own annual mean. Fixed, so adding a
// flatter country doesn't rescale away the shape of the ones already on screen.
export const CURVE_Y_DOMAIN: [number, number] = [0.78, 1.34];

// Gridline spacing for an axis labelled in percent: every 10 points, or every 5 when the data
// is shallow enough that 10 would leave two lines on the whole chart.
export function percentGridStep(max: number): number {
  return max <= 25 ? 5 : 10;
}

export function percentGridValues(max: number): number[] {
  const step = percentGridStep(max);
  const out: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(Math.round(v));
  return out;
}

// Round a percent maximum up to the next gridline so the topmost line is also the frame's top.
export function niceMaxPercent(max: number): number {
  const step = percentGridStep(max);
  return Math.max(step, Math.ceil(max / step) * step);
}

export interface Fit {
  slope: number;
  intercept: number;
  r: number;
}

// Ordinary least squares. Returns null rather than a degenerate line when there is nothing to
// fit (fewer than two points, or no spread in x), so callers can simply skip drawing.
export function olsFit(points: [number, number][]): Fit | null {
  const n = points.length;
  if (n < 2) return null;
  const mx = d3.mean(points, (p) => p[0]) ?? 0;
  const my = d3.mean(points, (p) => p[1]) ?? 0;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [x, y] of points) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  return {
    slope,
    intercept: my - slope * mx,
    r: syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy),
  };
}

export function fitAt(fit: Fit, x: number): number {
  return fit.slope * x + fit.intercept;
}

// Dot opacity carries income as a second, quiet dimension: richer countries sit more solidly on
// the page. Spread over log10 GDP because the raw range is three orders of magnitude, and
// mid-range for a country with no GDP figure so a gap never reads as "poorest".
export function gdpAlphaScale(
  gdps: (number | undefined | null)[],
): (gdp: number | undefined | null) => number {
  const logs = gdps
    .filter((g): g is number => typeof g === "number" && g > 0)
    .map((g) => Math.log10(g));
  const lo = d3.min(logs);
  const hi = d3.max(logs);
  return (gdp) => {
    if (typeof gdp !== "number" || gdp <= 0 || lo === undefined || hi === undefined) return 0.5;
    if (hi === lo) return 0.5;
    const t = (Math.log10(gdp) - lo) / (hi - lo);
    return 0.35 + Math.min(1, Math.max(0, t)) * 0.65;
  };
}

// The handoff scatters its synthetic points with a sine hash rather than Math.random so a
// repaint — and there is one on every sky change — never makes a dot jump. Ours have real
// coordinates, but the same trick spreads ties inside a categorical column.
export function hashUnit(a: number, b: number): number {
  const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

// hashUnit mapped to [-1, 1], the form jitter is actually used in.
export function hashJitter(a: number, b: number): number {
  return hashUnit(a, b) * 2 - 1;
}

// Percentile of a sorted-ascending array by nearest rank — the spread band behind each Köppen
// column is a p10–p90, and interpolating between neighbours would imply precision that 9
// countries in a bucket don't have.
export function quantileByRank(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.round((sorted.length - 1) * p));
  return sorted[i] as number;
}

type Sel = d3.Selection<SVGGElement, unknown, null, undefined>;

// A single rule under the plot. Most of the story's charts have no y-spine: the gridlines
// already carry the scale, and a second full-height line only adds ink.
export function appendBaseline(g: Sel, x0: number, x1: number, y: number): void {
  g.append("line")
    .attr("class", "chart-axis")
    .attr("x1", x0)
    .attr("x2", x1)
    .attr("y1", y)
    .attr("y2", y);
}

export interface AxisTitleOptions {
  x: number;
  y: number;
  text: string;
  rotate?: boolean;
  anchor?: "start" | "middle" | "end";
}

export function appendAxisTitle(g: Sel, options: AxisTitleOptions): void {
  const t = g
    .append("text")
    .attr("class", "chart-label")
    .attr("text-anchor", options.anchor ?? "middle")
    .text(options.text);
  if (options.rotate) t.attr("transform", `translate(${options.x},${options.y}) rotate(-90)`);
  else t.attr("x", options.x).attr("y", options.y);
}
