import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  bucketsByMonth,
  buildMonthValues,
  domainOf,
  NEUTRAL_EDGE,
  quantise,
  resolveCellCurves,
  TIER_COUNTRY,
  TIER_NONE,
  TIER_REGION,
} from "./amplitudeCells";
import type { SpatialSeasonalityEstimate } from "@/lib/spatial-seasonality";
import type { HarmonicCurve } from "@/lib/seasonal-curve";
import type { RateCell, RegionKeys, SubnationalSeasonalityRegion } from "../types";

// A first-order curve peaking in the northern winter: mean one over the year, +20% in January,
// −20% in July. Every expected value below is arithmetic on this.
const WINTER: HarmonicCurve = { order: 1, coefficients: [1, 0.2, 0] };
const SUMMER: HarmonicCurve = { order: 1, coefficients: [1, -0.2, 0] };

const region = (key: string, curve: HarmonicCurve): SubnationalSeasonalityRegion => ({
  country: "ZAF",
  geo: "adm1",
  key,
  name: `Region ${key}`,
  isoRegion: null,
  interval: "month",
  curve,
  nYears: 5,
  annualDeaths: 1000,
  measurement: "crvs",
});

const estimate = (curve: HarmonicCurve): SpatialSeasonalityEstimate => ({
  curve,
  source: "observed",
  donorNames: [],
});

// Four cells: two inside measured regions of a country that also has an estimate, one in a
// country with an estimate and no regions, one in a country nothing knows anything about.
const CELLS: RateCell[] = [
  [0, 0, 710, 1200],
  [0.5, 0, 710, 600],
  [1, 0, 578, 2400],
  [1.5, 0, 999, 400],
];

const REGION_KEYS: RegionKeys = {
  source: "test",
  cellsize: 0.5,
  count: 4,
  keys: [
    { geo: "adm1", key: "ZAF-1", country: "ZAF" },
    { geo: "adm1", key: "ZAF-2", country: "ZAF" },
  ],
  cells: [0, 1, -1, -1],
};

describe("resolveCellCurves", () => {
  it("falls through region, then country, then nothing, in that order", () => {
    const resolved = resolveCellCurves({
      cells: CELLS,
      regionKeys: REGION_KEYS,
      regions: [region("ZAF-1", WINTER), region("ZAF-2", SUMMER)],
      estimates: new Map([
        [710, estimate(SUMMER)],
        [578, estimate(WINTER)],
      ]),
      names: { "710": "South Africa", "578": "Norway" },
    });

    expect([...resolved.tier]).toEqual([TIER_REGION, TIER_REGION, TIER_COUNTRY, TIER_NONE]);
    // Cell 0 sits in a country that has an estimate AND a region that has a curve. The region
    // wins — that is the whole reason the region layer is fetched.
    expect(resolved.units[resolved.unit[0]!]!.regionKey).toBe("ZAF-1");
    expect(resolved.units[resolved.unit[2]!]!.name).toBe("Norway");
    expect(resolved.unit[3]).toBe(-1);
  });

  it("samples one curve per unit, not per cell", () => {
    const shared: RateCell[] = Array.from(
      { length: 50 },
      (_, i) => [i * 0.5, 0, 710, 100] as RateCell,
    );
    const resolved = resolveCellCurves({
      cells: shared,
      regionKeys: null,
      regions: null,
      estimates: new Map([[710, estimate(WINTER)]]),
    });
    // Fifty cells, one country, one unit — and every cell reading the same twelve numbers.
    expect(resolved.units).toHaveLength(1);
    const n = shared.length;
    for (let i = 1; i < n; i += 1) {
      expect(resolved.monthly[i]).toBe(resolved.monthly[0]);
    }
  });

  it("drops the region tier rather than mis-joining when the files fall out of alignment", () => {
    const resolved = resolveCellCurves({
      cells: CELLS,
      regionKeys: { ...REGION_KEYS, cells: [0, 1, -1], count: 3 },
      regions: [region("ZAF-1", WINTER), region("ZAF-2", SUMMER)],
      estimates: new Map([[710, estimate(SUMMER)]]),
    });
    // Every cell that has a country estimate takes it; nothing claims a region it cannot prove.
    expect([...resolved.tier]).toEqual([TIER_COUNTRY, TIER_COUNTRY, TIER_NONE, TIER_NONE]);
    expect(resolved.units.map((u) => u.m49)).toEqual([710]);
    expect(resolved.units.every((u) => u.tier === TIER_COUNTRY)).toBe(true);
  });

  it("gives a cell with no curve a flat year rather than a hole", () => {
    const resolved = resolveCellCurves({
      cells: [[0, 0, 999, 500]],
      regionKeys: null,
      regions: null,
      estimates: new Map(),
    });
    expect(resolved.tier[0]).toBe(TIER_NONE);
    for (let month = 0; month < 12; month += 1) expect(resolved.monthly[month]).toBe(1);
  });

  it("prefers the curve the fallback pass actually applied to a region", () => {
    const resolved = resolveCellCurves({
      cells: [CELLS[0]!],
      regionKeys: { ...REGION_KEYS, cells: [0], count: 1 },
      regions: [region("ZAF-1", WINTER)],
      estimates: new Map(),
      regionOverrides: { "ZAF-1": { curve: SUMMER } },
    });
    // January under SUMMER is below one, under WINTER above it.
    expect(resolved.monthly[0]).toBeLessThan(1);
  });
});

