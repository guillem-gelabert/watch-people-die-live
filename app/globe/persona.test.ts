import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/lib/i18n/en";
import { initPersona, makePersona, type Persona } from "./persona";

// initPersona() reads its distributions over fetch, so every test here serves the files it wants
// the module to see and then drives the public API — makePersona() — rather than reaching inside.

const WORDS = { ...en.globe, causes: en.causes };
const NGA = 566; // Young-skewed, so a modest sample contains plenty of children.

// The only causes the fallback table declares valid under 1. Once an unusable export has been
// rejected, nothing outside this set may reach an infant.
const INFANT_CAUSES = [
  "neonatal complications",
  "birth asphyxia",
  "a congenital condition",
  "lower respiratory infection",
];

// Causes no child dies of, and precisely what the committed global all-ages export hands out
// today: its top weights are cardiovascular, COPD and cancer for every age band alike.
const ADULT_ONLY = [
  "ischaemic heart disease",
  "a stroke",
  "Alzheimer's & dementia",
  "COPD",
  "lung cancer",
  "breast cancer",
  "prostate cancer",
  "colorectal cancer",
  "stomach cancer",
  "liver cancer",
  "diabetes",
  "kidney disease",
];

type Coverage = { location: string; age: string; sex: string };

const response = (ok: boolean, body?: unknown) =>
  ({ ok, json: async () => body }) as unknown as Response;

// Serve only the URLs a test names; anything else fails, which is how initPersona() sees a
// missing data file.
function serve(files: Record<string, unknown>) {
  vi.stubGlobal("fetch", async (url: string | URL) => {
    const body = files[String(url)];
    return body === undefined ? response(false) : response(true, body);
  });
}

const readData = (name: string): unknown =>
  JSON.parse(
    fs.readFileSync(fileURLToPath(new URL(`../../data/${name}`, import.meta.url)), "utf8"),
  );

// The real world topology and Köppen class map, exactly what /data/countries-110m.json and
// /data/seasonality-climate-fallback.json serve at runtime (the former via a route handler over
// node_modules/world-atlas, the latter a committed data/ file) — so 04-07's transfer machinery
// sees a real Nigeria feature (m49 566) rather than a hand-built topology fixture.
const WORLD_ATLAS = JSON.parse(
  fs.readFileSync(
    path.join(
      fileURLToPath(new URL("../../", import.meta.url)),
      "node_modules/world-atlas/countries-110m.json",
    ),
    "utf8",
  ),
) as unknown;

// A pyramid with every death in one band, so a test can fix the age it is asking about.
function pyramid(band: number) {
  const w = Array.from({ length: 9 }, (_, i) => (i === band ? 1 : 0));
  return { global: { m: w, f: w }, countries: {} };
}

// A cause export holding one label per cell, so the label a persona draws names the cell that
// answered: index 0 is the global cell, index 1 the country one.
function causeExport(coverage: Coverage, label: string, countryLabel?: string) {
  const cells = (idx: number) => Array.from({ length: 9 }, () => ({ [idx]: 1 }));
  return {
    causes: countryLabel ? [label, countryLabel] : [label],
    coverage,
    global: { m: cells(0), f: cells(0) },
    countries: countryLabel ? { [NGA]: { m: cells(1), f: cells(1) } } : {},
  };
}

const personas = (n: number, m49?: number): Persona[] =>
  Array.from({ length: n }, () => makePersona(m49, "Testland", WORDS));

const personasAt = (n: number, m49: number | undefined, cellIndex: number | undefined): Persona[] =>
  Array.from({ length: n }, () => makePersona(m49, "Testland", WORDS, cellIndex));

const personasAtDate = (
  n: number,
  m49: number | undefined,
  cellIndex: number | undefined,
  eventDate: Date | undefined,
): Persona[] =>
  Array.from({ length: n }, () => makePersona(m49, "Testland", WORDS, cellIndex, eventDate));

// A pyramid with every death at one exact band, packaged as an age-sex-cells.json archetype.
const archetype = (band: number) => {
  const w = Array.from({ length: 9 }, (_, i) => (i === band ? 1 : 0));
  return { m: w, f: w };
};

