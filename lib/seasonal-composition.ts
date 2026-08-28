// Transfers pipeline/seasonal_composition.py's measured age x month and cause x month curves
// (data/seasonal-composition.json) to every country the globe can render, by reusing
// buildSpatialSeasonality() and buildClimateBlend() -- the same donor cascade
// lib/spatial-seasonality.ts already uses for the *timing* curve -- called once per age band and
// once per cause dimension (ICD-10 chapter or leaf group) instead of once for the whole country.
// This is 04-07's task 2: reuse the already-LOO-validated donor machinery instead of building a
// second transfer model.
//
// Countries this module has no signal for at all (never measured, no bordering donor, no Köppen
// class match) simply get no estimate, so the multiplier defaults to 1 -- flat, today's behaviour
// -- rather than guessing. Nothing here ever throws; every failure degrades to "no reweighting".

import type { Feature, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import {
  buildClimateBlend,
  buildSpatialSeasonality,
  m49ForIso3,
  type ClimateFallbackModel,
} from "./spatial-seasonality";
import { evaluateHarmonicCurve, isHarmonicCurve, type HarmonicCurve } from "./seasonal-curve";

export interface SeasonalCompositionData {
  meta: {
    ageBands: [number, number][];
    causeChapters: string[];
    causeLeafGroups: string[];
    chapterOfCauseLabel: Record<string, string>;
    ageCountriesMeasured: string[];
    causeCountriesMeasured: string[];
  };
  age: { countries: Record<string, (HarmonicCurve | null)[]> };
  cause: {
    countries: Record<
      string,
      { chapters: Record<string, HarmonicCurve>; leaf: Record<string, HarmonicCurve> }
    >;
  };
}

// One transferred (or measured) curve per m49, for one dimension (an age band, or a cause
// chapter/leaf group). Reused for both age and cause below rather than two near-identical maps.
type DimensionEstimates = Map<number, HarmonicCurve>;

export interface SeasonalCompositionRuntime {
  // Multiplier for band `band` in country `m49` at `yearPhase` (0..1, see utcYearPhase()).
  // 1 = no reweighting: unmeasured/untransferable band, or the runtime failed to load.
  ageMultiplier(m49: number | undefined, band: number, yearPhase: number): number;
  // Multiplier for causes.json label `label` in country `m49` at `yearPhase`. Prefers a leaf-
  // group curve (drowning, exposure to forces of nature) when the label itself is one of those
  // two groups, else its ICD-10 chapter's curve, else 1 (label not covered by either).
  //
  // That last case is 34 of the 90 labels, listed in the tensor's own
  // meta.causeLabelCoverage.flat, and the biggest of them is "other causes" — the residual
  // everything outside a country's strongest eight is folded into, 16.6-52.1% of adult-band
  // cause weight. It returns 1 by decision, not by omission: the residual is a mixture of
  // unrelated deaths with no single chapter, so the alternative (lend it the country's all-cause
  // curve) would assert a month shape nobody measured for that mixture. The other 33 are flat
  // only because the label -> chapter map is derived from a European cause list that cannot name
  // tropical causes; those are worth fixing. See pipeline/seasonal_composition.py's docstring.
  causeMultiplier(m49: number | undefined, label: string, yearPhase: number): number;
  // Coverage diagnostics keyed the same way the internal maps are, for the LOO validation script
  // and the plan's "estimated tensors are labelled as such" criterion -- not used at persona-
  // sampling time.
  ageCoverage: Map<number, DimensionEstimates>;
  causeCoverage: Map<string, DimensionEstimates>;
}

export function measuredM49Curves(
  countries: Record<string, HarmonicCurve | null | undefined>,
): Map<number, HarmonicCurve> {
  const out = new Map<number, HarmonicCurve>();
  for (const [iso3, curve] of Object.entries(countries)) {
    if (!curve || !isHarmonicCurve(curve)) continue;
    const m49 = m49ForIso3(iso3);
    if (m49 == null) continue;
    out.set(m49, curve);
  }
  return out;
}

export function transferDimension(
  measured: Map<number, HarmonicCurve>,
  features: Feature<Geometry>[],
  neighborsByM49: ReadonlyMap<number, readonly number[]>,
  classByM49: ClimateFallbackModel["classByM49"],
): DimensionEstimates {
  if (measured.size === 0) return new Map();
  const climate = buildClimateBlend(classByM49, measured);
  const countries: Record<string, HarmonicCurve> = {};
  for (const [m49, curve] of measured) countries[String(m49)] = curve;
  const estimates = buildSpatialSeasonality(features, neighborsByM49, { countries, climate });
  const out: DimensionEstimates = new Map();
  for (const [m49, estimate] of estimates) out.set(m49, estimate.curve);
  return out;
}

// Pure builder: takes already-parsed data plus the world geometry/neighbour graph and climate
// class map the caller already has (or fetched once), so it can run both at runtime (persona.ts,
// via loadSeasonalComposition() below) and offline in a Node validation script without a second
// implementation of the transfer loop.
export function buildSeasonalComposition(
  data: SeasonalCompositionData,
  features: Feature<Geometry>[],
  neighborsByM49: ReadonlyMap<number, readonly number[]>,
  classByM49: ClimateFallbackModel["classByM49"],
): SeasonalCompositionRuntime {
  const nBands = data.meta.ageBands.length;
  const ageCoverage = new Map<number, DimensionEstimates>();
  for (let band = 0; band < nBands; band++) {
    const measured = measuredM49Curves(
      Object.fromEntries(
        Object.entries(data.age.countries).map(([iso3, curves]) => [iso3, curves[band] ?? null]),
      ),
    );
    ageCoverage.set(band, transferDimension(measured, features, neighborsByM49, classByM49));
  }

  const causeCoverage = new Map<string, DimensionEstimates>();
  for (const chapter of data.meta.causeChapters) {
    const measured = measuredM49Curves(
      Object.fromEntries(
        Object.entries(data.cause.countries).map(([iso3, c]) => [iso3, c.chapters[chapter]]),
      ),
    );
    causeCoverage.set(
      `chapter:${chapter}`,
      transferDimension(measured, features, neighborsByM49, classByM49),
    );
  }
  for (const leaf of data.meta.causeLeafGroups) {
    const measured = measuredM49Curves(
      Object.fromEntries(
        Object.entries(data.cause.countries).map(([iso3, c]) => [iso3, c.leaf[leaf]]),
      ),
    );
    causeCoverage.set(
      `leaf:${leaf}`,
      transferDimension(measured, features, neighborsByM49, classByM49),
    );
  }

  function ageMultiplier(m49: number | undefined, band: number, yearPhase: number): number {
    if (m49 === undefined) return 1;
    const curve = ageCoverage.get(band)?.get(m49);
    return curve ? evaluateHarmonicCurve(curve, yearPhase) : 1;
  }

  function causeMultiplier(m49: number | undefined, label: string, yearPhase: number): number {
    if (m49 === undefined) return 1;
    const key = data.meta.causeLeafGroups.includes(label)
      ? `leaf:${label}`
      : data.meta.chapterOfCauseLabel[label]
        ? `chapter:${data.meta.chapterOfCauseLabel[label]}`
        : undefined;
    if (!key) return 1;
    const curve = causeCoverage.get(key)?.get(m49);
    return curve ? evaluateHarmonicCurve(curve, yearPhase) : 1;
  }

  return { ageMultiplier, causeMultiplier, ageCoverage, causeCoverage };
}

// Runtime entry point: fetches the three inputs (measured tensor, world geometry, Köppen class
// map -- the last two already shipped for the timing curve and served from the browser's HTTP
// cache on a second request, so this costs no extra network round trip) and builds the transfer.
// Deliberately uncached at module scope -- unlike a persisted singleton, this matches
// persona.ts's MORT/CAUSE/CELLS, which also refetch and rebuild on every initPersona() call
// rather than memoizing forever, so a second call (a remount, a test) always sees fresh data
// rather than a stale first answer. The transfer itself is cheap (well under 100ms for the
// full ~30-dimension cascade). Never throws; resolves to null on any failure so callers can
// fall back to "no reweighting".
async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function loadSeasonalComposition(): Promise<SeasonalCompositionRuntime | null> {
  try {
    const [data, topo, climate] = await Promise.all([
      fetchJson<SeasonalCompositionData>("/data/seasonal-composition.json"),
      fetchJson<Topology>("/data/countries-110m.json"),
      fetchJson<ClimateFallbackModel>("/data/seasonality-climate-fallback.json"),
    ]);
    if (!data || !topo || !climate) return null;
    const topojson = await import("topojson-client");
    const countriesObject = topo.objects.countries as NonNullable<typeof topo.objects.countries>;
    const countryFeatures = topojson.feature(topo, countriesObject) as unknown as {
      features: Feature<Geometry>[];
    };
    const geometries = (countriesObject as GeometryCollection).geometries;
    const neighborIndexes = topojson.neighbors(geometries);
    const neighborsByM49 = new Map<number, number[]>(
      geometries.map((geometry, index) => [
        Number(geometry.id),
        (neighborIndexes[index] ?? [])
          .map((neighborIndex) => geometries[neighborIndex]?.id)
          .filter((id): id is string | number => id != null)
          .map(Number),
      ]),
    );
    return buildSeasonalComposition(
      data,
      countryFeatures.features,
      neighborsByM49,
      climate.classByM49,
    );
  } catch {
    return null;
  }
}
