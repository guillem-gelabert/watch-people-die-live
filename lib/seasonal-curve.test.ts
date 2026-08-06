import { describe, expect, it } from "vitest";
import {
  evaluateHarmonicCurve,
  harmonicRms,
  isHarmonicCurve,
  meanHarmonicCurves,
  scaleHarmonicAmplitude,
  shiftHarmonicCurveHalfYear,
  utcYearPhase,
  type HarmonicCurve,
} from "./seasonal-curve";

const curve: HarmonicCurve = {
  order: 2,
  coefficients: [1, 0.2, -0.1, 0.04, 0.03],
};

describe("continuous harmonic curves", () => {
  it("evaluates the Fourier coefficients continuously and periodically", () => {
    expect(evaluateHarmonicCurve(curve, 0)).toBeCloseTo(1.24);
    expect(evaluateHarmonicCurve(curve, 1)).toBeCloseTo(1.24);
    expect(evaluateHarmonicCurve(curve, -0.25)).toBeCloseTo(evaluateHarmonicCurve(curve, 0.75));
  });

  it("blends coefficients without changing the annual mean", () => {
    const flat: HarmonicCurve = { order: 2, coefficients: [1, 0, 0, 0, 0] };
    const blended = meanHarmonicCurves(
      [
        { curve, weight: 3 },
        { curve: flat, weight: 1 },
      ],
      true,
    );
    expect(blended?.coefficients).toEqual([
      1, 0.15000000000000002, -0.07500000000000001, 0.03, 0.0225,
    ]);
  });

  it("rephases southern curves by exactly half a year", () => {
    const shifted = shiftHarmonicCurveHalfYear(curve);
    for (const phase of [0, 0.13, 0.5, 0.91]) {
      expect(evaluateHarmonicCurve(shifted, phase)).toBeCloseTo(
        evaluateHarmonicCurve(curve, phase + 0.5),
      );
    }
  });

  it("scales seasonal deviation and has an analytic RMS", () => {
    const scaled = scaleHarmonicAmplitude(curve, 0.5);
    expect(harmonicRms(scaled)).toBeCloseTo(harmonicRms(curve) / 2);
    expect(scaled.coefficients[0]).toBe(1);
  });

  it("validates the coefficient count and computes leap-year phase", () => {
    expect(isHarmonicCurve(curve)).toBe(true);
    expect(isHarmonicCurve({ order: 2, coefficients: [1, 0, 0] })).toBe(false);
    expect(utcYearPhase(new Date("2024-07-02T00:00:00Z"))).toBeCloseTo(0.5);
  });
});