const causesOf = (drawn: Persona[]) => new Set(drawn.map((p) => p.cause));

afterEach(() => vi.unstubAllGlobals());

describe("pickCause coverage guard", () => {
  it("rejects an all-ages export rather than give an infant an adult cause", async () => {
    serve({
      "/data/mortality-age-sex.json": pyramid(0),
      "/data/causes.json": causeExport(
        { location: "global", age: "all_ages_repeated_across_bands", sex: "male_female" },
        "ischaemic heart disease",
      ),
    });
    await initPersona();

    const drawn = personas(300);
    expect(drawn.every((p) => p.age === 0)).toBe(true);
    expect(drawn.filter((p) => !INFANT_CAUSES.includes(p.cause)).map((p) => p.cause)).toEqual([]);
  });

  it("uses an export that declares real age bands", async () => {
    serve({
      "/data/mortality-age-sex.json": pyramid(0),
      "/data/causes.json": causeExport(
        { location: "global", age: "age_bands", sex: "male_female" },
        "a banded cause",
      ),
    });
    await initPersona();

    expect(causesOf(personas(200))).toEqual(new Set(["a banded cause"]));
  });

  it("ignores country cells in a global-scoped export", async () => {
    serve({
      "/data/mortality-age-sex.json": pyramid(0),
      "/data/causes.json": causeExport(
        { location: "global", age: "age_bands", sex: "male_female" },
        "a global cause",
        "a country cause",
      ),
    });
    await initPersona();

    expect(causesOf(personas(200, NGA))).toEqual(new Set(["a global cause"]));
  });

  it("reads country cells in a country-scoped export", async () => {
    serve({
      "/data/mortality-age-sex.json": pyramid(0),
      "/data/causes.json": causeExport(
        { location: "country", age: "age_bands", sex: "male_female" },
        "a global cause",
        "a country cause",
      ),
    });
    await initPersona();

    expect(causesOf(personas(200, NGA))).toEqual(new Set(["a country cause"]));
    expect(causesOf(personas(200, 724))).toEqual(new Set(["a global cause"]));
  });
});

describe("makePersona with the shipped data files", () => {
  it("keeps children off adult causes", async () => {
    serve({
      "/data/mortality-age-sex.json": readData("mortality-age-sex.json"),
      "/data/causes.json": readData("causes.json"),
    });
    await initPersona();

    const drawn = personas(5000, NGA);
    const children = drawn.filter((p) => p.age < 15);
    const infants = drawn.filter((p) => p.age < 1);
    expect(children.length).toBeGreaterThan(500);
    expect(infants.length).toBeGreaterThan(50);
    expect(
      children.filter((p) => ADULT_ONLY.includes(p.cause)).map((p) => `${p.age}: ${p.cause}`),
    ).toEqual([]);
    // Not the fallback table's narrow list any more — the shipped export has real per-band
    // country cells, so an infant draws Nigeria's actual infant mix: perinatal causes alongside
    // the infections that kill babies there. Asserting which single cause is commonest would be
    // flaky, because neonatal complications (22%) and lower respiratory infection (18%) are close
    // enough that the mode flips between samples. The robust invariant is that a large share is
    // perinatal — something only a real infant band produces.
    const PERINATAL = [
      "neonatal complications",
      "birth asphyxia",
      "a congenital condition",
      "sudden infant death syndrome",
    ];
    const perinatal = infants.filter((p) => PERINATAL.includes(p.cause)).length / infants.length;
    expect(perinatal).toBeGreaterThan(0.25);
  });

  it("uses the bundled sample's own banded weights when the built files are absent", async () => {
    serve({ "/data/sample-personas.json": readData("sample-personas.json") });
    await initPersona();

    const drawn = personas(2000, NGA);
    expect(drawn.filter((p) => p.age < 1).length).toBeGreaterThan(100);
    // "birth asphyxia" exists only in the fallback table, never in the sample's 26-label
    // vocabulary, so its absence is what shows the sample answered rather than the table.
    expect(causesOf(drawn)).not.toContain("birth asphyxia");
  });

  it("never throws when nothing loads", async () => {
    serve({});
    await initPersona();

    const drawn = personas(1000, NGA);
    expect(drawn.every((p) => p.cause.length > 0 && p.text.includes("Testland"))).toBe(true);
    expect(drawn.filter((p) => p.age < 15).filter((p) => ADULT_ONLY.includes(p.cause))).toEqual([]);
  });
});

