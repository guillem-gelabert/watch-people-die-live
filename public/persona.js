// Generates a short, plausible persona for one (synthetic) death, e.g.
//   "Woman 78, breast cancer – Spain"
//
// The deaths on the globe are synthetic Poisson events, so there is no real person
// behind a dot. We fabricate a *statistically representative* identity: an age drawn
// from an old-skewed, mortality-weighted distribution, a sex, and a cause of death
// that is consistent with that age and sex (no prostate cancer for women, neonatal
// causes only for infants, dementia only for the elderly, ...). Weights are
// illustrative, loosely following WHO global leading causes by life stage — not a
// per-country epidemiological model.

// --- Age at death: weighted bands, then a uniform age inside the chosen band. -----
// Weights skew heavily old with a small infant tail, roughly matching the global
// age distribution of deaths.
const AGE_BANDS = [
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

// --- Causes of death, each valid for an age range [min, max] and optional sex. ----
// `sex: 'f' | 'm'` restricts the cause; omitted means either. Weights are relative
// within whatever subset is valid for a given persona.
const CAUSES = [
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

function weightedPick(items, weightOf) {
  let total = 0;
  for (const it of items) total += weightOf(it);
  let r = Math.random() * total;
  for (const it of items) {
    r -= weightOf(it);
    if (r < 0) return it;
  }
  return items[items.length - 1];
}

function sampleAge() {
  const band = weightedPick(AGE_BANDS, (b) => b.w);
  return band.min + Math.floor(Math.random() * (band.max - band.min + 1));
}

// "Woman"/"Man" for adults; softer labels for the young so a line never reads oddly.
function sexLabel(sex, age) {
  if (age < 1) return "Baby";
  if (age < 15) return sex === "f" ? "Girl" : "Boy";
  return sex === "f" ? "Woman" : "Man";
}

function pickCause(age, sex) {
  const valid = CAUSES.filter(
    (c) => age >= c.min && age <= c.max && (!c.sex || c.sex === sex)
  );
  // Extremely unlikely to be empty given the bands, but stay safe.
  if (!valid.length) return "an undetermined cause";
  return weightedPick(valid, (c) => c.w).label;
}

// Build one persona for a death in `country` (a display name like "Spain").
export function makePersona(country) {
  const sex = Math.random() < 0.5 ? "f" : "m";
  const age = sampleAge();
  const cause = pickCause(age, sex);
  const who = sexLabel(sex, age);
  const text = `${who} ${age}, ${cause} – ${country}`;
  return { sex, age, cause, country, text };
}
