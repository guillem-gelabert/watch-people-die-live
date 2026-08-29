// Everything the seasonality map computes that is not drawing: which curve each grid cell
// answers to, what that curve is worth in deaths each month, and which colour bin that lands in.
//
// Kept out of the component for the reason smoothingDemo.ts and ScaleDiagonalToggle's helpers
// are: it is pure, it has no React and no d3-selection in it, and it is where the figure's
// arithmetic can be tested at all. The component's two effects are then only projection and paint.

import {
  evaluateHarmonicCurve,
  sampleHarmonicCurve,
  type HarmonicCurve,
} from "@/lib/seasonal-curve";
import type { SpatialSeasonalityEstimate } from "@/lib/spatial-seasonality";
import type { RateCell, RegionKeys, SubnationalSeasonalityRegion } from "../types";

// Where a cell's monthly curve came from. Ordered by how much the cell is entitled to claim:
// a measured (or climate-modelled) region beats its country's single estimate, which beats
// nothing at all.
export const TIER_REGION = 0;
export const TIER_COUNTRY = 1;
export const TIER_NONE = 2;

// The unit whose curve a cell borrowed — an admin-1 region, a country, or neither. This is the
// map's actual argument: the cells are 0.5°, the curve behind them is not, and the outline
// overlay draws these so the reader can see the two units disagree.
export interface CellCurveUnit {
  tier: number;
  // Set on the region tier: the admin-1 / NUTS-2 key, which is also the key both
  // seasonality-subnational.json and region-keys.json use.
  regionKey?: string;
  // The M49 id of the country the unit is in — its own on the country tier, its parent's on the
  // region tier, where the tooltip needs both names.
  m49?: number;
  name: string;
  country?: string;
  // Only meaningful on the country tier, where buildSpatialSeasonality already worked out
  // whether the curve was observed or reconstructed and from whom.
  source?: SpatialSeasonalityEstimate["source"];
  donorNames?: string[];
  // How the region itself was measured — "climate-modeled" for the Indian and Chinese regions,
  // which are a Köppen blend rather than an observation.
  measurement?: SubnationalSeasonalityRegion["measurement"];
  // The regions the region's own curve was borrowed from, where its raw series was unusable.
  imputedFrom?: string[];
}

export interface ResolvedCellCurves {
  // 12 × n, month-major: `monthly[month * n + cell]` is that cell's multiplier that month.
  // Mean one over the year by construction, so 1.0 is "an average month here".
  //
  // Twelve is not a sampling compromise. The fits are order-4 Fourier — nine coefficients, fastest
  // component four cycles a year — so twelve samples sit above the Nyquist rate and there are more
  // of them than there are unknowns. They pin the curve exactly, which is why the domain the
  // colours are stretched over can be taken from them however finely the figure is later read.
  monthly: Float32Array;
  tier: Uint8Array;
  // Index into `units`, or -1 on TIER_NONE.
  unit: Int32Array;
  units: CellCurveUnit[];
  // The curve behind each unit, aligned to `units`, for readers that want a phase the twelve
  // samples do not land on.
  curves: HarmonicCurve[];
}

export interface ResolveCellCurvesInput {
  cells: RateCell[];
  regionKeys: RegionKeys | null;
  regions: SubnationalSeasonalityRegion[] | null;
  estimates: ReadonlyMap<number, SpatialSeasonalityEstimate>;
  // Curves the fallback pass overrode, keyed the same way seasonality-applied-fallbacks.json
  // keys them, so a region shows the curve the story actually applied to it.
  regionOverrides?: Record<string, { curve: HarmonicCurve }> | null;
  names?: Record<string, string>;
}

