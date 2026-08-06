import { evaluateHarmonicCurve } from "../../../lib/seasonal-curve";
import type {
  SmoothingDemoData,
  SmoothingDemoHarmonicOrder,
  SmoothingDemoModeKey,
  SmoothingDemoPoint,
} from "../types";

export interface SmoothingModeDefinition {
  key: SmoothingDemoModeKey;
  label: string;
  how: string;
  goodFor: string;
  watchOut: string;
}

export const SMOOTHING_MODES: readonly SmoothingModeDefinition[] = [
  {
    key: "weekly",
    label: "Weekly",
    how: "Average the same ISO week across complete years after converting counts to deaths per day.",
    goodFor:
      "Preserving the timing of short seasonal changes when long, complete weekly records exist.",
    watchOut: "It is noisy, data-hungry, and week 53 is supported by fewer years.",
  },
  {
    key: "monthly",
    label: "Monthly",
    how: "Average daily mortality intensity within each calendar month, then compare the same month across years.",
    goodFor: "A practical balance between timing detail and year-to-year stability.",
    watchOut: "Every change is assigned to a month, so boundaries become artificial steps.",
  },
  {
    key: "quarterly",
    label: "Quarterly",
    how: "Combine three months at a time using their calendar-day exposure.",
    goodFor: "Showing only the broadest seasonal contrast when observations are sparse.",
    watchOut: "Four values cannot locate a peak precisely or reveal a short secondary season.",
  },
  {
    key: "circular3",
    label: "Circular 3-point",
    how: "Replace each monthly value with 25% of the previous month, 50% of itself, and 25% of the next, wrapping December into January.",
    goodFor: "Transparent local noise reduction with an easy-to-explain fixed bandwidth.",
    watchOut:
      "The chosen three-month bandwidth blunts peaks and still leaves a monthly output grid.",
  },
  {
    key: "harmonic",
    label: "Harmonic",
    how: "Fit annual sine/cosine pairs to every qualifying weekly observation in one pooled regression.",
    goodFor:
      "A compact continuous multiplier that is smooth and periodic across December and January.",
    watchOut:
      "Higher orders preserve shorter features but can also follow noise; lower orders impose broader seasons.",
  },
] as const;

const ORDER_COPY: Record<
  SmoothingDemoHarmonicOrder,
  Pick<SmoothingModeDefinition, "how" | "goodFor" | "watchOut">
> = {
  1: {
    how: "Fit one annual sine/cosine pair to all qualifying weekly observations.",
    goodFor: "One broad annual rise and fall with the simplest possible periodic model.",
    watchOut: "It forces a symmetric single-cycle shape and cannot represent secondary peaks.",
  },
  2: {
    how: "Fit annual and half-year sine/cosine pairs to all qualifying weekly observations.",
    goodFor: "Broad asymmetry and a possible secondary seasonal rise without much fine detail.",
    watchOut: "Short peaks are still smoothed away and every added pair increases flexibility.",
  },
  3: {
    how: "Fit three annual sine/cosine pairs to all qualifying weekly observations.",
    goodFor: "Capturing multi-peak or sharper seasonal structure on roughly four-month scales.",
    watchOut: "It can begin to preserve recurrent reporting noise as if it were seasonality.",
  },
  4: {
    how: "Fit four annual sine/cosine pairs to every qualifying weekly observation in one pooled regression.",
    goodFor:
      "The production model: a continuous curve with enough resolution for shorter seasonal features.",
    watchOut:
      "It can follow stable short-period artifacts, and cannot represent abrupt one-off shocks.",
  },
};

export function smoothingMode(
  key: SmoothingDemoModeKey,
  order: SmoothingDemoHarmonicOrder = 4,
): SmoothingModeDefinition {
  const mode = SMOOTHING_MODES.find((candidate) => candidate.key === key);
  if (!mode) throw new Error(`Unknown smoothing mode: ${key}`);
  return key === "harmonic"
    ? { ...mode, label: `Harmonic · order ${order}`, ...ORDER_COPY[order] }
    : mode;
}

export function selectSmoothingSeries(
  data: SmoothingDemoData,
  countryCode: string,
  key: SmoothingDemoModeKey,
  order: SmoothingDemoHarmonicOrder = 4,
): { observations: SmoothingDemoPoint[]; line: SmoothingDemoPoint[]; stepped: boolean } | null {
  const country = data.countries[countryCode];
  if (!country) return null;
  if (key === "harmonic") {
    const curve = country.harmonics[String(order) as `${SmoothingDemoHarmonicOrder}`];
    if (!curve) return null;
    const line = Array.from({ length: 366 }, (_, index) => {
      const phase = index / 365;
      return [phase, evaluateHarmonicCurve(curve, phase)] as SmoothingDemoPoint;
    });
    return { observations: country.modes.monthly.observations, line, stepped: false };
  }
  const payload = country.modes[key];
  return {
    observations: payload.observations,
    line: payload.smoothed ?? payload.observations,
    stepped: payload.smoothed == null,
  };
}
