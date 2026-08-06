import { evaluateHarmonicCurve } from "../../../lib/seasonal-curve";
import { fill } from "@/lib/i18n/fill";
import type { Dictionary } from "@/lib/i18n/en";
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

// The five ways of reading the same weekly series, in the order the control lists them. Only the
// keys live here — every word describing a mode is copy, and copy is in the dictionaries.
export const SMOOTHING_MODE_KEYS: readonly SmoothingDemoModeKey[] = [
  "weekly",
  "monthly",
  "quarterly",
  "circular3",
  "harmonic",
];

export function smoothingModes(d: Dictionary): SmoothingModeDefinition[] {
  return SMOOTHING_MODE_KEYS.map((key) => ({ key, ...d.charts.smoothing.modes[key] }));
}

// The harmonic mode is really four modes wearing one button: its label and its whole write-up
// depend on the order, so it is the one mode assembled rather than looked up.
export function smoothingMode(
  d: Dictionary,
  key: SmoothingDemoModeKey,
  order: SmoothingDemoHarmonicOrder = 4,
): SmoothingModeDefinition {
  const t = d.charts.smoothing;
  const mode = { key, ...t.modes[key] };
  return key === "harmonic"
    ? {
        ...mode,
        label: fill(t.harmonicOrderLabel, { n: order }),
        ...t.orders[String(order) as keyof typeof t.orders],
      }
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
