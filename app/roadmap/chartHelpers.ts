import * as d3 from "d3";
import { showTooltip, hideTooltip } from "./tooltip";

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
export const fmtPct = d3.format("+.0%");
export const fmtPlainPct = d3.format(".0%");

export function rotateSix(values: number[]): number[] {
  return values.slice(6).concat(values.slice(0, 6));
}

export function strength(values: number[]): number {
  return d3.max(values, (d) => Math.abs(d - 1)) ?? 0;
}

// Pearson correlation coefficient between two equal-length numeric series.
// Returns null when there are fewer than 2 points or either series has zero variance.
export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  const mx = d3.mean(xs) ?? 0;
  const my = d3.mean(ys) ?? 0;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = (xs[i] ?? 0) - mx;
    const dy = (ys[i] ?? 0) - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

// Correlation ratio η (eta) between a categorical grouping and a numeric value — the
// share of total variance explained by the group means, the analog of |r| for a
// categorical predictor. Ranges [0, 1]. Returns null when there aren't enough points.
export function correlationRatio(groups: Map<string, number[]>): number | null {
  const all: number[] = [];
  for (const values of groups.values()) all.push(...values);
  if (all.length < 2) return null;
  const grand = d3.mean(all) ?? 0;
  let between = 0;
  let total = 0;
  for (const values of groups.values()) {
    const gm = d3.mean(values) ?? 0;
    between += values.length * (gm - grand) ** 2;
  }
  for (const v of all) total += (v - grand) ** 2;
  if (total === 0) return null;
  return Math.sqrt(between / total);
}

export interface LegendStep {
  index: number;
  color: string;
  label: string;
}

export interface GuidedLegendSweepOptions {
  visibilityTarget: Element;
  hasPlayed: { current: boolean };
  durationMs?: number;
}

export interface GradientLegendOptions {
  guidedSweep?: GuidedLegendSweepOptions;
}

// Builds an n-step legend from actual sample values, binned by quantile so each step
// covers roughly the same number of countries (not the same slice of the value range —
// a right-skewed sample like GDP would otherwise dump most countries in one bin). Each
// step gets an evenly-sampled colour and a "lo–hi" label (the first/last bins read as
// "< hi" / "> lo" since they're open-ended). `fromDomain` lets the caller quantile on a
// transformed scale (e.g. log10) while labelling in the original units.
export function buildLegendSteps(
  values: number[],
  n: number,
  colorInterpolator: (t: number) => string,
  formatBound: (value: number) => string,
  fromDomain: (value: number) => number = (v) => v,
): { steps: LegendStep[]; scale: d3.ScaleQuantile<number> } {
  const scale = d3
    .scaleQuantile<number>()
    .domain(values.length ? values : [0])
    .range(d3.range(n));
  const colors = d3.quantize(colorInterpolator, n);
  const steps: LegendStep[] = d3.range(n).map((i) => {
    const [lo, hi] = scale.invertExtent(i);
    const label =
      i === 0
        ? `< ${formatBound(fromDomain(hi))}`
        : i === n - 1
          ? `> ${formatBound(fromDomain(lo))}`
          : `${formatBound(fromDomain(lo))}–${formatBound(fromDomain(hi))}`;
    return { index: i, color: colors[i] ?? "#8888aa", label };
  });
  return { steps, scale };
}

// Maps a normalized animation position to one of the legend's equal-width steps.
// Exported separately so the 2200 ms sweep's five-bin sequencing can be unit tested.
export function legendStepForProgress(progress: number, stepCount: number): number {
  if (stepCount <= 0) return -1;
  const normalized = Math.min(1, Math.max(0, progress));
  return Math.min(stepCount - 1, Math.floor(normalized * stepCount));
}

// Wires legend swatches so hovering one highlights the points sharing its step index
// (via `.is-active`) and mutes the rest (via `.is-dimmed`); leaving clears both. Namespaced
// so a caller (e.g. renderGradientLegend) can attach its own pointermove/pointerleave
// handlers — for a tooltip, say — on the same elements without clobbering these.
export function wireStepHover<
  Datum extends { step: number },
  GParent extends d3.BaseType,
  LParent extends d3.BaseType,
