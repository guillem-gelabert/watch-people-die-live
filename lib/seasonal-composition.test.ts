import { describe, expect, it } from "vitest";
import type { Feature, Point } from "geojson";
import {
  buildSeasonalComposition,
  measuredM49Curves,
  transferDimension,
  type SeasonalCompositionData,
} from "./seasonal-composition";
import { buildClimateBlend } from "./spatial-seasonality";
import { evaluateHarmonicCurve, type HarmonicCurve } from "./seasonal-curve";

function country(id: number, name: string, coordinates: [number, number]): Feature<Point> {
  return { type: "Feature", id, properties: { name }, geometry: { type: "Point", coordinates } };
}

function curve(cosine: number, sine = 0): HarmonicCurve {
  return { order: 4, coefficients: [1, cosine, sine, 0, 0, 0, 0, 0, 0] };
}

describe("measuredM49Curves", () => {
  it("converts ISO3 keys to m49 and drops unresolvable or null entries", () => {
    const out = measuredM49Curves({ ESP: curve(0.2), ZZZ: curve(0.1), MEX: null });
    expect(out.size).toBe(1);
    expect(out.get(724)).toEqual(curve(0.2)); // Spain's m49
  });
});

describe("buildClimateBlend", () => {
  it("blends measured donors by Köppen class and family", () => {
    const measured = new Map([
      [788, curve(0.2)], // Tunisia
      [12, curve(0.4)], // Algeria, same class
    ]);
    const classByM49 = {
      "788": { class: "BSh", family: "B" },
      "12": { class: "BSh", family: "B" },
    };
    const model = buildClimateBlend(classByM49, measured);
    expect(model.classCurves.BSh?.coefficients[1]).toBeCloseTo(0.3);
    expect(model.familyCurves.B?.coefficients[1]).toBeCloseTo(0.3);
    expect(model.classByM49).toBe(classByM49);
  });
});

describe("transferDimension", () => {
  it("reaches a bordering country from a single measured donor", () => {
    const features = [country(434, "Libya", [18, 27]), country(788, "Tunisia", [10, 34])];
    const neighbors = new Map([[434, [788]]]);
    const estimates = transferDimension(new Map([[788, curve(0.3)]]), features, neighbors, {});
    expect(estimates.get(434)?.coefficients[1]).toBeCloseTo(0.3);
  });

  it("returns an empty map when nothing is measured", () => {
    expect(transferDimension(new Map(), [], new Map(), {}).size).toBe(0);
  });
});

const DATA: SeasonalCompositionData = {
  meta: {
    ageBands: [
      [0, 0],
      [1, 4],
      [5, 14],
    ],
    causeChapters: ["IX", "X"],
    causeLeafGroups: ["drowning"],
    chapterOfCauseLabel: { "ischaemic heart disease": "IX", "lower respiratory infection": "X" },
    ageCountriesMeasured: ["ESP"],
    causeCountriesMeasured: ["BRA"],
  },
  age: { countries: { ESP: [curve(0.1), curve(0.1), null] } },
  cause: {
    countries: {
      BRA: { chapters: { IX: curve(0.05) }, leaf: { drowning: curve(0.4) } },
    },
  },
};

describe("buildSeasonalComposition", () => {
  const features = [country(724, "Spain", [-3, 40]), country(76, "Brazil", [-51, -10])];
  const runtime = buildSeasonalComposition(DATA, features, new Map(), {});

  it("returns the measured curve's own value for a covered band and country", () => {
    const m49 = 724; // Spain
    expect(runtime.ageMultiplier(m49, 0, 0)).toBeCloseTo(evaluateHarmonicCurve(curve(0.1), 0));
  });

  it("falls back to 1 for an unmeasured band even when the country is otherwise covered", () => {
    expect(runtime.ageMultiplier(724, 2, 0)).toBe(1);
  });

  it("falls back to 1 for an unmeasured country and for an undefined m49", () => {
    expect(runtime.ageMultiplier(999, 0, 0)).toBe(1);
    expect(runtime.ageMultiplier(undefined, 0, 0)).toBe(1);
  });

  it("prefers a leaf-group curve over the label's chapter when the label is a leaf group", () => {
    // "drowning" is not in chapterOfCauseLabel, so only the leaf path can resolve it.
    const value = runtime.causeMultiplier(76, "drowning", 0);
    expect(value).toBeCloseTo(evaluateHarmonicCurve(curve(0.4), 0));
    expect(value).not.toBe(1);
  });

  it("falls back to the label's ICD-10 chapter when it is not a leaf group", () => {
    const value = runtime.causeMultiplier(76, "ischaemic heart disease", 0);
    expect(value).toBeCloseTo(evaluateHarmonicCurve(curve(0.05), 0));
  });

  it("returns 1 for a label with neither a leaf group nor a known chapter", () => {
    expect(runtime.causeMultiplier(76, "an undetermined cause", 0)).toBe(1);
  });
});
