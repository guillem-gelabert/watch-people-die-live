import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The shipped artifact, not the builder: data/cause-cells.json is what the runtime reads, and
// every invariant below is one persona.ts relies on without being able to check it. The builder
// runs by hand off a gitignored IHME export, so a test that re-derives the numbers would need the
// raw file; this tests the contract instead, which is what can actually rot.

interface CauseCells {
  meta: {
    groups: string[];
    groupShareOfDeaths: number;
    archetypes: number;
    cellsReached: number;
    cellDeathShare: number;
    clampedStrata: number;
    totalStrata: number;
    clamp: [number, number];
    citation: string;
  };
  groups: string[];
  labelGroup: Record<string, number>;
  archetypes: { m: number[][]; f: number[][] }[];
  classId: number[];
}

const root = process.cwd();
const cells = JSON.parse(
  readFileSync(join(root, "data", "cause-cells.json"), "utf8"),
) as CauseCells;
const causes = JSON.parse(readFileSync(join(root, "data", "causes.json"), "utf8")) as {
  causes: string[];
};
const rate = JSON.parse(readFileSync(join(root, "data", "rate-grid.json"), "utf8")) as {
  cells: [number, number, number, number][];
};

const SLOTS = cells.groups.length + 1; // the groups, plus the complement
const BANDS = 9;

describe("data/cause-cells.json", () => {
  it("carries the IHME attribution the licence requires", () => {
    expect(cells.meta.citation).toContain("Institute for Health Metrics and Evaluation");
    expect(cells.meta.citation).toContain("Used with permission");
  });

  it("is aligned to the rate grid, cell for cell", () => {
    // persona.ts indexes classId with a cell index from the sampler, which walks rate-grid.json.
    // A length mismatch would not throw there — it would silently reweight the wrong places.
    expect(cells.classId.length).toBe(rate.cells.length);
  });

  it("names only causes the export actually ships", () => {
    const known = new Set(causes.causes);
    const unknown = Object.keys(cells.labelGroup).filter((l) => !known.has(l));
    expect(unknown).toEqual([]);
  });

  it("maps every crosswalk label to a real group", () => {
    for (const [label, group] of Object.entries(cells.labelGroup)) {
      expect(group, label).toBeGreaterThanOrEqual(0);
      expect(group, label).toBeLessThan(cells.groups.length);
    }
  });

  it("does not put respiratory infections or tuberculosis under chronic respiratory", () => {
    // The easiest mistake in the crosswalk, and one no type can catch: GBD keeps infections in a
    // separate chapter this download does not contain, so these must fall to the complement.
    for (const label of [
      "lower respiratory infection",
      "upper respiratory infections",
      "tuberculosis",
    ])
      expect(cells.labelGroup[label], label).toBeUndefined();
  });

  it("gives every archetype a full, finite, positive multiplier for both sexes", () => {
    // Collected rather than asserted per value: 444 archetypes x 2 sexes x 9 bands x 4 slots is
    // ~32,000 expects, which is slow enough to time the whole suite out. One assertion at the end
    // is faster and names every offender at once instead of stopping at the first.
    expect(cells.archetypes.length).toBe(cells.meta.archetypes);
    const [lo, hi] = cells.meta.clamp;
    const bad: string[] = [];
    for (const [i, a] of cells.archetypes.entries()) {
      for (const sex of ["m", "f"] as const) {
        if (a[sex].length !== BANDS) bad.push(`archetype ${i} ${sex}: ${a[sex].length} bands`);
        for (const [b, row] of a[sex].entries()) {
          if (row.length !== SLOTS)
            bad.push(`archetype ${i} ${sex} band ${b}: ${row.length} slots`);
          for (const [g, v] of row.entries()) {
            if (!Number.isFinite(v) || v < lo || v > hi)
              bad.push(`archetype ${i} ${sex} band ${b} slot ${g}: ${v}`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("points every assigned cell at an archetype that exists", () => {
    let assigned = 0;
    for (const id of cells.classId) {
      if (id < 0) continue;
      assigned++;
      expect(cells.archetypes[id]).toBeDefined();
    }
    expect(assigned).toBe(cells.meta.cellsReached);
    expect(assigned).toBeGreaterThan(0);
  });

  it("reaches the same share of deaths the regional pyramids do", () => {
    // Both layers resolve through the same 474 region keys, so the cause layer cannot reach more
    // cells than the tier-0 pyramid layer. If this drifts, one of the two joins has changed.
    expect(cells.meta.cellDeathShare).toBeGreaterThan(0.4);
    expect(cells.meta.cellDeathShare).toBeLessThan(0.5);
  });

  it("clamps rarely enough that the clamp is a guard and not the model", () => {
    expect(cells.meta.clampedStrata / cells.meta.totalStrata).toBeLessThan(0.02);
  });

  it("states how much of the cause space the downloaded groups actually cover", () => {
    // One download of the eight landed, so this is a partial layer by construction. The figure is
    // load-bearing for the story's prose and for knowing what the complement is carrying.
    expect(cells.meta.groupShareOfDeaths).toBeGreaterThan(0.5);
    expect(cells.meta.groupShareOfDeaths).toBeLessThan(0.6);
  });
});