>(
  points: d3.Selection<SVGCircleElement, Datum, GParent, unknown>,
  legendItems: d3.Selection<HTMLSpanElement, LegendStep, LParent, unknown>,
  onInteract?: () => void,
): void {
  legendItems
    .on("pointerenter.step", (_event, d) => {
      onInteract?.();
      points.classed("is-dimmed", (p) => p.step !== d.index);
      points.classed("is-active", (p) => p.step === d.index);
    })
    .on("pointerleave.step", () => {
      points.classed("is-dimmed", false).classed("is-active", false);
    });
}

// Renders a legend that *looks* like one continuous colour gradient — the bar's own
// background is a smooth multi-stop CSS gradient across the step colours — but is
// actually divided into `steps.length` invisible slices, each a discrete hover target:
// hovering a slice shows its range as a tooltip and highlights/mutes points via
// wireStepHover. `bounds` are the pre-formatted labels for the two ends of the bar.
export function renderGradientLegend<Datum extends { step: number }, GParent extends d3.BaseType>(
  container: HTMLElement,
  steps: LegendStep[],
  caption: string,
  bounds: [string, string],
  points: d3.Selection<SVGCircleElement, Datum, GParent, unknown>,
  options: GradientLegendOptions = {},
): () => void {
  const legend = d3.select(container);
  legend.selectAll("*").remove();
  legend.append("span").text(bounds[0]);
  const bar = legend
    .append("div")
    .attr("class", "legend-gradient")
    .style("background", `linear-gradient(90deg, ${steps.map((s) => s.color).join(", ")})`);
  const hits = bar
    .selectAll<HTMLSpanElement, LegendStep>("span")
    .data(steps)
    .join("span")
    .attr("class", "legend-step")
    .classed("is-first", (_d, index) => index === 0)
    .classed("is-last", (_d, index) => index === steps.length - 1)
    .on("pointermove.tooltip", (event, d) => showTooltip(d.label, event.clientX, event.clientY))
    .on("pointerleave.tooltip", hideTooltip);
  legend.append("span").text(bounds[1]);
  legend.append("span").attr("class", "legend-caption").text(caption);

  let observer: IntersectionObserver | null = null;
  let frameId: number | null = null;
  let tourRunning = false;

  const clearGuidedState = () => {
    points.classed("is-dimmed", false).classed("is-active", false);
    hits.classed("is-guided", false);
    bar.select(".legend-tour-hand").classed("is-visible", false);
    tourRunning = false;
  };

  const stopTour = (markPlayed: boolean) => {
    if (markPlayed && options.guidedSweep) options.guidedSweep.hasPlayed.current = true;
    observer?.disconnect();
    observer = null;
    if (frameId != null) cancelAnimationFrame(frameId);
    frameId = null;
    clearGuidedState();
  };

  wireStepHover(points, hits, () => stopTour(true));

  const sweep = options.guidedSweep;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  if (sweep && !sweep.hasPlayed.current && !reduceMotion && "IntersectionObserver" in window) {
    const durationMs = sweep.durationMs ?? 2200;
    const hand = bar
      .append("span")
      .attr("class", "legend-tour-hand")
      .attr("aria-hidden", "true")
      .html(
        '<svg viewBox="0 0 32 32" focusable="false"><path d="M10 14V6.5a2.5 2.5 0 0 1 5 0V12 9.5a2.5 2.5 0 0 1 5 0V13v-1.5a2.5 2.5 0 0 1 5 0V18c0 6.1-3.9 10-9.5 10H15c-3.1 0-5.3-1.3-7-3.7l-3.6-5.1a2.5 2.5 0 0 1 4-3L10 18.1V14Z" /></svg>',
      );

    const showStep = (index: number) => {
      points.classed("is-dimmed", (p) => p.step !== index);
      points.classed("is-active", (p) => p.step === index);
      hits.classed("is-guided", (d) => d.index === index);
    };

    const startTour = () => {
      if (tourRunning || sweep.hasPlayed.current) return;
      tourRunning = true;
      sweep.hasPlayed.current = true;
      observer?.disconnect();
      observer = null;
      hand.classed("is-visible", true).style("left", "0%");
      showStep(0);
      const startedAt = performance.now();

      const tick = (now: number) => {
        const progress = Math.min(1, Math.max(0, (now - startedAt) / durationMs));
        const step = legendStepForProgress(progress, steps.length);
        hand.style("left", `${progress * 100}%`);
        showStep(step);
        if (progress < 1) {
          frameId = requestAnimationFrame(tick);
        } else {
          frameId = null;
          clearGuidedState();
        }
      };

      frameId = requestAnimationFrame(tick);
    };

    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.999)) {
          startTour();
        }
      },
      { threshold: 1 },
    );
    observer.observe(sweep.visibilityTarget);
  }

  return () => stopTour(false);
}