// One curve per cell, resolved region → country → none, and the twelve multipliers it implies.
//
// The twelve are sampled once per *unit*, not once per cell: there are a couple of hundred
// distinct curves behind twenty-odd thousand cells in frame, and evaluating a harmonic twelve
// times per cell would be two orders of magnitude of arithmetic for the same numbers.
//
// `regionKeys.cells` is index-aligned to `cells` — build-region-keys.ts asserts it when it bakes
// the file — but a stale public/data copy would silently mis-join every cell to some other
// cell's region, which looks like data rather than like a bug. So the alignment is checked here
// too, and a mismatch drops the whole region tier rather than joining it wrong.
export function resolveCellCurves({
  cells,
  regionKeys,
  regions,
  estimates,
  regionOverrides,
  names,
}: ResolveCellCurvesInput): ResolvedCellCurves {
  const n = cells.length;
  const aligned = regionKeys && regionKeys.cells.length === n ? regionKeys : null;

  const regionByKey = new Map<string, SubnationalSeasonalityRegion>();
  for (const region of regions ?? []) regionByKey.set(region.key, region);

  const monthly = new Float32Array(12 * n);
  const tier = new Uint8Array(n);
  const unit = new Int32Array(n);
  const units: CellCurveUnit[] = [];
  const curves: HarmonicCurve[] = [];
  // Unit id → its twelve multipliers, so a curve is sampled once however many cells share it.
  const samples: number[][] = [];
  const unitByRegionKey = new Map<string, number>();
  const unitByM49 = new Map<number, number>();

  const add = (u: CellCurveUnit, curve: HarmonicCurve): number => {
    units.push(u);
    curves.push(curve);
    samples.push(sampleHarmonicCurve(curve));
    return units.length - 1;
  };

  for (let i = 0; i < n; i += 1) {
    const cell = cells[i];
    if (!cell) continue;
    const m49 = cell[2];
    let id = -1;

    if (aligned) {
      const keyIndex = aligned.cells[i] ?? -1;
      const row = keyIndex >= 0 ? aligned.keys[keyIndex] : undefined;
      const region = row ? regionByKey.get(row.key) : undefined;
      if (row && region) {
        const hit = unitByRegionKey.get(row.key);
        if (hit != null) id = hit;
        else {
          const curve = regionOverrides?.[row.key]?.curve ?? region.curve;
          id = add(
            {
              tier: TIER_REGION,
              regionKey: row.key,
              m49,
              name: region.name,
              country: names?.[String(m49)],
              measurement: region.measurement,
              ...(region.imputedFrom ? { imputedFrom: region.imputedFrom } : {}),
            },
            curve,
          );
          unitByRegionKey.set(row.key, id);
        }
      }
    }

    if (id < 0) {
      const hit = unitByM49.get(m49);
      if (hit != null) id = hit;
      else {
        const estimate = estimates.get(m49);
        if (estimate) {
          id = add(
            {
              tier: TIER_COUNTRY,
              m49,
              name: names?.[String(m49)] ?? String(m49),
              source: estimate.source,
              donorNames: estimate.donorNames,
            },
            estimate.curve,
          );
          unitByM49.set(m49, id);
        }
      }
    }

    unit[i] = id;
    if (id < 0) {
      // No curve anywhere: a flat year, tagged, rather than a hole. A cell with no seasonality
      // is a real claim — it just is not one the data made.
      tier[i] = TIER_NONE;
      for (let month = 0; month < 12; month += 1) monthly[month * n + i] = 1;
      continue;
    }
    const unitSamples = samples[id]!;
    tier[i] = units[id]!.tier;
    for (let month = 0; month < 12; month += 1) {
      monthly[month * n + i] = unitSamples[month] ?? 1;
    }
  }

  return { monthly, tier, unit, units, curves };
}

// Excess deaths this month: what the season adds to, or takes from, this cell's ordinary month.
//
// `deaths × (multiplier − 1) / 12`, not `deaths × multiplier`. The multiplier spans 0.79–1.27
// across the whole frame while the annual deaths behind it span zero to 141,000, so on any scale
// the two share the constant term swamps the seasonal one and the map barely moves as the months
// go by. Subtracting the one takes the static picture out and leaves only the part that is about
// time — which is the only reason this figure has a slider.
export function buildMonthValues(cells: RateCell[], monthly: Float32Array): Float32Array {
  const n = cells.length;
  const values = new Float32Array(12 * n);
  for (let i = 0; i < n; i += 1) {
    const deaths = cells[i]?.[3] ?? 0;
    for (let month = 0; month < 12; month += 1) {
      const at = month * n + i;
      values[at] = (deaths * ((monthly[at] ?? 1) - 1)) / 12;
    }
  }
  return values;
}

// A cell where the season moves fewer than this many deaths a month is drawn neutral. One death
// is a number a reader can hold, and it is the honest floor for a 0.5° cell: below it the colour
// would be encoding rounding.
export const NEUTRAL_EDGE = 1;

// The share of the distribution the domain reaches. The top half-percent of cells are the
// Bengal delta and the Nile, which are an order of magnitude past everywhere else — letting them
// set the domain would flatten the rest of the map into two bins.
export const DOMAIN_QUANTILE = 0.995;

// `half` upper edges: the neutral band, then a geometric climb to the domain, smallest first.
// `edges[0]` is the neutral band's edge and the last is the domain itself. The legend prints
// these, so the strip and the cells cannot disagree — they are the same numbers.
//
// Geometric because the magnitudes span five decades: a linear ladder puts everything outside the
// Ganges plain in the neutral bin. Degenerate data — a domain at or below the neutral edge — gets
// a linear ladder instead of a ratio of one, so the bands stay distinct and ordered rather than
// collapsing onto each other.
export function bandEdges(domain: number, half: number): number[] {
  if (half < 1) return [];
  if (!(domain > NEUTRAL_EDGE)) {
    const step = Math.max(domain, Number.EPSILON) / half;
    return Array.from({ length: half }, (_, i) => step * (i + 1));
  }
  const ratio = Math.pow(domain / NEUTRAL_EDGE, 1 / (half - 1 || 1));
  return Array.from({ length: half }, (_, i) =>
    i === half - 1 ? domain : NEUTRAL_EDGE * Math.pow(ratio, i),
  );
}

