// Everything the seasonality map computes that is not drawing: which curve each grid cell
// answers to, what that curve is worth in deaths each month, and which colour bin that lands in.
//
// Kept out of the component for the reason smoothingDemo.ts and ScaleDiagonalToggle's helpers
// are: it is pure, it has no React and no d3-selection in it, and it is where the figure's
// arithmetic can be tested at all. The component's two effects are then only projection and paint.

import { sampleHarmonicCurve, type HarmonicCurve } from "@/lib/seasonal-curve";
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
  // Set on the country tier: the M49 id, which is what the 110m country features are keyed by.
  m49?: number;
  name: string;
  // Only meaningful on the country tier, where buildSpatialSeasonality already worked out
  // whether the curve was observed or reconstructed and from whom.
  source?: SpatialSeasonalityEstimate["source"];
  donorNames?: string[];
  // How the region itself was measured — "climate-modeled" for the Indian and Chinese regions,
  // which are a Köppen blend rather than an observation.
  measurement?: SubnationalSeasonalityRegion["measurement"];
}

export interface ResolvedCellCurves {
  // 12 × n, month-major: `monthly[month * n + cell]` is that cell's multiplier that month.
  // Mean one over the year by construction, so 1.0 is "an average month here".
  monthly: Float32Array;
  tier: Uint8Array;
  // Index into `units`, or -1 on TIER_NONE.
  unit: Int32Array;
  units: CellCurveUnit[];
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
  // Unit id → its twelve multipliers, so a curve is sampled once however many cells share it.
  const samples: number[][] = [];
  const unitByRegionKey = new Map<string, number>();
  const unitByM49 = new Map<number, number>();

  const add = (u: CellCurveUnit, curve: HarmonicCurve): number => {
    units.push(u);
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
              measurement: region.measurement,
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

  return { monthly, tier, unit, units };
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

export interface Quantised {
  bins: Uint8Array;
  // The upper edge of each magnitude band, in deaths/month, smallest first. `edges[0]` is the
  // neutral band's edge and `edges[edges.length - 1]` is the domain. The legend prints these, so
  // it cannot disagree with the cells: they are the same numbers.
  edges: number[];
  domain: number;
}

// A cell where the season moves fewer than this many deaths a month is drawn neutral. One death
// is a number a reader can hold, and it is the honest floor for a 0.5° cell: below it the colour
// would be encoding rounding.
export const NEUTRAL_EDGE = 1;

// The share of the distribution the domain reaches. The top half-percent of cells are the
// Bengal delta and the Nile, which are an order of magnitude past everywhere else — letting them
// set the domain would flatten the rest of the map into two bins.
export const DOMAIN_QUANTILE = 0.995;

// Signed values → a diverging bin index, on a ladder that is geometric in magnitude.
//
// Diverging because the quantity has a real zero with a meaning on either side (more deaths this
// month than an average one, or fewer), and geometric because the magnitudes span five decades:
// a linear ladder puts everything outside the Ganges plain in the neutral bin.
//
// One domain for all twelve months, computed once from all of them. Re-normalising per month
// would make the colours move even where the deaths did not, which is exactly the thing this
// figure claims to be showing.
export function quantise(values: Float32Array, steps: number, domain?: number): Quantised {
  const half = (steps - 1) / 2;
  const span = domain ?? domainOf(values);
  const edges = bandEdges(span, half);
  const top = edges[half - 1] ?? NEUTRAL_EDGE;
  const bins = new Uint8Array(values.length);
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i] ?? 0;
    const magnitude = Math.abs(value);
    let band = 0;
    if (magnitude > top) band = half;
    else {
      while (band < half && magnitude > (edges[band] ?? Infinity)) band += 1;
    }
    bins[i] = half + (value < 0 ? -band : band);
  }
  return { bins, edges, domain: span };
}

// `half` upper edges: the neutral band, then a geometric climb to the domain. Degenerate data —
// a domain at or below the neutral edge — gets a linear ladder instead of a ratio of one, so the
// bands stay distinct and ordered rather than collapsing onto each other.
function bandEdges(domain: number, half: number): number[] {
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

// Per month, the cell indices in each colour bin — the render loop's input.
//
// The loop wants this shape rather than a bin per cell because canvas charges per fillStyle
// change, and walking a bin at a time sets it nine times instead of twenty-odd thousand. It does
// NOT want the cells collected into one path per bin: measured on this figure, nine batched
// paths of ~3,000 quads each cost 188ms to fill against 6ms for the same quads filled one at a
// time, because a path that large falls off the rasteriser's fast route. Group the colour, not
// the geometry.
//
// `keep` is how the caller drops cells its projection put off-panel: culling before this point
// keeps them out of every month's buckets at once.
export function bucketsByMonth(
  bins: Uint8Array,
  steps: number,
  keep?: (cell: number) => boolean,
): Int32Array[][] {
  const n = bins.length / 12;
  const months: Int32Array[][] = [];
  for (let month = 0; month < 12; month += 1) {
    const lists: number[][] = Array.from({ length: steps }, () => []);
    for (let i = 0; i < n; i += 1) {
      if (keep && !keep(i)) continue;
      lists[bins[month * n + i] ?? 0]?.push(i);
    }
    months.push(lists.map((list) => Int32Array.from(list)));
  }
  return months;
}
