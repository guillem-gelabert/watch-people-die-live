export interface HarmonicCurve {
  order: number;
  // [intercept, cos(2πt), sin(2πt), …, cos(2πkt), sin(2πkt)]
  coefficients: number[];
}

const MEAN_MONTH_DAYS = [31, 28.2425, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export const MONTH_PHASES: readonly number[] = (() => {
  const yearDays = MEAN_MONTH_DAYS.reduce((sum, days) => sum + days, 0);
  let elapsed = 0;
  return MEAN_MONTH_DAYS.map((days) => {
    const phase = (elapsed + days / 2) / yearDays;
    elapsed += days;
    return phase;
  });
})();

export function isHarmonicCurve(value: unknown): value is HarmonicCurve {
  if (!value || typeof value !== "object") return false;
  const curve = value as Partial<HarmonicCurve>;
  return (
    Number.isInteger(curve.order) &&
    (curve.order ?? 0) >= 1 &&
    Array.isArray(curve.coefficients) &&
    curve.coefficients.length === 2 * (curve.order as number) + 1 &&
    curve.coefficients.every(Number.isFinite)
  );
}

export function evaluateHarmonicCurve(curve: HarmonicCurve, phase: number): number {
  const wrapped = ((phase % 1) + 1) % 1;
  let value = curve.coefficients[0] ?? 1;
  for (let harmonic = 1; harmonic <= curve.order; harmonic += 1) {
    const angle = 2 * Math.PI * harmonic * wrapped;
    value +=
      (curve.coefficients[2 * harmonic - 1] ?? 0) * Math.cos(angle) +
      (curve.coefficients[2 * harmonic] ?? 0) * Math.sin(angle);
  }
  return value;
}

export function sampleHarmonicCurve(
  curve: HarmonicCurve,
  phases: readonly number[] = MONTH_PHASES,
): number[] {
  return phases.map((phase) => evaluateHarmonicCurve(curve, phase));
}

export function meanHarmonicCurves(
  donors: Array<{ curve: HarmonicCurve; weight?: number | null }>,
  useAvailableWeights = false,
): HarmonicCurve | null {
  if (!donors.length) return null;
  const order = donors[0]?.curve.order;
  if (order == null || donors.some(({ curve }) => curve.order !== order)) {
    throw new Error("Harmonic curves must have the same order before they can be blended.");
  }
  const weighted = useAvailableWeights && donors.every(({ weight }) => (weight ?? 0) > 0);
  const weights = donors.map(({ weight }) => (weighted ? (weight as number) : 1));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const coefficients = donors[0]!.curve.coefficients.map(
    (_, coefficient) =>
      donors.reduce(
        (sum, donor, index) =>
          sum + (donor.curve.coefficients[coefficient] ?? 0) * (weights[index] ?? 0),
        0,
      ) / totalWeight,
  );
  // Every input has annual-integral mean one. Pin the intercept to remove JSON rounding drift.
  coefficients[0] = 1;
  return { order, coefficients };
}

export function shiftHarmonicCurveHalfYear(curve: HarmonicCurve): HarmonicCurve {
  const coefficients = [...curve.coefficients];
  for (let harmonic = 1; harmonic <= curve.order; harmonic += 1) {
    const sign = harmonic % 2 === 0 ? 1 : -1;
    coefficients[2 * harmonic - 1] = (coefficients[2 * harmonic - 1] ?? 0) * sign;
    coefficients[2 * harmonic] = (coefficients[2 * harmonic] ?? 0) * sign;
  }
  return { order: curve.order, coefficients };
}

export function scaleHarmonicAmplitude(curve: HarmonicCurve, scale: number): HarmonicCurve {
  return {
    order: curve.order,
    coefficients: curve.coefficients.map((value, index) => (index === 0 ? 1 : value * scale)),
  };
}

export function harmonicRms(curve: HarmonicCurve): number {
  let variance = 0;
  for (let harmonic = 1; harmonic <= curve.order; harmonic += 1) {
    const cosine = curve.coefficients[2 * harmonic - 1] ?? 0;
    const sine = curve.coefficients[2 * harmonic] ?? 0;
    variance += (cosine * cosine + sine * sine) / 2;
  }
  return Math.sqrt(variance);
}

export function utcYearPhase(date: Date): number {
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  return (date.getTime() - start) / (end - start);
}
