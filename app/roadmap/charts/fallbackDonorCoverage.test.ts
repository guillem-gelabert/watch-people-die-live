import { describe, expect, it } from "vitest";
import type { CountryFeature, SeasonalityData, SubnationalSeasonalityRegion } from "../types";
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
      countries: { 32: [1], 840: [1] },
      climate: {
        classCurves: { Cfa: [1] },
        familyCurves: { C: [1] },
        classByM49: {
          36: { class: "Cfa", family: "C" },
          4: { class: "Cwb", family: "C" },
        },
      },
    };
    const regions: SubnationalSeasonalityRegion[] = [
      {
        country: "AUS",
        geo: "adm1",
        key: "AUS-1",
        name: "Region 1",
        isoRegion: "XX-1",
        interval: "month",
        curve: [1],
        nYears: 1,
        annualDeaths: 1,
        measurement: "crvs",
      },
    ];
    const coverage = buildFallbackDonorCoverage(
      [
        feature(32, "Observed A", 30),
        feature(840, "Observed B", -30),
        feature(36, "Class target", 35),
        feature(4, "Family target", -28),
      ],
      seasonality,
      {
        meta: { source: "test" },
        byM49: {
          32: { kgClass: "Cfa", kgFamily: "C" },
          840: { kgClass: "Cfa", kgFamily: "C" },
        },
      },
      new Map([
        [36, [32, 840]],
        [4, [32]],
      ]),
      regions,
    );

    expect(coverage).toEqual([
      {
        m49: 36,
        country: "Class target",
        latitudeDonors: 1,
        climateDonors: 2,
        climateLabel: "Cfa class",
        localDonors: 1,
        localDonorUnit: "regions",
      },
      {
        m49: 4,
        country: "Family target",
        latitudeDonors: 1,
        climateDonors: 2,
        climateLabel: "C family",
        localDonors: 1,
        localDonorUnit: "countries",
      },
    ]);
  });
});
