import { fill } from "@/lib/i18n/fill";
import { causeLabel, type CauseLabels } from "@/lib/i18n/causes";
import type { Dictionary } from "@/lib/i18n/en";
import { utcYearPhase } from "@/lib/seasonal-curve";
import {
  loadSeasonalComposition,
  type SeasonalCompositionRuntime,
} from "@/lib/seasonal-composition";

// Generates a short, plausible persona for one (synthetic) death, e.g.
//   "Woman 78, breast cancer – Spain"
//
// The deaths on the globe are synthetic Poisson events, so there is no real person
// behind a dot. We fabricate a *statistically representative* identity:
//   • age + sex are drawn from the country's REAL age x sex distribution of deaths
//     (UN World Population Prospects, data/mortality-age-sex.json), so a death in
//     Japan skews old and one in Nigeria skews young;
//   • the cause is drawn from WHO Global Health Estimates weights (data/causes.json), per
//     country, age band and sex — but only when the file's `coverage` says its weights
//     really do vary by age band. A global all-ages export repeats one set of weights
//     across all nine bands, and reading that would hand an infant a pensioner's cause, so
//     it is rejected and the age-gated table below answers instead.
//
// Both files are built offline (scripts/build-mortality.ts, scripts/build-causes.ts)
// and shipped as static JSON. If they are missing or a country has no data we fall
// back — first to a small bundled sample, finally to the illustrative WHO-style tables
// below — so makePersona() never throws and the feed always reads sensibly.

type Sex = "m" | "f";

interface AgeSexEntry {
  m: number[];
  f: number[];
}

interface MortalityData {
  global: AgeSexEntry;
  countries: Record<string, AgeSexEntry>;
}

// { causeIdx: weight }, keyed by string index into CauseData.causes.
type CauseWeights = Record<string, number>;

interface CauseSexEntry {
  m: CauseWeights[]; // one entry per age band
  f: CauseWeights[];
}

// What scripts/build-causes.ts says the export it wrote can actually answer. Optional because
// this is unvalidated fetched JSON, and a file that does not declare its coverage is not trusted.
interface CauseCoverage {
  location: "country" | "global";
  age: "all_ages_repeated_across_bands" | "age_bands";
  sex: "male_female";
}

interface CauseData {
  causes: string[];
  coverage?: CauseCoverage;
  global: CauseSexEntry;
  countries: Record<string, CauseSexEntry>;
}

interface SamplePersonasData {
  mortality?: MortalityData;
  causes?: CauseData;
}

// data/age-sex-cells.json, built by scripts/build-age-sex-cells.ts: a per-cell age/sex pyramid
// resolved from real regional data where 04-03's GBD export covers it, a WorldPop-population- or
// CDR-gap-derived regional estimate elsewhere, or the national one — see that script's header
// for the tier definitions and 04-09's WorldPop correction. `classId` and `tier` are aligned to
// data/rate-grid.json's cell order, so `classId[cellIndex]` is only meaningful when `cellIndex`
// came from that same grid.
interface AgeSexCellsData {
  archetypes: AgeSexEntry[];
  classId: number[];
  tier?: number[];
}

// The words the sentence is assembled from, in the reader's language. The cause is not among
// them: it comes from the cause export, which is an English taxonomy of a couple of hundred
// labels, and a hand-translation of it would be a medical claim rather than a string.
export type PersonaWords = Pick<
  Dictionary["globe"],
  "persona" | "baby" | "girl" | "boy" | "woman" | "man"
> & {
  // The cause table, so the sentence can name the cause in the same language as the rest of
  // it. Keyed by the English label the data file uses; see lib/i18n/causes.ts.
  causes: CauseLabels;
};

export interface Persona {
  sex: Sex;
  age: number;
  cause: string;
  country: string;
  text: string;
  // Index into AGE_BANDS of the band the age was drawn from. Carried so explainPersona() can
  // show the cause distribution for the band this death actually landed in, rather than
  // re-deriving it from `age` and risking a different answer at a band edge.
  bandIdx: number;
}

// --- Fallback tables (used only when real data is unavailable) --------------------
// Age bands; index ALSO indexes the `bands` arrays in the data files, so this order
// must match BANDS in scripts/build-mortality.ts and scripts/build-causes.ts.
interface AgeBand {
  min: number;
  max: number;
  w: number;
}

