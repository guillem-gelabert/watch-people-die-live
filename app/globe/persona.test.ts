import fs from "node:fs";
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