describe("buildMonthValues", () => {
  it("is deaths times the seasonal part only, spread over the twelve months", () => {
    const resolved = resolveCellCurves({
      cells: [[0, 0, 710, 1200]],
      regionKeys: null,
      regions: null,
      estimates: new Map([[710, estimate(WINTER)]]),
    });
    const values = buildMonthValues([[0, 0, 710, 1200]], resolved.monthly);
    // 1200 deaths/year at a January multiplier of ~1.2 is ~+20 excess deaths that month, and the
    // static 100/month is gone — which is the point of subtracting the one.
    expect(values[0]).toBeCloseTo((1200 * (resolved.monthly[0]! - 1)) / 12, 6);
    expect(values[0]).toBeGreaterThan(15);
    expect(values[6]).toBeLessThan(-15);
    // Mean one over the year means the twelve excesses very nearly cancel.
    let sum = 0;
    for (let month = 0; month < 12; month += 1) sum += values[month]!;
    expect(Math.abs(sum)).toBeLessThan(1);
  });

  it("leaves a cell nobody dies in at zero in every month", () => {
    const cells: RateCell[] = [[0, 0, 710, 0]];
    const resolved = resolveCellCurves({
      cells,
      regionKeys: null,
      regions: null,
      estimates: new Map([[710, estimate(WINTER)]]),
    });
    const values = buildMonthValues(cells, resolved.monthly);
    expect([...values].every((v) => v === 0)).toBe(true);
  });
});

