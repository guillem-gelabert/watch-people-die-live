import fs from "node:fs";
import { describe, expect, it } from "vitest";

interface ValidationRow {
  actual: number[];
  latitude_prediction: number[];
  climate_prediction: number[];
  neighbor_prediction: number[];
}

describe("generated harmonic validation payloads", () => {
  it("keeps all measured countries on a common twelve-point chart sampling grid", () => {
    const payload = JSON.parse(fs.readFileSync("data/seasonality-loo-validation.json", "utf8")) as {
      meta: { nCountries: number; curveSampling: string };
      perCountry: ValidationRow[];
    };
    expect(payload.meta.nCountries).toBe(89);
    expect(payload.meta.curveSampling).toContain("roadmap chart only");
    expect(payload.perCountry).toHaveLength(89);
    for (const row of payload.perCountry) {
      for (const series of [
        row.actual,
        row.latitude_prediction,
        row.climate_prediction,
        row.neighbor_prediction,
      ]) {
        expect(series).toHaveLength(12);
        expect(series.every((value) => Number.isFinite(value) && value > 0)).toBe(true);
      }
    }
  });

  it("regenerates the regional comparison and representative examples", () => {
    const payload = JSON.parse(
      fs.readFileSync("data/seasonality-subnational-loo.json", "utf8"),
    ) as { comparison: unknown[]; examples: Array<{ measured: number[] }> };
    expect(payload.comparison).toHaveLength(3);
    expect(payload.examples).toHaveLength(5);
    expect(payload.examples.every((example) => example.measured.length === 12)).toBe(true);
  });
});