// 04-04: a per-cell pyramid (data/age-sex-cells.json) can override the flat national one that
// mortality-age-sex.json alone would give every death in a country.
describe("per-cell age/sex pyramid", () => {
  it("draws visibly different ages for two cells with different archetypes", async () => {
    serve({
      "/data/mortality-age-sex.json": pyramid(4), // national: everyone drawn from band 4 (30-49)
      "/data/age-sex-cells.json": {
        archetypes: [archetype(0), archetype(8)], // cell 0: infants; cell 1: 85+
        classId: [0, 1],
      },
    });
    await initPersona();

    const infantCell = personasAt(50, NGA, 0);
    const elderlyCell = personasAt(50, NGA, 1);
    expect(infantCell.every((p) => p.age === 0)).toBe(true);
    expect(elderlyCell.every((p) => p.age >= 85)).toBe(true);
  });

  it("falls back to the national pyramid when the cell index is out of range", async () => {
    serve({
      "/data/mortality-age-sex.json": pyramid(4), // national: 30-49
      "/data/age-sex-cells.json": { archetypes: [archetype(0)], classId: [0] },
    });
    await initPersona();

    const drawn = personasAt(50, NGA, 99);
    expect(drawn.every((p) => p.age >= 30 && p.age <= 49)).toBe(true);
  });

  it("falls back to the national pyramid when no cell index is given", async () => {
    serve({
      "/data/mortality-age-sex.json": pyramid(4),
      "/data/age-sex-cells.json": { archetypes: [archetype(0)], classId: [0] },
    });
    await initPersona();

    const drawn = personasAt(50, NGA, undefined);
    expect(drawn.every((p) => p.age >= 30 && p.age <= 49)).toBe(true);
  });

  it("never throws with a garbage cell index and no cell file at all", async () => {
    serve({});
    await initPersona();

    expect(() => personasAt(50, NGA, 999999)).not.toThrow();
  });
});