describe("quantise", () => {
  const STEPS = 9;

  it("is monotonic, symmetric about the neutral bin, and centred on zero", () => {
    const values = Float32Array.from([-400, -40, -4, -0.5, 0, 0.5, 4, 40, 400]);
    const { bins, edges, domain } = quantise(values, STEPS, 400);
    expect(domain).toBe(400);
    expect(edges[edges.length - 1]).toBe(400);
    expect(edges[0]).toBe(NEUTRAL_EDGE);
    // The middle bin is the neutral one and holds everything under a death a month.
    expect(bins[4]).toBe(4);
    expect(bins[3]).toBe(4);
    expect(bins[5]).toBe(4);
    // Monotonic across the whole signed range.
    for (let i = 1; i < bins.length; i += 1) {
      expect(bins[i]!).toBeGreaterThanOrEqual(bins[i - 1]!);
    }
    // Symmetric: a value and its negative sit the same distance either side of neutral.
    expect(bins[0]! + bins[8]!).toBe(STEPS - 1);
    expect(bins[1]! + bins[7]!).toBe(STEPS - 1);
    expect(bins[2]! + bins[6]!).toBe(STEPS - 1);
  });

  it("publishes the edges the cells were binned on, so a legend cannot disagree", () => {
    const values = Float32Array.from([0, 5, 50, 500]);
    const { bins, edges } = quantise(values, STEPS, 500);
    const half = (STEPS - 1) / 2;
    for (let i = 0; i < values.length; i += 1) {
      const band = bins[i]! - half;
      const value = values[i]!;
      if (band === 0) expect(value).toBeLessThanOrEqual(edges[0]!);
      else {
        expect(value).toBeGreaterThan(edges[band - 1]!);
        if (band < half) expect(value).toBeLessThanOrEqual(edges[band]!);
      }
    }
  });

  it("clamps past the domain instead of adding a bin the legend has no colour for", () => {
    const { bins } = quantise(Float32Array.from([1e9, -1e9]), STEPS, 100);
    expect(bins[0]).toBe(STEPS - 1);
    expect(bins[1]).toBe(0);
  });

  it("takes the domain off the distribution, not off its single loudest cell", () => {
    // 999 cells under ten, one at a million. A domain set by the maximum would put every other
    // cell in the neutral bin.
    const values = new Float32Array(1000);
    for (let i = 0; i < 999; i += 1) values[i] = 1 + (i % 9);
    values[999] = 1e6;
    const { domain, bins } = quantise(values, STEPS);
    expect(domain).toBeLessThan(100);
    expect(bins[999]).toBe(STEPS - 1);
    expect([...bins.slice(0, 999)].some((b) => b !== 4)).toBe(true);
  });

  it("takes the domain from the cells the panel shows, not the ones it culled", () => {
    // One month, four cells; the two the frame drops are the loud ones.
    const values = new Float32Array(12 * 4);
    for (let month = 0; month < 12; month += 1) {
      values[month * 4 + 0] = 4;
      values[month * 4 + 1] = 6;
      values[month * 4 + 2] = 5000;
      values[month * 4 + 3] = 9000;
    }
    expect(domainOf(values)).toBeGreaterThan(1000);
    expect(domainOf(values, (cell) => cell < 2)).toBeLessThan(10);
  });

  it("keeps the bands ordered when the data is too small to have a domain", () => {
    const { edges, bins } = quantise(Float32Array.from([0, 0, 0]), STEPS);
    for (let i = 1; i < edges.length; i += 1) expect(edges[i]!).toBeGreaterThan(edges[i - 1]!);
    expect([...bins]).toEqual([4, 4, 4]);
  });
});

describe("bucketsByMonth", () => {
  const STEPS = 9;

  it("partitions every cell into exactly one bin, every month", () => {
    const n = 200;
    const bins = new Uint8Array(12 * n);
    for (let i = 0; i < bins.length; i += 1) bins[i] = i % STEPS;
    const buckets = bucketsByMonth(bins, STEPS);
    expect(buckets).toHaveLength(12);
    for (let month = 0; month < 12; month += 1) {
      const seen = new Set<number>();
      let total = 0;
      for (const list of buckets[month]!) {
        total += list.length;
        for (const cell of list) {
          expect(seen.has(cell)).toBe(false);
          seen.add(cell);
        }
      }
      expect(total).toBe(n);
      expect(seen.size).toBe(n);
    }
  });

  it("puts each cell in the bin its month says, not its neighbour's", () => {
    const n = 3;
    const bins = new Uint8Array(12 * n);
    bins[0 * n + 0] = 8; // cell 0 in January
    bins[6 * n + 0] = 0; // cell 0 in July
    const buckets = bucketsByMonth(bins, STEPS);
    expect([...buckets[0]![8]!]).toEqual([0]);
    expect([...buckets[6]![0]!]).toEqual([0, 1, 2]);
  });

  it("drops what the caller culled, from every month at once", () => {
    const n = 10;
    const bins = new Uint8Array(12 * n);
    const buckets = bucketsByMonth(bins, STEPS, (cell) => cell % 2 === 0);
    for (const month of buckets) {
      expect(month.reduce((sum, list) => sum + list.length, 0)).toBe(5);
    }
  });
});

// The join this figure rests on, checked against the committed files rather than a fixture —
// the same guard build-age-sex-cells.test.ts puts on the same two files, for the same reason:
// a public/data copy that has drifted mis-joins every cell to some other cell's region, and the
// result looks like data.
describe("the shipped grid and region-key files", () => {
  it("are index-aligned, cell for cell", () => {
    const grid = JSON.parse(fs.readFileSync("data/rate-grid.json", "utf8")) as { cells: unknown[] };
    const keys = JSON.parse(fs.readFileSync("data/region-keys.json", "utf8")) as {
      cells: unknown[];
      count: number;
    };
    expect(keys.cells.length).toBe(grid.cells.length);
    expect(keys.count).toBe(grid.cells.length);
  });
});