const AGE_BANDS: AgeBand[] = [
  { min: 0, max: 0, w: 2 }, // under 1 (infant)
  { min: 1, max: 4, w: 1 },
  { min: 5, max: 14, w: 1 },
  { min: 15, max: 29, w: 3 },
  { min: 30, max: 49, w: 6 },
  { min: 50, max: 64, w: 14 },
  { min: 65, max: 74, w: 20 },
  { min: 75, max: 84, w: 28 },
  { min: 85, max: 99, w: 25 },
];

// Causes of death, each valid for an age range [min, max] and optional sex. Used only
// as the final fallback when the cause export has nothing usable for a country/band.
interface FallbackCause {
  label: string;
  w: number;
  min: number;
  max: number;
  sex?: Sex;
}

const CAUSES: FallbackCause[] = [
  // Infancy (< 1)
  { label: "neonatal complications", w: 30, min: 0, max: 0 },
  { label: "birth asphyxia", w: 12, min: 0, max: 0 },
  { label: "a congenital condition", w: 12, min: 0, max: 1 },
  { label: "lower respiratory infection", w: 10, min: 0, max: 4 },

  // Childhood / teens (1–14)
  { label: "a diarrhoeal disease", w: 8, min: 1, max: 14 },
  { label: "lower respiratory infection", w: 8, min: 1, max: 14 },
  { label: "malaria", w: 5, min: 1, max: 14 },
  { label: "a road injury", w: 7, min: 5, max: 14 },
  { label: "drowning", w: 4, min: 1, max: 14 },
  { label: "leukaemia", w: 4, min: 1, max: 29 },

  // Young / mid adulthood (15–49)
  { label: "a road injury", w: 16, min: 15, max: 49 },
  { label: "suicide", w: 11, min: 15, max: 49 },
  { label: "interpersonal violence", w: 7, min: 15, max: 49 },
  { label: "tuberculosis", w: 7, min: 15, max: 64 },
  { label: "HIV/AIDS", w: 7, min: 15, max: 59 },
  { label: "ischaemic heart disease", w: 10, min: 30, max: 49 },
  { label: "liver cancer", w: 5, min: 30, max: 69 },
  { label: "a stroke", w: 6, min: 30, max: 49 },
  { label: "maternal complications", w: 5, min: 15, max: 44, sex: "f" },
  { label: "breast cancer", w: 6, min: 30, max: 49, sex: "f" },

  // Older adulthood (50–69)
  { label: "ischaemic heart disease", w: 26, min: 50, max: 69 },
  { label: "a stroke", w: 18, min: 50, max: 69 },
  { label: "lung cancer", w: 14, min: 50, max: 84 },
  { label: "COPD", w: 12, min: 50, max: 84 },
  { label: "colorectal cancer", w: 8, min: 50, max: 84 },
  { label: "stomach cancer", w: 6, min: 50, max: 84 },
  { label: "liver cancer", w: 6, min: 50, max: 79 },
  { label: "diabetes", w: 8, min: 50, max: 84 },
  { label: "breast cancer", w: 9, min: 50, max: 79, sex: "f" },
  { label: "prostate cancer", w: 9, min: 55, max: 99, sex: "m" },

  // Elderly (70+)
  { label: "ischaemic heart disease", w: 30, min: 70, max: 99 },
  { label: "a stroke", w: 22, min: 70, max: 99 },
  { label: "Alzheimer's & dementia", w: 18, min: 70, max: 99 },
  { label: "COPD", w: 12, min: 70, max: 99 },
  { label: "lower respiratory infection", w: 12, min: 70, max: 99 },
  { label: "kidney disease", w: 7, min: 70, max: 99 },
  { label: "diabetes", w: 6, min: 70, max: 99 },
  { label: "colorectal cancer", w: 6, min: 70, max: 99 },
];

// --- Real data, loaded once by initPersona() --------------------------------------
let MORT: MortalityData | null = null;
let CAUSE: CauseData | null = null;
let CELLS: AgeSexCellsData | null = null;
// Month-conditioned reweighting of age and cause (04-07): data/seasonal-composition.json's
// measured curves, transferred to every country via lib/seasonal-composition.ts's donor cascade.
// Optional in every sense CELLS is: a bonus refinement layer, never required for a persona to be
// drawn, so a missing/failed load just means every death keeps today's flat annual distribution.
let SEASONAL: SeasonalCompositionRuntime | null = null;

