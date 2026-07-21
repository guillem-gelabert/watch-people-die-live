import { describe, expect, it } from "vitest";
import type {
  Admin1Feature,
  CountryFeature,
  SeasonalityData,
  SubnationalSeasonalityRegion,
} from "../types";
import { buildFallbackDonorCoverage } from "./fallbackDonorCoverage";

const feature = (id: number, name: string, latitude: number): CountryFeature => ({
  type: "Feature",
  id,
  properties: { name },
  geometry: { type: "Point", coordinates: [0, latitude] },
});

const curve = (high: number, low: number) =>
  Array.from({ length: 12 }, (_, index) => (index % 2 ? low : high));

describe("buildFallbackDonorCoverage", () => {
  it("generates all three fallback amplitudes and reports their spread", () => {
    const seasonality: SeasonalityData = {
      source: "test",
      method: "test",
      months: 12,
      fallback: {
        north: curve(1.1, 0.9),
        amplitudeCoef: [0, 0, 10],
        ampClamp: [1, 20],
      },
      countries: { 32: curve(1.2, 0.8), 840: curve(1.2, 0.8) },
      climate: {
        classCurves: { Cfa: curve(1.05, 0.95) },
        familyCurves: { C: curve(1.04, 0.96) },
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
        isoRegion: "AU-1",
        interval: "month",
        curve: curve(1.3, 0.7),
        nYears: 1,
        annualDeaths: 1,
        measurement: "crvs",
        kgFamily: "C",
      },
    ];
    const admin1Features: Admin1Feature[] = [
      {
        type: "Feature",
        id: "AUS-1",
        properties: { adm1_code: "AUS-1", name: "Region 1", adm0_a3: "AUS" },
        geometry: { type: "Point", coordinates: [0, 35] },
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
      admin1Features,
    );

    const classTarget = coverage.find((row) => row.m49 === 36);
    expect(classTarget).toMatchObject({
      country: "Class target",
      latitude: { countryDonors: 1, regionDonors: 1 },
      climate: { countryDonors: 2, regionDonors: 1, label: "Cfa class" },
      neighbor: { countryDonors: 0, regionDonors: 1 },
    });
    expect(classTarget?.latitude.amplitude).toBeCloseTo(0.1);
    expect(classTarget?.climate.amplitude).toBeCloseTo(0.05);
    expect(classTarget?.neighbor.amplitude).toBeCloseTo(0.3);
    expect(classTarget?.amplitudeSpread).toBeCloseTo(0.25);

    const familyTarget = coverage.find((row) => row.m49 === 4);
    expect(familyTarget).toMatchObject({
      country: "Family target",
      latitude: { countryDonors: 1, regionDonors: 0 },
      climate: { countryDonors: 2, regionDonors: 1, label: "C family" },
      neighbor: { countryDonors: 1, regionDonors: 0 },
    });
    expect(familyTarget?.climate.amplitude).toBeCloseTo(0.04);
    expect(familyTarget?.amplitudeSpread).toBeCloseTo(0.16);
  });
});
