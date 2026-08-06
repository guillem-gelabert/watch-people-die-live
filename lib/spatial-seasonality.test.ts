import { describe, expect, it } from "vitest";
import type { Feature, Point } from "geojson";
import { buildSpatialSeasonality, type SpatialSeasonalityRegion } from "./spatial-seasonality";
import { evaluateHarmonicCurve, type HarmonicCurve } from "./seasonal-curve";

function country(id: number, name: string, coordinates: [number, number]): Feature<Point> {
  return { type: "Feature", id, properties: { name }, geometry: { type: "Point", coordinates } };
}

function curve(cosine: number, sine = 0): HarmonicCurve {
  return { order: 4, coefficients: [1, cosine, sine, 0, 0, 0, 0, 0, 0] };
}

describe("buildSpatialSeasonality", () => {
  it("uses the coefficient mean of measured bordering countries", () => {
    const features = [
      country(434, "Libya", [18, 27]),
      country(788, "Tunisia", [10, 34]),
      country(12, "Algeria", [3, 28]),
      country(818, "Egypt", [30, 27]),
    ];
    const estimate = buildSpatialSeasonality(features, new Map([[434, [788, 12, 818]]]), {
      countries: { 788: curve(0.216), 12: curve(0.092), 818: curve(0.096) },
    }).get(434);
    expect(estimate?.source).toBe("bordering-countries");
    expect(estimate?.donorNames).toEqual(["Tunisia", "Algeria", "Egypt"]);
    expect(estimate?.curve.coefficients[1]).toBeCloseTo(0.1346666667);
  });

  it("death-weights a country's measured regions", () => {
    const regions: SpatialSeasonalityRegion[] = [
      { country: "IND", geo: "adm1", name: "A", curve: curve(0.2), annualDeaths: 300 },
      { country: "IND", geo: "adm1", name: "B", curve: curve(-0.2), annualDeaths: 100 },
    ];
    const estimate = buildSpatialSeasonality(
      [country(356, "India", [79, 22])],
      new Map(),
      { countries: {} },
      regions,
    ).get(356);
    expect(estimate?.source).toBe("own-regions");
    expect(estimate?.curve.coefficients[1]).toBeCloseTo(0.1);
  });

  it("uses family climate when no class blend exists", () => {
    const estimate = buildSpatialSeasonality([country(352, "Iceland", [-19, 65])], new Map(), {
      countries: {},
      climate: {
        classByM49: { 352: { class: "ET", family: "E" } },
        classCurves: {},
        familyCurves: { E: curve(0.2) },
      },
    }).get(352);
    expect(estimate).toMatchObject({ source: "climate", donorNames: ["E climate"] });
  });

  it("prefers class over family and rephases a southern target", () => {
    const estimate = buildSpatialSeasonality([country(36, "Australia", [134, -25])], new Map(), {
      countries: {},
      climate: {
        classByM49: { 36: { class: "BWh", family: "B" } },
        classCurves: { BWh: curve(0.2, 0.1) },
        familyCurves: { B: curve(0.9) },
      },
    }).get(36);
    expect(estimate?.source).toBe("climate");
    expect(estimate?.curve.coefficients.slice(1, 3)).toEqual([-0.2, -0.1]);
  });

  it("falls through to a latitude-scaled harmonic", () => {
    const estimate = buildSpatialSeasonality([country(999, "X", [0, 50])], new Map(), {
      countries: {},
      fallback: { north: curve(0.1), tropicMaxAbsLat: 10, plateauAbsLat: 40 },
      climate: {
        classByM49: { 999: { class: "Zz", family: "Q" } },
        classCurves: {},
        familyCurves: {},
      },
    }).get(999);
    expect(estimate?.source).toBe("latitude");
    expect(estimate?.curve.coefficients[1]).toBeCloseTo(0.1);
  });

  it("rescales the quadratic RMS latitude model", () => {
    const estimate = buildSpatialSeasonality([country(999, "Missing", [0, 27])], new Map(), {
      countries: {},
      fallback: { north: curve(Math.sqrt(0.02)), amplitudeCoef: [0, 0, 5], ampClamp: [1, 10] },
    }).get(999);
    expect(estimate?.source).toBe("latitude");
    expect(evaluateHarmonicCurve(estimate!.curve, 0)).toBeCloseTo(1 + Math.sqrt(0.005));
  });

  it("applies a persisted country proxy ahead of the default fallback", () => {
    const applied = curve(0.05);
    const estimates = buildSpatialSeasonality(
      [country(434, "Libya", [18, 27]), country(788, "Tunisia", [10, 34])],
      new Map([[434, [788]]]),
      { countries: { 788: curve(0.2) } },
      [],
      {
        meta: {},
        countries: { 434: { curve: applied, source: "climate", proxy: "Climate" } },
        regions: {},
      },
    );
    expect(estimates.get(434)).toMatchObject({ source: "climate", curve: applied });
  });

  it("uses persisted regional assignments in an unobserved-country aggregate", () => {
    const regions: SpatialSeasonalityRegion[] = [
      {
        country: "IND",
        geo: "adm1",
        key: "IND-1",
        name: "A",
        curve: curve(0.2),
        annualDeaths: 100,
      },
    ];
    const applied = curve(-0.1);
    const estimates = buildSpatialSeasonality(
      [country(356, "India", [79, 22])],
      new Map(),
      { countries: {} },
      regions,
      {
        meta: {},
        countries: {},
        regions: { "IND-1": { curve: applied, source: "latitude", proxy: "Latitude" } },
      },
    );
    expect(estimates.get(356)).toMatchObject({ source: "own-regions", curve: applied });
  });
});