async function loadJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// Fetch the real distributions once. Prefers the full build outputs, falls back to the
// bundled sample, then leaves things null (callers use the tables above). Never throws.
export async function initPersona(): Promise<void> {
  const [mort, cause, cells, seasonal] = await Promise.all([
    loadJson<MortalityData>("/data/mortality-age-sex.json"),
    loadJson<CauseData>("/data/causes.json"),
    loadJson<AgeSexCellsData>("/data/age-sex-cells.json"),
    loadSeasonalComposition().catch(() => null),
  ]);
  let sample: SamplePersonasData | null = null;
  if (!mort || !cause) sample = await loadJson<SamplePersonasData>("/data/sample-personas.json");
  MORT = mort || sample?.mortality || null;
  CAUSE = cause || sample?.causes || null;
  // No sample-file fallback for this one: it is a bonus refinement layer, not a required data
  // file, so a missing/failed fetch just means every death falls back to the national pyramid.
  CELLS = cells;
  // Same story: loadSeasonalComposition() already never throws and resolves null on any
  // failure, so a missing/failed load just means every death keeps the flat annual distribution.
  SEASONAL = seasonal;
}

function weightedPick<T>(items: T[], weightOf: (item: T) => number): T {
  let total = 0;
  for (const it of items) total += weightOf(it);
  const last = items[items.length - 1] as T;
  if (!(total > 0)) return last;
  let r = Math.random() * total;
  for (const it of items) {
    r -= weightOf(it);
    if (r < 0) return it;
  }
  return last;
}

// Index of a weighted-random entry in a numeric array, or -1 if the array is empty/zero.
function pickIndex(weights: number[]): number {
  let total = 0;
  for (const w of weights) total += w;
  if (!(total > 0)) return -1;
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i] as number;
    if (r < 0) return i;
  }
  return weights.length - 1;
}

// Country's age/sex weights from real data, or null. { m:[9], f:[9] }.
function mortFor(m49: number | undefined): AgeSexEntry | null {
  if (!MORT) return null;
  return (m49 !== undefined && MORT.countries[m49]) || MORT.global || null;
}

// The cell's own resolved pyramid (regional, derived or national — see
// scripts/build-age-sex-cells.ts), falling back to the country pyramid when the cell layer is
// unavailable or the index is out of range. `cellIndex` is the death's index into
// data/rate-grid.json's cells, threaded from useGlobeData.ts's sampler.
function pyramidFor(m49: number | undefined, cellIndex: number | undefined): AgeSexEntry | null {
  if (cellIndex !== undefined && CELLS) {
    const classId = CELLS.classId[cellIndex];
    const archetype = classId !== undefined ? CELLS.archetypes[classId] : undefined;
    if (archetype) return archetype;
  }
  return mortFor(m49);
}

function sampleSex(m49: number | undefined, cellIndex: number | undefined): Sex {
  const e = pyramidFor(m49, cellIndex);
  if (e) {
    const sm = e.m.reduce((a, b) => a + b, 0);
    const sf = e.f.reduce((a, b) => a + b, 0);
    if (sm + sf > 0) return Math.random() * (sm + sf) < sm ? "m" : "f";
  }
  return Math.random() < 0.5 ? "f" : "m";
}

// Multiplies a 9-band weight array by the month's per-band reweighting (04-07), so winter can
// shift the age draw toward older bands and summer toward younger ones without changing which
// pyramid is used. `eventDate` absent, or no seasonal signal for this country/band, leaves the
// weights untouched -- Math.max(0, ...) guards a pathological transferred curve from ever
// producing a negative weight, which pickIndex()'s cumulative-sum walk cannot handle.
function seasonalAgeWeights(
  weights: number[],
  m49: number | undefined,
  eventDate: Date | undefined,
): number[] {
  if (!eventDate || !SEASONAL) return weights;
  const phase = utcYearPhase(eventDate);
  return weights.map((w, band) => w * Math.max(0, SEASONAL!.ageMultiplier(m49, band, phase)));
}

// Choose an age-band index for this country + sex, then a uniform age within the band.
function sampleAge(
  m49: number | undefined,
  sex: Sex,
  cellIndex: number | undefined,
  eventDate: Date | undefined,
): { age: number; idx: number } {
  const e = pyramidFor(m49, cellIndex);
  const weights = e ? seasonalAgeWeights(e[sex], m49, eventDate) : null;
  let idx = weights ? pickIndex(weights) : -1;
  if (idx < 0) idx = AGE_BANDS.indexOf(weightedPick(AGE_BANDS, (b) => b.w));
  const band = AGE_BANDS[idx] || (AGE_BANDS[AGE_BANDS.length - 1] as AgeBand);
  return { age: band.min + Math.floor(Math.random() * (band.max - band.min + 1)), idx };
}

