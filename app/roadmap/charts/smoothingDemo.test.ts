import { describe, expect, it } from "vitest";
import { selectSmoothingSeries, smoothingMode, smoothingModes } from "./smoothingDemo";
import { en } from "@/lib/i18n/en";
import { ca } from "@/lib/i18n/ca";
import { de } from "@/lib/i18n/de";
import type { SmoothingDemoData, SmoothingDemoPoint } from "../types";

const point: SmoothingDemoPoint[] = [[0.25, 1.1]];
const data = {
  meta: {
    source: "test",
    defaultCountry: "CHE",
    countryCount: 1,
    covidExcluded: [2020, 2021, 2022],
    normalization: "mean 1",
    harmonicOrders: [1, 2, 3, 4],
    generatedBy: "test",
  },
  countries: {
    CHE: {
      name: "Switzerland",
      iso3: "CHE",
      years: [2019],
      leapYears: [],
      yDomain: [0.8, 1.2],
      modes: {
        weekly: { observations: [...point] },
        monthly: { observations: [...point] },
        quarterly: { observations: [...point] },
        circular3: { observations: [...point], smoothed: [[0.25, 1.05]] },
      },
      harmonics: {
        "1": { order: 1, coefficients: [1, 0.1, 0] },
        "2": { order: 2, coefficients: [1, 0.1, 0, 0.02, 0] },
        "3": { order: 3, coefficients: [1, 0.1, 0, 0.02, 0, 0.01, 0] },
        "4": { order: 4, coefficients: [1, 0.1, 0, 0.02, 0, 0.01, 0, 0.005, 0] },
      },
    },
  },
} satisfies SmoothingDemoData;

describe("smoothing explainer configuration", () => {
  it("has the five stable mode keys and complete explanatory fields in every language", () => {
    for (const dictionary of [en, ca, de]) {
      const modes = smoothingModes(dictionary);
      expect(modes.map((mode) => mode.key)).toEqual([
        "weekly",
        "monthly",
        "quarterly",
        "circular3",
        "harmonic",
      ]);
      for (const mode of modes) {
        expect(mode.label).toBeTruthy();
        expect(mode.how).toBeTruthy();
        expect(mode.goodFor).toBeTruthy();
        expect(mode.watchOut).toBeTruthy();
      }
    }
  });

  it("selects the country and evaluates each harmonic order into a dense curve", () => {
    expect(selectSmoothingSeries(data, "CHE", "weekly")).toMatchObject({
      stepped: true,
      line: point,
    });
    const order1 = selectSmoothingSeries(data, "CHE", "harmonic", 1);
    const order4 = selectSmoothingSeries(data, "CHE", "harmonic", 4);
    expect(order1).toMatchObject({ stepped: false, observations: point });
    expect(order1?.line).toHaveLength(366);
    expect(order1?.line).not.toEqual(order4?.line);
    expect(selectSmoothingSeries(data, "MISSING", "weekly")).toBeNull();
  });

  it("updates the harmonic explanation with the selected order", () => {
    expect(smoothingMode(en, "circular3").label).toBe("Circular 3-point");
    expect(smoothingMode(en, "harmonic", 3).label).toBe("Harmonic · order 3");
    expect(smoothingMode(en, "harmonic", 4).goodFor).toContain("production model");
    // The order has to reach the label in every language, not only the one it was written in.
    expect(smoothingMode(de, "harmonic", 2).label).toContain("2");
    expect(smoothingMode(ca, "harmonic", 2).goodFor).not.toBe(
      smoothingMode(ca, "harmonic", 4).goodFor,
    );
  });
});
