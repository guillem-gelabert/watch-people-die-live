import { fill } from "@/lib/i18n/fill";
import type { Dictionary } from "@/lib/i18n/en";

// Generates a short, plausible persona for one (synthetic) death, e.g.
//   "Woman 78, breast cancer – Spain"
//
// The deaths on the globe are synthetic Poisson events, so there is no real person
// behind a dot. We fabricate a *statistically representative* identity:
//   • age + sex are drawn from the country's REAL age x sex distribution of deaths
//     (UN World Population Prospects, data/mortality-age-sex.json), so a death in
//     Japan skews old and one in Nigeria skews young;
//   • the cause is drawn from IHME Global Burden of Disease cause weights when
//     data/causes.json is present. The current committed export is global and sex-specific;
//     a fuller country/age export can use the same JSON shape later.
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

interface CauseData {
  causes: string[];
  global: CauseSexEntry;
  countries: Record<string, CauseSexEntry>;
}

interface SamplePersonasData {
  mortality?: MortalityData;
  causes?: CauseData;
}

// The words the sentence is assembled from, in the reader's language. The cause is not among
// them: it comes from the Global Burden of Disease export, which is an English taxonomy of some
// three hundred labels, and a hand-translation of it would be a medical claim rather than a
// string.
export type PersonaWords = Pick<
  Dictionary["globe"],
  "persona" | "baby" | "girl" | "boy" | "woman" | "man"
>;

export interface Persona {
  sex: Sex;
  age: number;
  cause: string;
  country: string;
  text: string;
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
// as the final fallback when GBD data is unavailable for a country/band.
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
  const [mort, cause] = await Promise.all([
    loadJson<MortalityData>("/data/mortality-age-sex.json"),
    loadJson<CauseData>("/data/causes.json"),
  ]);
  let sample: SamplePersonasData | null = null;
  if (!mort || !cause) sample = await loadJson<SamplePersonasData>("/data/sample-personas.json");
  MORT = mort || sample?.mortality || null;
  CAUSE = cause || sample?.causes || null;
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

function sampleSex(m49: number | undefined): Sex {
  const e = mortFor(m49);
  if (e) {
    const sm = e.m.reduce((a, b) => a + b, 0);
    const sf = e.f.reduce((a, b) => a + b, 0);
    if (sm + sf > 0) return Math.random() * (sm + sf) < sm ? "m" : "f";
  }
  return Math.random() < 0.5 ? "f" : "m";
}

// Choose an age-band index for this country + sex, then a uniform age within the band.
function sampleAge(m49: number | undefined, sex: Sex): { age: number; idx: number } {
  const e = mortFor(m49);
  let idx = e ? pickIndex(e[sex]) : -1;
  if (idx < 0) idx = AGE_BANDS.indexOf(weightedPick(AGE_BANDS, (b) => b.w));
  const band = AGE_BANDS[idx] || (AGE_BANDS[AGE_BANDS.length - 1] as AgeBand);
  return { age: band.min + Math.floor(Math.random() * (band.max - band.min + 1)), idx };
}

// "Woman"/"Man" for adults; softer labels for the young so a line never reads oddly.
function sexLabel(words: PersonaWords, sex: Sex, age: number): string {
  if (age < 1) return words.baby;
  if (age < 15) return sex === "f" ? words.girl : words.boy;
  return sex === "f" ? words.woman : words.man;
}

// Cause from the best available cause data; current GBD export is global and sex-specific.
function pickCause(m49: number | undefined, sex: Sex, bandIdx: number, age: number): string {
  if (CAUSE) {
    const e = (m49 !== undefined && CAUSE.countries[m49]) || CAUSE.global;
    const cell = e?.[sex]?.[bandIdx]; // { causeIdx: weight }
    if (cell) {
      const idxs = Object.keys(cell);
      if (idxs.length) {
        const pick = weightedPick(idxs, (i) => cell[i] as number);
        const label = CAUSE.causes[Number(pick)];
        if (label) return label;
      }
    }
  }
  // Fallback: the illustrative WHO-style table, filtered to a valid age + sex.
  const valid = CAUSES.filter((c) => age >= c.min && age <= c.max && (!c.sex || c.sex === sex));
  if (!valid.length) return "an undetermined cause";
  return weightedPick(valid, (c) => c.w).label;
}

// Build one persona for a death in country `m49` (display name like "Spain").
// `m49` may be omitted/unknown — then the global distribution (or the tables) is used.
export function makePersona(
  m49: number | undefined,
  country: string,
  words: PersonaWords,
): Persona {
  const sex = sampleSex(m49);
  const { age, idx } = sampleAge(m49, sex);
  const cause = pickCause(m49, sex, idx, age);
  const who = sexLabel(words, sex, age);
  const text = fill(words.persona, { who, age, cause, country });
  return { sex, age, cause, country, text };
}
