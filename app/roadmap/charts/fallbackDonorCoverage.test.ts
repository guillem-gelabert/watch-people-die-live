import { describe, expect, it } from "vitest";
import type { CountryFeature, SeasonalityData } from "../types";
import { buildFallbackDonorCoverage } from "./fallbackDonorCoverage";

const feature = (id: number, name: string, latitude: number): CountryFeature => ({
  type: "Feature",
  id,
  properties: { name },
  geometry: { type: "Point", coordinates: [0, latitude] },
});

describe("buildFallbackDonorCoverage", () => {
  it("counts direct observed-country donors for each independent fallback", () => {
    const seasonality: SeasonalityData = {
      source: "test",
      method: "test",
      months: 12,
      fallback: { north: [] },
      countries: { 1: [1], 2: [1] },
      climate: {
        classCurves: { Cfa: [1] },
        familyCurves: { C: [1] },
        classByM49: {
          3: { class: "Cfa", family: "C" },
          4: { class: "Cwb", family: "C" },
        },
      },
    };
    const coverage = buildFallbackDonorCoverage(
      [
        feature(1, "Observed A", 30),
        feature(2, "Observed B", -30),
        feature(3, "Class target", 35),
        feature(4, "Family target", -28),
      ],
      seasonality,
      {
        meta: { source: "test" },
        byM49: {
          1: { kgClass: "Cfa", kgFamily: "C" },
          2: { kgClass: "Cfa", kgFamily: "C" },
        },
      },
      new Map([
        [3, [1, 2]],
        [4, [1]],
      ]),
    );

    expect(coverage).toEqual([
      {
        m49: 3,
        country: "Class target",
        latitudeDonors: 1,
        climateDonors: 2,
        climateLabel: "Cfa class",
        neighborDonors: 2,
      },
      {
        m49: 4,
        country: "Family target",
        latitudeDonors: 1,
        climateDonors: 2,
        climateLabel: "C family",
        neighborDonors: 1,
      },
    ]);
  });
});
