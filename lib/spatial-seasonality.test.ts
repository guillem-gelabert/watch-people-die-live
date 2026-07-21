import { describe, expect, it } from "vitest";
import type { Feature, Point } from "geojson";
import { buildSpatialSeasonality, type SpatialSeasonalityRegion } from "./spatial-seasonality";

function country(id: number, name: string, coordinates: [number, number]): Feature<Point> {
  return { type: "Feature", id, properties: { name }, geometry: { type: "Point", coordinates } };
}

describe("buildSpatialSeasonality", () => {
  it("uses the mean curve of measured bordering countries for Libya", () => {
    const features = [
      country(434, "Libya", [18, 27]),
      country(788, "Tunisia", [10, 34]),
      country(12, "Algeria", [3, 28]),
      country(818, "Egypt", [30, 27]),
    ];
    const neighbors = new Map([[434, [788, 12, 818]]]);
    const seasonality = {
      countries: {
        "788": [1.216, 0.8],
        "12": [1.092, 0.9],
        "818": [1.096, 0.9],
      },
    };

    const estimate = buildSpatialSeasonality(features, neighbors, seasonality).get(434);
    expect(estimate?.source).toBe("bordering-countries");
    expect(estimate?.donorNames).toEqual(["Tunisia", "Algeria", "Egypt"]);
    expect(estimate?.curve).toEqual([1.1346666666666667, 0.8666666666666667]);
  });

  it("prefers a country's own measured regions and death-weights their curves", () => {
    const features = [country(356, "India", [79, 22]), country(586, "Pakistan", [69, 30])];
    const regions: SpatialSeasonalityRegion[] = [
      {
        country: "IND",
        geo: "adm1",
        name: "Region A",
        curve: [1.2, 0.8],
        annualDeaths: 300,
      },
      {
        country: "IND",
        geo: "adm1",
        name: "Region B",
        curve: [0.8, 1.2],
        annualDeaths: 100,
      },
    ];

    const estimate = buildSpatialSeasonality(features, new Map(), { countries: {} }, regions).get(
      356,
    );
    expect(estimate?.source).toBe("own-regions");
    expect(estimate?.curve).toEqual([1.1, 0.9]);
  });

  it("uses the population-weighted climate blend when no bordering donor exists", () => {
    const features = [country(352, "Iceland", [-19, 65])];
    const estimate = buildSpatialSeasonality(features, new Map(), {
      countries: {},
      climate: {
        classByM49: { "352": { class: "ET", family: "E" } },
        classCurves: {}, // no class donor -> falls back to family
        familyCurves: { E: [1.2, 0.8] },
      },
    }).get(352);
    expect(estimate?.source).toBe("climate");
    expect(estimate?.donorNames).toEqual(["E climate"]);
    expect(estimate?.curve).toEqual([1.2, 0.8]);
  });

  it("prefers class over family and re-phases the blend for a southern target", () => {
    const canonical = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const features = [country(36, "Australia", [134, -25])];
    const estimate = buildSpatialSeasonality(features, new Map(), {
      countries: {},
      climate: {
        classByM49: { "36": { class: "BWh", family: "B" } },
        classCurves: { BWh: canonical },
        familyCurves: { B: [9, 9] },
      },
    }).get(36);
    expect(estimate?.source).toBe("climate");
    expect(estimate?.donorNames).toEqual(["BWh climate"]);
    // southern hemisphere -> shifted six months: curve[m] = canonical[(m + 6) % 12]
    expect(estimate?.curve).toEqual([7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6]);
  });

  it("falls through to latitude when neither class nor family has a donor", () => {
    const features = [country(999, "X", [0, 50])];
    const estimate = buildSpatialSeasonality(features, new Map(), {
      countries: {},
      fallback: {
        north: [1.1, 1.08, 1.05, 1.01, 0.97, 0.94, 0.92, 0.9, 0.93, 0.97, 1.01, 1.09],
        tropicMaxAbsLat: 10,
        plateauAbsLat: 40,
      },
      climate: {
        classByM49: { "999": { class: "Zz", family: "Q" } },
        classCurves: {},
        familyCurves: {},
      },
    }).get(999);
    expect(estimate?.source).toBe("latitude");
  });

  it("uses latitude when no measured border donor exists", () => {
    const features = [country(352, "Iceland", [-19, 65])];
    const estimates = buildSpatialSeasonality(features, new Map(), {
      countries: {},
      fallback: {
        north: [1.1, 1.08, 1.05, 1.01, 0.97, 0.94, 0.92, 0.9, 0.93, 0.97, 1.01, 1.09],
        tropicMaxAbsLat: 10,
        plateauAbsLat: 40,
      },
    });

    expect(estimates.get(352)?.source).toBe("latitude");
    expect(estimates.get(352)?.donorNames).toEqual(["65.0°N"]);
    expect(estimates.get(352)?.curve).toEqual([
      1.1, 1.08, 1.05, 1.01, 0.97, 0.94, 0.92, 0.9, 0.93, 0.97, 1.01, 1.09,
    ]);
  });

  it("rescales the quadratic RMS latitude model into a complete fallback curve", () => {
    const features = [country(999, "Missing", [0, 27])];
    const estimates = buildSpatialSeasonality(features, new Map(), {
      countries: {},
      fallback: {
        north: [1.1, 1.1, 1.1, 0.9, 0.9, 0.9, 1.1, 1.1, 1.1, 0.9, 0.9, 0.9],
        amplitudeCoef: [0, 0, 5],
        ampClamp: [1, 10],
      },
    });

    expect(estimates.get(999)?.source).toBe("latitude");
    expect(estimates.get(999)?.curve[0]).toBeCloseTo(1.05);
    expect(estimates.get(999)?.curve[3]).toBeCloseTo(0.95);
  });

  it("applies the persisted proxy assignment ahead of the default fallback order", () => {
    const features = [country(434, "Libya", [18, 27]), country(788, "Tunisia", [10, 34])];
    const estimates = buildSpatialSeasonality(
      features,
      new Map([[434, [788]]]),
      { countries: { 788: [1.2, 0.8] } },
      [],
      {
        meta: {},
        countries: {
          434: {
            curve: [1.05, 0.95],
            source: "climate",
            proxy: "Climate",
          },
        },
        regions: {},
      },
    );

    expect(estimates.get(434)).toMatchObject({ source: "climate", curve: [1.05, 0.95] });
  });

  it("uses persisted regional assignments when aggregating an unobserved country", () => {
    const regions: SpatialSeasonalityRegion[] = [
      {
        country: "IND",
        geo: "adm1",
        key: "IND-1",
        name: "Region A",
        curve: [1.2, 0.8],
        annualDeaths: 100,
      },
    ];
    const estimates = buildSpatialSeasonality(
      [country(356, "India", [79, 22])],
      new Map(),
      { countries: {} },
      regions,
      {
        meta: {},
        countries: {},
        regions: {
          "IND-1": {
            curve: [0.9, 1.1],
            source: "latitude",
            proxy: "Latitude",
          },
        },
      },
    );

    expect(estimates.get(356)).toMatchObject({ source: "own-regions", curve: [0.9, 1.1] });
  });
});
