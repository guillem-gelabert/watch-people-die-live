import { describe, expect, it } from "vitest";
import {
  buildClimateSubclassPerformance,
  buildCohortPerformance,
  buildLatitudePerformance,
} from "./validationCohorts";

const curve = [1.1, 1.05, 1, 1, 1, 1, 0.95, 0.95, 1, 1, 1, 1];
const validation = {
  meta: { source: "test", nCountries: 3, droppedNoTemperature: [] },
  comparisonTable: [],
  perCountry: [
    {
      m49: 1,
      name: "Tropical island",
      actual: curve,
      latitude_prediction: curve,
      climate_prediction: curve.map((value) => value + 0.01),
      neighbor_prediction: curve.map((value) => value + 0.02),
      latitude_rmse: 0,
      climate_rmse: 0.01,
      neighbor_rmse: 0.02,
    },
    {
      m49: 2,
      name: "Temperate mainland",
      actual: curve,
      latitude_prediction: curve.map((value) => value + 0.03),
      climate_prediction: curve,
      neighbor_prediction: curve.map((value) => value + 0.01),
      latitude_rmse: 0.03,
      climate_rmse: 0,
      neighbor_rmse: 0.01,
    },
    {
      m49: 3,
      name: "Continental mainland",
      actual: curve,
      latitude_prediction: curve.map((value) => value + 0.02),
      climate_prediction: curve.map((value) => value + 0.01),
      neighbor_prediction: curve,
      latitude_rmse: 0.02,
      climate_rmse: 0.01,
      neighbor_rmse: 0,
    },
  ],
};

describe("buildCohortPerformance", () => {
  it("reports overlapping climate, island, and sparse-donor cohorts", () => {
    const cohorts = buildCohortPerformance(
      validation,
      {
        meta: { source: "test" },
        byM49: {
          1: { kgFamily: "A" },
          2: { kgFamily: "C" },
          3: { kgFamily: "D" },
        },
      },
      new Map([
        [1, []],
        [2, [3]],
        [3, [2]],
      ]),
    );

    expect(cohorts.find((cohort) => cohort.label === "Tropical")).toMatchObject({
      count: 1,
      bestMethod: "latitude",
    });
    expect(cohorts.find((cohort) => cohort.label === "Temperate")).toMatchObject({
      count: 2,
      bestMethod: "climate",
    });
    expect(cohorts.find((cohort) => cohort.label === "Polar")).toMatchObject({
      count: 0,
      bestMethod: null,
    });
    expect(cohorts.find((cohort) => cohort.label === "Island")).toMatchObject({ count: 1 });
    expect(cohorts.find((cohort) => cohort.label === "Data-poor")).toMatchObject({ count: 3 });
  });
});

describe("validation performance breakdowns", () => {
  it("uses disjoint absolute-latitude bands", () => {
    const bands = buildLatitudePerformance(
      validation,
      new Map([
        [1, 5],
        [2, 28],
        [3, -47],
      ]),
    );

    expect(bands.map((band) => [band.label, band.count])).toEqual([
      ["0–15°", 1],
      ["15–30°", 1],
      ["30–45°", 0],
      ["45–60°", 1],
      ["60°+", 0],
    ]);
    expect(bands.find((band) => band.label === "15–30°")).toMatchObject({
      bestMethod: "climate",
    });
  });

  it("groups every country by its Köppen–Geiger sub-class", () => {
    const subclasses = buildClimateSubclassPerformance(validation, {
      meta: { source: "test" },
      byM49: {
        1: { kgClass: "Af" },
        2: { kgClass: "Cfb" },
        3: { kgClass: "Dfb" },
      },
    });

    expect(subclasses.map((subclass) => [subclass.label, subclass.count])).toEqual([
      ["Tropical — rainforest", 1],
      ["Temperate — oceanic", 1],
      ["Cold — warm-summer humid continental", 1],
    ]);
    expect(
      subclasses.find((subclass) => subclass.label === "Cold — warm-summer humid continental"),
    ).toMatchObject({ bestMethod: "neighbor" });
  });
});