// "Woman"/"Man" for adults; softer labels for the young so a line never reads oddly. Exported so
// the island can rebuild the headline from a persona's fields instead of parsing its sentence.
export function sexLabel(
  // Only the five nouns, so a caller that has the dictionary but not the cause table — the
  // island, rebuilding a headline — does not have to assemble a full PersonaWords to ask.
  words: Pick<PersonaWords, "baby" | "girl" | "boy" | "woman" | "man">,
  sex: Sex,
  age: number,
): string {
  if (age < 1) return words.baby;
  if (age < 15) return sex === "f" ? words.girl : words.boy;
  return sex === "f" ? words.woman : words.man;
}

// The cause weights in play for one country/sex/band/date — the exact numbers pickCause draws
// from, factored out so explainPersona() can show the draw's odds without restating its rules.
// Null when the export cannot speak to this band and the fallback table has to answer.
function causeWeights(
  m49: number | undefined,
  sex: Sex,
  bandIdx: number,
  eventDate: Date | undefined,
): { label: string; weight: number }[] | null {
  // The band axis is only real when the builder says so. An all-ages export repeats one set of
  // weights across every band, so reading it would hand an infant a pensioner's cause — the
  // age-gated fallback table is strictly better than that.
  if (CAUSE?.coverage?.age !== "age_bands") return null;
  // Country cells exist only in a country-scoped export; a global one is used as global.
  const byCountry = CAUSE.coverage.location === "country" ? CAUSE.countries : undefined;
  const e = (m49 !== undefined && byCountry?.[m49]) || CAUSE.global;
  const cell = e?.[sex]?.[bandIdx]; // { causeIdx: weight }
  if (!cell) return null;
  // 04-07: reweight by the month's cause multiplier — leaf group when the label is one
  // (drowning, exposure to forces of nature), else its ICD-10 chapter, else unchanged. Applied
  // here rather than to `cell` itself so the data file's weights stay untouched for the next
  // persona drawn in a different month.
  const phase = eventDate ? utcYearPhase(eventDate) : null;
  const out: { label: string; weight: number }[] = [];
  let total = 0;
  for (const i of Object.keys(cell)) {
    const label = CAUSE.causes[Number(i)];
    if (!label) continue; // an index the taxonomy cannot name is not a cause we can show
    const base = cell[i] as number;
    const seasonal =
      phase === null || !SEASONAL ? 1 : Math.max(0, SEASONAL.causeMultiplier(m49, label, phase));
    const weight = base * seasonal;
    out.push({ label, weight });
    total += weight;
  }
  // A table that exists but carries no drawable weight — every entry zero, or a non-finite one
  // poisoning the sum — is not an answer. weightedPick() would return its last entry regardless
  // while normalise() sends every probability to zero, so the card would name a cause and then
  // print "0%" beside it and every alternative. An export that cannot weigh this band is the
  // same situation as one that has no cell for it: say so, and let the age-gated table answer.
  return total > 0 && Number.isFinite(total) ? out : null;
}

// Cause from the real data, but only for a band the export can actually speak to.
function pickCause(
  m49: number | undefined,
  sex: Sex,
  bandIdx: number,
  age: number,
  eventDate: Date | undefined,
): string {
  const weights = causeWeights(m49, sex, bandIdx, eventDate);
  if (weights) return weightedPick(weights, (c) => c.weight).label;
  // Fallback: the illustrative WHO-style table, filtered to a valid age + sex.
  const valid = CAUSES.filter((c) => age >= c.min && age <= c.max && (!c.sex || c.sex === sex));
  if (!valid.length) return "an undetermined cause";
  return weightedPick(valid, (c) => c.w).label;
}