// 04-07: eventDate reweights age and cause toward data/seasonal-composition.json's measured or
// transferred month shape. lib/seasonal-composition.ts does its own fetch (independent of
// initPersona()'s loadJson calls), so every test in this block also serves the world topology
// and Köppen class map that fetch needs.
describe("seasonal age/cause reweighting", () => {
  const JAN = new Date(Date.UTC(2027, 0, 1)); // yearPhase ~0 -> cos(2π·phase) ~1 (curve peak)
  const JUL = new Date(Date.UTC(2027, 6, 2)); // yearPhase ~0.5 -> cos(2π·phase) ~-1 (curve trough)

  // A pyramid split 50/50 between the infant band (0) and the 85+ band (8), so a seasonal
  // reweight that favours one over the other is visible as a shift in the age split.
  const splitPyramid = {
    global: {
      m: [1, 0, 0, 0, 0, 0, 0, 0, 1],
      f: [1, 0, 0, 0, 0, 0, 0, 0, 1],
    },
    countries: {},
  };

  // Peaks in January (coefficient 0.5 on the cosine term), flat the rest of the time this test
  // cares about. Only band 8 carries a curve; band 0 (and every other band) stays unmeasured, so
  // its multiplier is always 1 -- the shift comes entirely from band 8 moving.
  const winterOldCurve = { order: 4, coefficients: [1, 0.5, 0, 0, 0, 0, 0, 0, 0] };
  const ageBands: [number, number][] = [
    [0, 0],
    [1, 4],
    [5, 14],
    [15, 29],
    [30, 49],
    [50, 64],
    [65, 74],
    [75, 84],
    [85, 200],
  ];

  function seasonalFiles(overrides: Record<string, unknown> = {}) {
    return {
      "/data/countries-110m.json": WORLD_ATLAS,
      "/data/seasonality-climate-fallback.json": readData("seasonality-climate-fallback.json"),
      ...overrides,
    };
  }

  it("skews the age draw older in January than in July for a measured winter-peaking band", async () => {
    serve({
      "/data/mortality-age-sex.json": splitPyramid,
      ...seasonalFiles({
        "/data/seasonal-composition.json": {
          meta: {
            ageBands,
            causeChapters: [],
            causeLeafGroups: [],
            chapterOfCauseLabel: {},
            ageCountriesMeasured: ["NGA"],
            causeCountriesMeasured: [],
          },
          age: {
            countries: { NGA: [null, null, null, null, null, null, null, null, winterOldCurve] },
          },
          cause: { countries: {} },
        },
      }),
    });
    await initPersona();

    const january = personasAtDate(400, NGA, undefined, JAN);
    const july = personasAtDate(400, NGA, undefined, JUL);
    const oldShare = (drawn: Persona[]) => drawn.filter((p) => p.age >= 85).length / drawn.length;
    // Unweighted 50/50 split; January boosts band 8 to ~1.5x, July suppresses it to ~0.5x.
    expect(oldShare(january)).toBeGreaterThan(0.55);
    expect(oldShare(july)).toBeLessThan(0.45);
    expect(oldShare(january)).toBeGreaterThan(oldShare(july));
  });

  it("leaves the draw unaffected when eventDate is omitted, even with seasonal data loaded", async () => {
    serve({
      "/data/mortality-age-sex.json": splitPyramid,
      ...seasonalFiles({
        "/data/seasonal-composition.json": {
          meta: {
            ageBands,
            causeChapters: [],
            causeLeafGroups: [],
            chapterOfCauseLabel: {},
            ageCountriesMeasured: ["NGA"],
            causeCountriesMeasured: [],
          },
          age: {
            countries: { NGA: [null, null, null, null, null, null, null, null, winterOldCurve] },
          },
          cause: { countries: {} },
        },
      }),
    });
    await initPersona();

    const drawn = personasAtDate(400, NGA, undefined, undefined);
    const oldShare = drawn.filter((p) => p.age >= 85).length / drawn.length;
    expect(oldShare).toBeGreaterThan(0.4);
    expect(oldShare).toBeLessThan(0.6);
  });

  it("reweights cause selection by the label's chapter curve", async () => {
    const cells = () => Array.from({ length: 9 }, () => ({ 0: 1, 1: 1 })); // 50/50 A vs B
    serve({
      "/data/mortality-age-sex.json": pyramid(4),
      "/data/causes.json": {
        causes: ["cause a", "cause b"],
        coverage: { location: "global", age: "age_bands", sex: "male_female" },
        global: { m: cells(), f: cells() },
        countries: {},
      },
      ...seasonalFiles({
        "/data/seasonal-composition.json": {
          meta: {
            ageBands,
            causeChapters: ["IX"],
            causeLeafGroups: [],
            chapterOfCauseLabel: { "cause a": "IX" },
            ageCountriesMeasured: [],
            causeCountriesMeasured: ["NGA"],
          },
          age: { countries: {} },
          cause: { countries: { NGA: { chapters: { IX: winterOldCurve }, leaf: {} } } },
        },
      }),
    });
    await initPersona();

    const shareA = (drawn: Persona[]) =>
      drawn.filter((p) => p.cause === "cause a").length / drawn.length;
    const january = personasAtDate(400, NGA, undefined, JAN);
    const july = personasAtDate(400, NGA, undefined, JUL);
    expect(shareA(january)).toBeGreaterThan(shareA(july));
  });

  it("never throws when an eventDate is given but the seasonal files fail to load", async () => {
    serve({ "/data/mortality-age-sex.json": splitPyramid });
    await initPersona();

    expect(() => personasAtDate(200, NGA, undefined, JAN)).not.toThrow();
    const drawn = personasAtDate(200, NGA, undefined, JAN);
    expect(drawn.every((p) => Number.isFinite(p.age))).toBe(true);
  });
});