// One signed value → its diverging bin. Diverging because the quantity has a real zero with a
// meaning on either side of it: more deaths around this date than in an ordinary month, or fewer.
// Past the domain the value clamps into the end bin rather than inventing a tenth colour.
export function binOf(value: number, edges: number[], steps: number): number {
  const half = (steps - 1) / 2;
  const magnitude = Math.abs(value);
  let band = 0;
  if (magnitude > (edges[half - 1] ?? NEUTRAL_EDGE)) band = half;
  else while (band < half && magnitude > (edges[band] ?? Infinity)) band += 1;
  return half + (value < 0 ? -band : band);
}

// The domain the colours are stretched over, taken across all twelve months at once.
//
// `keep` restricts it to the cells the panel can actually show. A domain set by cells off the
// frame would leave the map's own extremes short of the end of the ramp, which is the sort of
// thing that reads as a design choice rather than as a bug.
export function domainOf(values: Float32Array, keep?: (cell: number) => boolean): number {
  const n = values.length / 12;
  const magnitudes: number[] = [];
  for (let i = 0; i < values.length; i += 1) {
    if (keep && !keep(i % n)) continue;
    magnitudes.push(Math.abs(values[i] ?? 0));
  }
  if (!magnitudes.length) return NEUTRAL_EDGE;
  const sorted = Float64Array.from(magnitudes);
  sorted.sort();
  const at = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * DOMAIN_QUANTILE)),
  );
  return Math.max(NEUTRAL_EDGE, sorted[at] ?? NEUTRAL_EDGE);
}

// One frame's cells, grouped by colour: bin `b` owns `order[offsets[b] … offsets[b + 1])`.
//
// The paint loop wants this shape because canvas charges per fillStyle change, so walking a bin at
// a time sets it nine times instead of twenty-odd thousand. It does NOT want the cells collected
// into one path per bin: measured on this figure, nine batched paths of ~3,000 quads each cost
// 188ms to fill against 6ms for the same quads filled one at a time, because a path that large
// falls off the rasteriser's fast route. Group the colour, not the geometry.
export interface Frame {
  order: Int32Array;
  offsets: Int32Array;
}

export interface FrameBinnerInput {
  cells: RateCell[];
  // Indices into `cells`, already culled to what the panel can show.
  visible: Int32Array;
  unit: Int32Array;
  curves: HarmonicCurve[];
  edges: number[];
  steps: number;
}

// Builds the function that turns a point in the year into one frame's colour groups.
//
// The figure used to precompute all twelve months at load, which is what a twelve-position control
// allows. A control that can stop anywhere has no finite set of frames to precompute, so the work
// moves per frame — and it turns out to be cheap enough that the old design was the more expensive
// one: 0.29ms median over 200 frames on the shipped grid, against the ~6ms the same frame costs to
// paint. It is also less memory, because one frame's groups replace twelve.
//
// Three things keep it there. The curve is evaluated once per *unit* — a couple of hundred — not
// once per cell. The grouping is a counting sort rather than nine growing arrays. And every buffer
// is allocated here, once, so a drag allocates nothing.
//
// The returned Frame is reused between calls: read it before asking for the next one.
export function createFrameBinner({
  cells,
  visible,
  unit,
  curves,
  edges,
  steps,
}: FrameBinnerInput): (phase: number) => Frame {
  const multipliers = new Float64Array(curves.length);
  const bins = new Uint8Array(visible.length);
  const counts = new Int32Array(steps);
  const offsets = new Int32Array(steps + 1);
  const cursor = new Int32Array(steps);
  const order = new Int32Array(visible.length);

  return (phase: number): Frame => {
    for (let u = 0; u < curves.length; u += 1) {
      multipliers[u] = evaluateHarmonicCurve(curves[u]!, phase);
    }
    counts.fill(0);
    for (let k = 0; k < visible.length; k += 1) {
      const cell = visible[k]!;
      const id = unit[cell] ?? -1;
      const multiplier = id >= 0 ? (multipliers[id] ?? 1) : 1;
      const bin = binOf(((cells[cell]?.[3] ?? 0) * (multiplier - 1)) / 12, edges, steps);
      bins[k] = bin;
      counts[bin] = (counts[bin] ?? 0) + 1;
    }
    offsets[0] = 0;
    for (let bin = 0; bin < steps; bin += 1) {
      offsets[bin + 1] = (offsets[bin] ?? 0) + (counts[bin] ?? 0);
      cursor[bin] = offsets[bin] ?? 0;
    }
    for (let k = 0; k < visible.length; k += 1) {
      const bin = bins[k]!;
      order[cursor[bin]!] = visible[k]!;
      cursor[bin] = (cursor[bin] ?? 0) + 1;
    }
    return { order, offsets };
  };
}