// Build one persona for a death in country `m49` (display name like "Spain").
// `m49` may be omitted/unknown — then the global distribution (or the tables) is used.
// `cellIndex` is this death's index into data/rate-grid.json's cells (from the sampler in
// useGlobeData.ts); when it resolves to a cell pyramid, age/sex are drawn from that instead of
// the flat national one. `eventDate` is the simulated death's real-world date (Earth.tsx's
// per-frame clock); when present it reweights age and cause toward the measured or transferred
// month shape from data/seasonal-composition.json (04-07) — winter skewing older and more
// respiratory/circulatory where measured, summer toward drowning/heat exposure where measured.
// Age reweighting covers every band; cause reweighting reaches 56 of the 90 labels, and the 34 it
// misses — "other causes" among them, which alone is a third of adult-band cause weight — stay
// flat, deliberately. So a persona's age is seasonal everywhere and its cause is seasonal in part.
// Both `cellIndex` and `eventDate` are optional and independent, so neither call site depends on
// the other, and sex sampling is unaffected by either — only age and cause are month-conditioned.
export function makePersona(
  m49: number | undefined,
  country: string,
  words: PersonaWords,
  cellIndex?: number,
  eventDate?: Date,
): Persona {
  const sex = sampleSex(m49, cellIndex);
  const { age, idx } = sampleAge(m49, sex, cellIndex, eventDate);
  // Sampled as the English source label, then named: `cause` stays the identity so anything
  // reading a persona downstream can still match on it, and only `text` is in the reader's
  // language.
  const cause = pickCause(m49, sex, idx, age, eventDate);
  const who = sexLabel(words, sex, age);
  const text = fill(words.persona, {
    who,
    age,
    cause: causeLabel(words.causes, cause),
    country,
  });
  return { sex, age, cause, country, text, bandIdx: idx };
}

// --- Explaining a draw -------------------------------------------------------------
// Everything above answers "who died". This answers "and how likely was that", for the island's
// unfolded card. It reads the same tables through the same helpers, so the odds it shows are the
// odds the draw ran on — nothing here re-derives a distribution of its own.
//
// Deliberately not computed inside makePersona(): the sim fires ~2 personas a second and the card
// is open for a couple of seconds at a time, so this runs on demand, from the fields the death
// already carries.

export interface Outcome {
  label: string;
  p: number;
}

export interface PersonaMath {
  // Share of this cell's deaths that are male / female, over the resolved pyramid.
  sex: { m: number; f: number };
  // Which tier of data/age-sex-cells.json answered: 0 regional, 1 derived, 2 national. Null when
  // the cell layer did not resolve and the flat country pyramid was used instead.
  tier: number | null;
  // The nine age bands as probabilities for the drawn sex, month-reweighted exactly as the draw
  // saw them, plus the band it landed in.
  ages: number[];
  bandIdx: number;
  // Causes for this country/sex/band, most likely first, normalised. Empty when the WHO export
  // could not answer and the illustrative fallback table was used.
  causes: Outcome[];
}

function normalise(weights: number[]): number[] {
  let total = 0;
  for (const w of weights) total += w;
  return total > 0 ? weights.map((w) => w / total) : weights.map(() => 0);
}

export function explainPersona(
  m49: number | undefined,
  cellIndex: number | undefined,
  sex: Sex,
  bandIdx: number,
  eventDate: Date | undefined,
): PersonaMath | null {
  const pyramid = pyramidFor(m49, cellIndex);
  if (!pyramid) return null;

  const sm = pyramid.m.reduce((a, b) => a + b, 0);
  const sf = pyramid.f.reduce((a, b) => a + b, 0);
  const sexTotal = sm + sf;

  // Only claim a tier when the cell layer is what actually answered — pyramidFor() falls back to
  // the country pyramid on an out-of-range index or a missing archetype, and reporting "regional"
  // for one of those would be a claim the data does not support.
  const usedCell =
    cellIndex !== undefined &&
    CELLS !== null &&
    CELLS.archetypes[CELLS.classId[cellIndex] ?? -1] !== undefined;
  const tier = usedCell ? (CELLS?.tier?.[cellIndex] ?? null) : null;

  const causes = causeWeights(m49, sex, bandIdx, eventDate) ?? [];
  const causeP = normalise(causes.map((c) => c.weight));

  return {
    sex: sexTotal > 0 ? { m: sm / sexTotal, f: sf / sexTotal } : { m: 0.5, f: 0.5 },
    tier,
    ages: normalise(seasonalAgeWeights(pyramid[sex], m49, eventDate)),
    bandIdx,
    causes: causes
      .map((c, i) => ({ label: c.label, p: causeP[i] as number }))
      .sort((a, b) => b.p - a.p),
  };
}

// The nine bands as [min, max] pairs, for labelling the age histogram. Exported rather than
// duplicated in the view so the labels can never drift from the bands the draw used.
export const AGE_BAND_RANGES: readonly [number, number][] = AGE_BANDS.map((b) => [b.min, b.max]);