// The five Köppen–Geiger families, tropics → poles, with a display colour each. Shared by
// the climate-zone scatter and the latitude-correlation scatter, so a family reads as the
// same colour in both charts.
export const KG_FAMILIES: { key: string; name: string; color: string }[] = [
  { key: "A", name: "Tropical", color: "#3a7d5b" },
  { key: "B", name: "Arid", color: "#c7a24a" },
  { key: "C", name: "Temperate", color: "#5aa9d6" },
  { key: "D", name: "Continental", color: "#7e6bd0" },
  { key: "E", name: "Polar", color: "#9fb4c4" },
];

const KG_FAMILY_COLOR = new Map(KG_FAMILIES.map((f) => [f.key, f.color]));

// Colour for a country's Köppen–Geiger family, or a neutral grey when it's unmapped.
export function kgFamilyColor(kgFamily: string | undefined): string {
  return (kgFamily && KG_FAMILY_COLOR.get(kgFamily)) || "#8a93a3";
}

export function expGap(meanMs: number): number {
  return -Math.log(1 - Math.random()) * meanMs;
}

// The real global average gap between deaths, shared by the animated-dot roadmap
// charts. ~61.6M deaths/year worldwide (the same total baked into data/rate-grid.json
// that the globe samples) is ~1.95 deaths per second — a mean gap of ~0.51s, NOT "one
// death every ~2 seconds".
export const REAL_MEAN_GAP_MS = 512;

export function formatMeanGap(meanMs: number): string {
  return meanMs >= 1000 ? `${(meanMs / 1000).toFixed(2)}s` : `${meanMs}ms`;
}

export function randomPointOnSphere(): [number, number] {
  const lon = Math.random() * 360 - 180;
  const lat = (Math.asin(2 * Math.random() - 1) * 180) / Math.PI;
  return [lon, lat];
}

// Ten countries found (notebooks/seasonality.ipynb) to be mutually similar in curve
// *shape* despite spanning very different latitudes and death tolls. Default
// selection for the interactive country-comparison chart.
export const COUNTRY_CURVE_PICKS = [
  { id: 250, name: "France", color: "#ff6b6b" },
  { id: 703, name: "Slovakia", color: "#ffb26b" },
  { id: 840, name: "USA", color: "#f4d35e" },
  { id: 752, name: "Sweden", color: "#4ade80" },
  { id: 392, name: "Japan", color: "#2dd4bf" },
  { id: 191, name: "Croatia", color: "#6ba8ff" },
  { id: 56, name: "Belgium", color: "#818cf8" },
  { id: 826, name: "United Kingdom", color: "#c084fc" },
  { id: 756, name: "Switzerland", color: "#f472b6" },
  { id: 528, name: "Netherlands", color: "#facc15" },
];

// Extra hues for countries added beyond the default 10, checked against the picks
// above with the dataviz skill's validate_palette.js (dark mode, --pairs all) — they
// don't introduce any colorblind-safety collision worse than the existing palette's.
export const EXTRA_CURVE_COLORS = ["#a3e635", "#38bdf8", "#f97316", "#0891b2"];

// Total distinct colors available — the cap on how many countries can be compared
// at once (beyond this, colors would repeat and series would become ambiguous).
export const MAX_COMPARE_COUNTRIES = COUNTRY_CURVE_PICKS.length + EXTRA_CURVE_COLORS.length;

export function styleAxis(g: d3.Selection<SVGGElement, unknown, Element | null, unknown>): void {
  g.selectAll("path,line").attr("class", "chart-axis");
  g.selectAll("text").attr("class", "chart-tick");
}
