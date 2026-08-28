import fs from "node:fs";
import isoCountries from "i18n-iso-countries";
import { describe, expect, it } from "vitest";

// The v2.0 milestone audit found the UK's real GBD regional pyramids unreachable: GBD publishes UK
// subnational units as NUTS-2, so data/subnational-age-sex.json emits `nuts2:UKC1`..., while
// build-region-keys.ts derived its NUTS-preferring country set from subnational-cdr.json — which
// has no GBR, because the UK stopped reporting to Eurostat. Nought of 41 keys joined and 226 UK
// cells silently used a derived pyramid instead of the measured one, at 1.09% of world expected
// deaths, with nothing in any output saying so.
//
// These are the committed data files, not a fixture, so this test fails on the shipped tree the
// moment the two key spaces diverge again — which is the only place the divergence is visible.

interface RegionKeys {
  keys: { geo: string; key: string; country: string }[];
  cells: number[];
}
interface SubnationalAgeSex {
  regions: { geo: string; key: string; country: string }[];
}
interface RateGrid {
  cells: [number, number, number, number][];
}
interface AgeSexCells {
  meta: {
    cellCount: number;
    tier1Join: { byCountry: Record<string, { keys: number; joined: number }> };
  };
  archetypes: { m: number[]; f: number[] }[];
  classId: number[];
  tier: number[];
}

const read = <T>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;

const regionKeys = read<RegionKeys>("data/region-keys.json");
const subAgeSex = read<SubnationalAgeSex>("data/subnational-age-sex.json");
const cells = read<AgeSexCells>("data/age-sex-cells.json");

// Countries whose GBD units are NUTS-2 rather than admin-1. Named here so that a future export
// adding a fourth is a test failure and a deliberate decision, not a silent half-join.
const NUTS2_COUNTRIES = ["GBR", "ITA", "POL"];

describe("tier-1 region key space", () => {
  const joinable = new Set(regionKeys.keys.map((k) => `${k.geo}:${k.key}`));
  const tier1Keys = new Set(subAgeSex.regions.map((r) => `${r.geo}:${r.key}`));

  it("expresses every geo layer the GBD export uses", () => {
    const layers = new Map<string, Set<string>>();
    for (const r of subAgeSex.regions) {
      layers.set(r.country, (layers.get(r.country) ?? new Set()).add(r.geo));
    }
    // One region key per cell cannot serve two layers for the same country.
    expect([...layers].filter(([, geos]) => geos.size > 1).map(([c]) => c)).toEqual([]);
    expect(
      [...layers]
        .filter(([, geos]) => geos.has("nuts2"))
        .map(([c]) => c)
        .sort(),
    ).toEqual(NUTS2_COUNTRIES);
  });

  it("gives every GBD country at least one key the grid can reach", () => {
    const orphaned = [...new Set(subAgeSex.regions.map((r) => r.country))].filter(
      (country) =>
        !subAgeSex.regions.some((r) => r.country === country && joinable.has(`${r.geo}:${r.key}`)),
    );
    expect(orphaned).toEqual([]);
  });

  it("reaches nearly every cell of every GBD country, whichever layer that country uses", () => {
    // The measurable consequence of a broken key space, and the assertion that would have caught
    // the UK: not "does key X exist" but "do this country's cells actually resolve the measured
    // pyramid". A key winning no cell is normal at 0.5 degrees, so the floor is a share, not
    // totality — but 0%, which is what GBR shipped, is nowhere near any honest floor. Measured
    // 2026-08-28: nine countries at 100% of cells, the weakest IND 94.2% / PHL 95.4% / GBR 96.0%,
    // and every country above 94% of expected death weight.
    const grid = read<RateGrid>("data/rate-grid.json");
    const m49Of = (iso3: string): number => Number(isoCountries.alpha3ToNumeric(iso3) ?? "");
    const countries = [...new Set(subAgeSex.regions.map((r) => r.country))];
    const worst: { country: string; cellPct: number; weightPct: number }[] = [];
    for (const country of countries) {
      const m49 = m49Of(country);
      if (!Number.isFinite(m49)) continue;
      let assigned = 0;
      let joined = 0;
      let weight = 0;
      let joinedWeight = 0;
      grid.cells.forEach(([, , cellM49, w], i) => {
        if (cellM49 !== m49) return;
        weight += w;
        const ridx = regionKeys.cells[i] as number;
        if (ridx < 0) return;
        assigned++;
        const k = regionKeys.keys[ridx] as { geo: string; key: string };
        if (joinable.has(`${k.geo}:${k.key}`) && tier1Keys.has(`${k.geo}:${k.key}`)) {
          joined++;
          joinedWeight += w;
        }
      });
      if (!assigned) continue;
      worst.push({
        country,
        cellPct: Number(((joined / assigned) * 100).toFixed(1)),
        weightPct: Number(((joinedWeight / weight) * 100).toFixed(2)),
      });
    }
    expect(worst.length).toBeGreaterThanOrEqual(15);
    expect(worst.filter((w) => w.cellPct < 90)).toEqual([]);
    expect(worst.filter((w) => w.weightPct < 94)).toEqual([]);
  });
});

describe("age-sex-cells alignment and diagnostics", () => {
  it("stays aligned to the grid it indexes", () => {
    expect(cells.classId).toHaveLength(cells.meta.cellCount);
    expect(cells.tier).toHaveLength(cells.meta.cellCount);
    expect(regionKeys.cells).toHaveLength(cells.meta.cellCount);
    expect(cells.classId.every((id) => id >= 0 && id < cells.archetypes.length)).toBe(true);
  });

  it("records the tier-1 join per country, so a broken key space is visible in the output", () => {
    const byCountry = cells.meta.tier1Join.byCountry;
    expect(Object.keys(byCountry).length).toBeGreaterThan(0);
    for (const [country, row] of Object.entries(byCountry)) {
      expect({ country, joined: row.joined > 0 }).toEqual({ country, joined: true });
    }
  });

  it("keeps every archetype a normalised pyramid", () => {
    for (const a of cells.archetypes) {
      expect(a.m).toHaveLength(9);
      expect(a.f).toHaveLength(9);
      const total = [...a.m, ...a.f].reduce((s, v) => s + v, 0);
      expect(total).toBeGreaterThan(0.99);
      expect(total).toBeLessThan(1.01);
    }
  });
});
