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
});
