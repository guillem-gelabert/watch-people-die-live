import { describe, expect, it } from "vitest";
import type {
  Admin1Feature,
  CountryFeature,
  SeasonalityData,
  SubnationalSeasonalityRegion,
} from "../app/roadmap/types";
import {
  buildFallbackProxyAssignments,
  CLIMATE_METHOD_QUALITY_WEIGHT,
  FALLBACK_PROXY_OVERRIDES,
} from "./fallback-proxy-assignment";

const feature = (id: number, name: string, latitude: number, longitude = 0): CountryFeature => ({
  type: "Feature",
  id,
  properties: { name },
  geometry: { type: "Point", coordinates: [longitude, latitude] },
});

const curve = (high: number, low: number) =>
  Array.from({ length: 12 }, (_, index) => (index % 2 ? low : high));

describe("buildFallbackProxyAssignments", () => {
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
      quality: {
        32: { nYears: 2 },
        840: { nYears: 10 },
      },
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
    const coverage = buildFallbackProxyAssignments(
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
      latitude: { qualityAdjustedDonors: 2.25 },
      climate: { qualityAdjustedDonors: 12.0625, label: "Cfa class" },
      neighbor: { qualityAdjustedDonors: 0.75, donorCoverage: 1 },
    });
    expect(classTarget?.latitude.amplitude).toBeCloseTo(0.1);
    expect(classTarget?.climate.amplitude).toBeCloseTo(0.05);
    expect(classTarget?.neighbor.amplitude).toBeCloseTo(0.3);
    expect(classTarget?.amplitudeSpread).toBeCloseTo(0.25);
    expect(classTarget?.highestQualityDonorGroup).toMatchObject({
      groups: ["Regional / neighbour"],
    });

    const familyTarget = coverage.find((row) => row.m49 === 4);
    expect(familyTarget).toMatchObject({
      country: "Family target",
      latitude: { qualityAdjustedDonors: 10 },
      climate: { qualityAdjustedDonors: 9.1875, label: "C family" },
      neighbor: { qualityAdjustedDonors: 1.5, donorCoverage: 1 },
    });
    expect(familyTarget?.climate.amplitude).toBeCloseTo(0.04);
    expect(familyTarget?.amplitudeSpread).toBeCloseTo(0.16);
    expect(familyTarget?.highestQualityDonorGroup).toMatchObject({ groups: ["Climate"] });
  });

  it("prioritizes a climate sub-class over closer latitude donors", () => {
    const nearDonors = [
      feature(124, "Near 1", 11, -2),
      feature(484, "Near 2", 11, -1),
      feature(840, "Near 3", 11, 1),
      feature(76, "Near 4", 11, 2),
    ];
    const distantDonors = [
      feature(32, "Distant 1", -10, 130),
      feature(152, "Distant 2", -10, 140),
      feature(710, "Distant 3", -10, 150),
      feature(554, "Distant 4", -10, 160),
      feature(858, "Distant 5", -10, 170),
    ];
    const observed = [...nearDonors, ...distantDonors];
    const countries = Object.fromEntries(
      observed.map((donor) => [String(donor.id), curve(1.1, 0.9)]),
    );
    const quality = Object.fromEntries(observed.map((donor) => [String(donor.id), { nYears: 1 }]));
    const byM49 = Object.fromEntries([
      ...nearDonors.map((donor) => [String(donor.id), { kgClass: "BWh", kgFamily: "B" }]),
      ...distantDonors.map((donor) => [String(donor.id), { kgClass: "Af", kgFamily: "A" }]),
    ]);
    const seasonality: SeasonalityData = {
      source: "test",
      method: "test",
      months: 12,
      fallback: {
        north: curve(1.1, 0.9),
        amplitudeCoef: [0, 0, 10],
        ampClamp: [1, 20],
      },
      countries,
      quality,
      climate: {
        classCurves: { Af: curve(1.05, 0.95) },
        familyCurves: { A: curve(1.04, 0.96) },
        classByM49: { 4: { class: "Af", family: "A" } },
      },
    };

    const [target] = buildFallbackProxyAssignments(
      [feature(4, "Target", 10), ...observed],
      seasonality,
      { meta: { source: "test" }, byM49 },
      new Map(),
    );

    expect(target?.climate.qualityAdjustedDonors).toBeGreaterThan(
      target?.latitude.qualityAdjustedDonors ?? 0,
    );
    expect(target?.highestQualityDonorGroup?.groups).toEqual(["Climate"]);

    const [targetWithCompleteNeighborCoverage] = buildFallbackProxyAssignments(
      [feature(4, "Target", 10), ...observed],
      seasonality,
      { meta: { source: "test" }, byM49 },
      new Map([[4, [124]]]),
    );

    expect(targetWithCompleteNeighborCoverage?.neighbor.donorCoverage).toBe(1);
    expect(targetWithCompleteNeighborCoverage?.highestQualityDonorGroup?.groups).toEqual([
      "Regional / neighbour",
    ]);
  });

  it("uses validated climate performance to break an otherwise equal tie with latitude", () => {
    const seasonality: SeasonalityData = {
      source: "test",
      method: "test",
      months: 12,
      fallback: {
        north: curve(1.1, 0.9),
        amplitudeCoef: [0, 0, 10],
        ampClamp: [1, 20],
      },
      countries: { 124: curve(1.1, 0.9) },
      quality: { 124: { nYears: 1 } },
      climate: {
        classCurves: { Cfa: curve(1.05, 0.95) },
        familyCurves: { C: curve(1.04, 0.96) },
        classByM49: { 4: { class: "Cfa", family: "C" } },
      },
    };

    const [target] = buildFallbackProxyAssignments(
      [feature(4, "Target", 10), feature(124, "Donor", 11)],
      seasonality,
      {
        meta: { source: "test" },
        byM49: { 124: { kgClass: "Cfa", kgFamily: "C" } },
      },
      new Map(),
    );

    expect(target?.climate.distanceAdjustedDonors).toBeCloseTo(
      (target?.latitude.distanceAdjustedDonors ?? 0) * CLIMATE_METHOD_QUALITY_WEIGHT,
    );
    expect(target?.highestQualityDonorGroup?.groups).toEqual(["Climate"]);
  });

  it("uses directly bordering regions or national curves for modeled regional targets", () => {
    const seasonality: SeasonalityData = {
      source: "test",
      method: "test",
      months: 12,
      fallback: {
        north: curve(1.1, 0.9),
        amplitudeCoef: [0, 0, 10],
        ampClamp: [1, 20],
      },
      countries: { 643: curve(1.2, 0.8) },
      quality: { 643: { nYears: 10 } },
      climate: {
        classCurves: { Cfa: curve(1.05, 0.95) },
        familyCurves: { C: curve(1.04, 0.96) },
        classByM49: {},
      },
    };
    const modeledRegion: SubnationalSeasonalityRegion = {
      country: "CHN",
      geo: "adm1",
      key: "CHN-1828",
      name: "Jilin",
      isoRegion: "CN-JL",
      interval: "month",
      curve: curve(1.05, 0.95),
      nYears: null,
      annualDeaths: 1,
      measurement: "climate-modeled",
      kgFamily: "C",
    };
    const admin1Features: Admin1Feature[] = [
      {
        type: "Feature",
        id: "CHN-1828",
        properties: { adm1_code: "CHN-1828", name: "Jilin", adm0_a3: "CHN" },
        geometry: { type: "Point", coordinates: [130, 48] },
      },
      {
        type: "Feature",
        id: "RUS-1",
        properties: { adm1_code: "RUS-1", name: "Amur", adm0_a3: "RUS" },
        geometry: { type: "Point", coordinates: [128, 50] },
      },
    ];

    const coverage = buildFallbackProxyAssignments(
      [feature(156, "China", 35), feature(643, "Russia", 60)],
      seasonality,
      { meta: { source: "test" }, byM49: { 643: { kgClass: "Cfa", kgFamily: "C" } } },
      new Map(),
      [modeledRegion],
      admin1Features,
      new Map([["CHN-1828", ["RUS-1"]]]),
    );

    const target = coverage.find((row) => row.id === "region-CHN-1828");
    expect(target?.neighbor).toMatchObject({ donorCoverage: 1 });
    expect(target?.neighbor.qualityAdjustedDonors).toBeGreaterThan(0);
    expect(target?.neighbor.amplitude).toBeCloseTo(0.2);
    expect(target?.highestQualityDonorGroup?.groups).toEqual(["Regional / neighbour"]);
    expect(target?.appliedProxy).toMatchObject({ group: "Climate", overridden: true });
    expect(Object.keys(FALLBACK_PROXY_OVERRIDES).sort()).toEqual(
      [
        "region-CHN-1151",
        "region-CHN-1662",
        "region-CHN-1804",
        "region-CHN-1814",
        "region-CHN-1828",
      ].sort(),
    );
  });

  it("replaces India and China country rows with climate fallback rows for each modeled region", () => {
    const seasonality: SeasonalityData = {
      source: "test",
      method: "test",
      months: 12,
      fallback: {
        north: curve(1.1, 0.9),
        amplitudeCoef: [0, 0, 10],
        ampClamp: [1, 20],
      },
      countries: { 840: curve(1.1, 0.9) },
      quality: { 840: { nYears: 10 } },
      climate: {
        classCurves: { Cfa: curve(1.05, 0.95) },
        familyCurves: { C: curve(1.04, 0.96) },
        classByM49: { 356: { class: "Cfa", family: "C" } },
      },
    };
    const modeledRegion: SubnationalSeasonalityRegion = {
      country: "IND",
      geo: "adm1",
      key: "IND-1",
      name: "Test region",
      isoRegion: "IN-TS",
      interval: "month",
      curve: curve(1.05, 0.95),
      nYears: null,
      annualDeaths: 1,
      measurement: "climate-modeled",
      kgFamily: "C",
    };
    const admin1Features: Admin1Feature[] = [
      {
        type: "Feature",
        id: "IND-1",
        properties: { adm1_code: "IND-1", name: "Test region", adm0_a3: "IND" },
        geometry: { type: "Point", coordinates: [0, 10] },
      },
    ];

    const coverage = buildFallbackProxyAssignments(
      [feature(356, "India", 20), feature(840, "Donor", 11)],
      seasonality,
      { meta: { source: "test" }, byM49: { 840: { kgClass: "Cfa", kgFamily: "C" } } },
      new Map(),
      [modeledRegion],
      admin1Features,
    );

    expect(coverage.find((row) => row.m49 === 356 && !row.isRegional)).toBeUndefined();
    expect(coverage).toContainEqual(
      expect.objectContaining({
        id: "region-IND-1",
        country: "India — Test region",
        isRegional: true,
        climate: expect.objectContaining({ label: "Cfa class" }),
      }),
    );
  });
});
