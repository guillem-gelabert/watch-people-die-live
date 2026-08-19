export interface RobustEwma {
  totals: number[];
  lower: number;
  upper: number;
  damped: number[];
  curve: number[];
  prediction: number;
  plainMean: number;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  if (p <= 0) return sorted[0]!;
  if (p >= 100) return sorted[sorted.length - 1]!;
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (rank - lo) * (sorted[hi]! - sorted[lo]!);
}

// A half-life of zero intentionally means a flat mean. This keeps the interactive widget's
// counterfactual control useful without giving the production model a separate code path.
export function robustEwma(
  totals: number[],
  halfLifeWeeks: number,
  clampPercentile: number,
): RobustEwma {
  if (totals.length === 0) {
    return {
      totals: [],
      lower: 0,
      upper: 0,
      damped: [],
      curve: [],
      prediction: 0,
      plainMean: 0,
    };
  }

  const lower = percentile(totals, clampPercentile);
  const upper = percentile(totals, 100 - clampPercentile);
  const damped = totals.map((value) => Math.min(Math.max(value, lower), upper));
  const plainMean = totals.reduce((sum, value) => sum + value, 0) / totals.length;

  let curve: number[];
  if (halfLifeWeeks <= 0) {
    const mean = damped.reduce((sum, value) => sum + value, 0) / damped.length;
    curve = damped.map(() => mean);
  } else {
    curve = damped.map((_, i) => {
      let weighted = 0;
      let weights = 0;
      for (let j = 0; j <= i; j++) {
        const weight = Math.pow(0.5, (i - j) / halfLifeWeeks);
        weighted += damped[j]! * weight;
        weights += weight;
      }
      return weights > 0 ? weighted / weights : 0;
    });
  }

  return {
    totals: [...totals],
    lower,
    upper,
    damped,
    curve,
    prediction: curve[curve.length - 1] ?? 0,
    plainMean,
  };
}
