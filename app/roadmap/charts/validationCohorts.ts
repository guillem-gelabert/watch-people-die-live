import type { LooPerCountry, LooValidation, NeighborsByM49, SeasonalityProxies } from "../types";
import { fill } from "@/lib/i18n/fill";
import type { Dictionary } from "@/lib/i18n/en";

const MONTH_DAYS = [31, 28.2425, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export type CohortMethod = "latitude" | "climate" | "neighbor";

export interface CohortPerformance {
  label: string;
  definition: string;
  count: number;
  rmseByMethod: Record<CohortMethod, number | null>;
  bestMethod: CohortMethod | null;
}

export function cohortMethodLabel(d: Dictionary, method: CohortMethod | null): string {
  const t = d.charts.cohorts;
  if (!method) return t.none;
  return method === "latitude" ? t.latitude : method === "climate" ? t.climate : t.neighbour;
}

function weightedRmse(actual: number[], predicted: number[]): number | null {
  if (actual.length !== 12 || predicted.length !== 12) return null;
  let total = 0;
  let totalDays = 0;
  for (let i = 0; i < 12; i += 1) {
    const error = (actual[i] ?? Number.NaN) - (predicted[i] ?? Number.NaN);
    if (!Number.isFinite(error)) return null;
    const days = MONTH_DAYS[i] as number;
    total += days * error ** 2;
    totalDays += days;
  }
  return Math.sqrt(total / totalDays);
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? (ordered[middle] as number)
    : ((ordered[middle - 1] as number) + (ordered[middle] as number)) / 2;
}

function methodRmse(entry: LooPerCountry, method: CohortMethod): number | null {
  const prediction =
    method === "latitude"
      ? entry.latitude_prediction
      : method === "climate"
        ? entry.climate_prediction
        : entry.neighbor_prediction;
  return weightedRmse(entry.actual, prediction);
}

function summarize(label: string, definition: string, members: LooPerCountry[]): CohortPerformance {
  const methods: CohortMethod[] = ["latitude", "climate", "neighbor"];
  const rmseByMethod = Object.fromEntries(
    methods.map((method) => [
      method,
      median(
        members.map((entry) => methodRmse(entry, method)).filter((v): v is number => v != null),
      ),
    ]),
  ) as Record<CohortMethod, number | null>;
  const bestMethod = methods.reduce<CohortMethod | null>((best, method) => {
    const value = rmseByMethod[method];
    if (value == null) return best;
    return best == null || value < (rmseByMethod[best] as number) ? method : best;
  }, null);
  return { label, definition, count: members.length, rmseByMethod, bestMethod };
}

// Cohorts are deliberately allowed to overlap: an island may also be tropical and have sparse
// local donor coverage. "Data-poor" is limited to donor coverage, not mortality registration
// completeness, because only countries with an observed curve can appear in this validation set.
export function buildCohortPerformance(
  d: Dictionary,
  looValidation: LooValidation,
  proxies: SeasonalityProxies | null,
  neighborsByM49: NeighborsByM49 | null,
): CohortPerformance[] {
  const t = d.charts.cohorts;
  const entries = looValidation.perCountry;
  const validationIds = new Set(entries.map((entry) => entry.m49));
  const familyOf = (entry: LooPerCountry) => proxies?.byM49[String(entry.m49)]?.kgFamily;
  const validationNeighbors = (entry: LooPerCountry) =>
    (neighborsByM49?.get(entry.m49) ?? []).filter((id) => validationIds.has(id));

  return [
    summarize(
      t.tropical,
      t.tropicalNote,
      entries.filter((entry) => familyOf(entry) === "A"),
    ),
    summarize(
      t.temperate,
      t.temperateNote,
      entries.filter((entry) => ["C", "D"].includes(familyOf(entry) ?? "")),
    ),
    summarize(
      t.polar,
      t.polarNote,
      entries.filter((entry) => familyOf(entry) === "E"),
    ),
    summarize(
      t.island,
      t.islandNote,
      entries.filter((entry) => (neighborsByM49?.get(entry.m49) ?? []).length === 0),
    ),
    summarize(
      t.dataPoor,
      t.dataPoorNote,
      entries.filter((entry) => validationNeighbors(entry).length < 2),
    ),
  ];
}

const LATITUDE_BANDS = [
  { label: "0–15°", minimum: 0, maximum: 15 },
  { label: "15–30°", minimum: 15, maximum: 30 },
  { label: "30–45°", minimum: 30, maximum: 45 },
  { label: "45–60°", minimum: 45, maximum: 60 },
  { label: "60°+", minimum: 60, maximum: Number.POSITIVE_INFINITY },
];

// Which family each Köppen code belongs to, as the sub-class table prints it. The words for both
// halves are in the dictionary — this is only the code-to-family mapping, which is the taxonomy
// itself and does not change with the language.
const KOPPEN_GEIGER_FAMILY: Record<string, "A" | "B" | "C" | "cold" | "E"> = {
  Af: "A",
  Am: "A",
  Aw: "A",
  BWh: "B",
  BWk: "B",
  BSh: "B",
  BSk: "B",
  Csa: "C",
  Csb: "C",
  Csc: "C",
  Cwa: "C",
  Cwb: "C",
  Cwc: "C",
  Cfa: "C",
  Cfb: "C",
  Cfc: "C",
  Dsa: "cold",
  Dsb: "cold",
  Dsc: "cold",
  Dsd: "cold",
  Dwa: "cold",
  Dwb: "cold",
  Dwc: "cold",
  Dwd: "cold",
  Dfa: "cold",
  Dfb: "cold",
  Dfc: "cold",
  Dfd: "cold",
  ET: "E",
  EF: "E",
};

function koppenLabel(d: Dictionary, code: string): string | null {
  const family = KOPPEN_GEIGER_FAMILY[code];
  const subclass = d.charts.kgSubclasses[code as keyof Dictionary["charts"]["kgSubclasses"]];
  if (!family || !subclass) return null;
  const familyName = family === "cold" ? d.charts.kgCold : d.charts.kgFamilies[family];
  return `${familyName} — ${subclass}`;
}

export function buildLatitudePerformance(
  d: Dictionary,
  looValidation: LooValidation,
  latitudeByM49: ReadonlyMap<number, number>,
): CohortPerformance[] {
  return LATITUDE_BANDS.map(({ label, minimum, maximum }) =>
    summarize(
      label,
      fill(d.charts.cohorts.latitudeBandNote, {
        from: minimum,
        to: Number.isFinite(maximum) ? maximum : 90,
      }),
      looValidation.perCountry.filter((entry) => {
        const latitude = Math.abs(latitudeByM49.get(entry.m49) ?? Number.NaN);
        return latitude >= minimum && latitude < maximum;
      }),
    ),
  );
}

export function buildClimateSubclassPerformance(
  d: Dictionary,
  looValidation: LooValidation,
  proxies: SeasonalityProxies | null,
): CohortPerformance[] {
  const entriesBySubclass = new Map<string, LooPerCountry[]>();
  for (const entry of looValidation.perCountry) {
    const subclass = proxies?.byM49[String(entry.m49)]?.kgClass ?? "Unclassified";
    const members = entriesBySubclass.get(subclass) ?? [];
    members.push(entry);
    entriesBySubclass.set(subclass, members);
  }

  return [...entriesBySubclass.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([subclass, members]) => {
      const label = koppenLabel(d, subclass);
      return summarize(
        label ?? d.charts.cohorts.unclassified,
        label
          ? fill(d.charts.cohorts.subclassNote, { code: subclass })
          : d.charts.cohorts.unclassifiedNote,
        members,
      );
    });
}
