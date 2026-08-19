import { describe, expect, it } from "vitest";
import { percentile, robustEwma } from "./conflict-model";

describe("robust conflict EWMA", () => {
  it("uses interpolated percentiles and a deterministic half-life kernel", () => {
    const totals = [20, 22, 21, 90, 24, 26, 28];
    expect(percentile(totals, 10)).toBeCloseTo(20.6);
    expect(percentile(totals, 90)).toBeCloseTo(52.8);

    const model = robustEwma(totals, 4, 10);
    expect(model.lower).toBeCloseTo(20.6);
    expect(model.upper).toBeCloseTo(52.8);
    expect(model.damped[0]).toBeCloseTo(20.6);
    expect(model.damped[3]).toBeCloseTo(52.8);
    expect(model.prediction).toBeCloseTo(28.361582, 5);
  });

  it("uses the damped flat mean when the half-life control is zero", () => {
    const model = robustEwma([1, 2, 100], 0, 10);
    expect(new Set(model.curve).size).toBe(1);
    expect(model.prediction).toBeCloseTo(model.curve[0]!);
  });
});
