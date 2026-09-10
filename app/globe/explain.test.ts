import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/lib/i18n/en";
import { explainPersona, initPersona, makePersona } from "./persona";
import { explainDeath } from "./explain";
import { registerExplainer, type Death } from "./stageState";
import type { CellMath } from "./useGlobeData";

// The island's card claims to show the odds a death was drawn on. These tests hold it to that
// literally: the reported probabilities are compared against the frequencies makePersona()
// actually produces, so an explanation that merely looks plausible fails.

const WORDS = { ...en.globe, causes: en.causes };
const NGA = 566;
const BRA = 76;

const response = (ok: boolean, body?: unknown) =>
  ({ ok, json: async () => body }) as unknown as Response;

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

// A pyramid weighted across several bands, so the age histogram has a real shape to report.
const SPREAD = [1, 1, 2, 4, 8, 16, 24, 30, 14];
const mortality = { global: { m: SPREAD, f: SPREAD }, countries: {} };

// Deliberately lopsided weights so a wrong normalisation cannot pass by symmetry.
const CAUSE_WEIGHTS = { "0": 50, "1": 25, "2": 15, "3": 7, "4": 2, "5": 1 };
const CAUSE_LABELS = ["cause-a", "cause-b", "cause-c", "cause-d", "cause-e", "cause-f"];

function causeExport() {
  const cells = () => Array.from({ length: 9 }, () => ({ ...CAUSE_WEIGHTS }));
  return {
    causes: CAUSE_LABELS,
    coverage: { location: "global", age: "age_bands", sex: "male_female" },
    global: { m: cells(), f: cells() },
    countries: {},
  };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// The frequency tests below compare a claimed probability against what makePersona() actually
// produces, which means they are sampling — and at 20k draws the noise on a p=0.25 band is a
// third of the gap they are trying to resolve. Seeding makes the comparison exact rather than
// probable, so a failure here is always a real disagreement and never a bad afternoon.
function seedRandom(seed: number): void {
  let a = seed >>> 0;
  vi.spyOn(Math, "random").mockImplementation(() => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  });
}

// Comfortably past the residual noise a seeded 20k-draw sample still carries, and still an order
// of magnitude below the smallest gap between two bands of SPREAD.
const TOLERANCE = 0.01;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  registerExplainer(() => null);
});

describe("explainPersona", () => {
  it("reports distributions that sum to one", async () => {
    serve({ "/data/mortality-age-sex.json": mortality, "/data/causes.json": causeExport() });
    await initPersona();

    const math = explainPersona(undefined, undefined, "f", 5, undefined);
    expect(math).not.toBeNull();
    expect(sum(math!.ages)).toBeCloseTo(1, 10);
    expect(sum(math!.causes.map((c) => c.p))).toBeCloseTo(1, 10);
    expect(math!.sex.m + math!.sex.f).toBeCloseTo(1, 10);
  });

  it("reports the age odds makePersona actually draws on", async () => {
    serve({ "/data/mortality-age-sex.json": mortality, "/data/causes.json": causeExport() });
    await initPersona();

    const math = explainPersona(undefined, undefined, "f", 0, undefined);
    const N = 20_000;
    const seen = new Array<number>(9).fill(0);
    seedRandom(1);
    for (let i = 0; i < N; i++) {
      const { bandIdx } = makePersona(undefined, "Testland", WORDS);
      seen[bandIdx] = (seen[bandIdx] ?? 0) + 1;
    }

    // Every band's claimed share has to match its observed share, so a report that is shifted by
    // a band, unnormalised, or reading the wrong sex's column cannot pass.
    math!.ages.forEach((p, band) =>
      expect(Math.abs(p - (seen[band] as number) / N)).toBeLessThan(TOLERANCE),
    );
  });

  it("reports the cause odds makePersona actually draws on", async () => {
    serve({ "/data/mortality-age-sex.json": mortality, "/data/causes.json": causeExport() });
    await initPersona();

    const math = explainPersona(undefined, undefined, "f", 5, undefined);
    const N = 20_000;
    const seen = new Map<string, number>();
    seedRandom(2);
    for (let i = 0; i < N; i++) {
      const p = makePersona(undefined, "Testland", WORDS);
      seen.set(p.cause, (seen.get(p.cause) ?? 0) + 1);
    }
    for (const { label, p } of math!.causes) {
      expect(Math.abs(p - (seen.get(label) ?? 0) / N)).toBeLessThan(TOLERANCE);
    }
    expect(math!.causes.map((c) => c.label)).toEqual(CAUSE_LABELS); // ranked, heaviest first
  });

  it("names a tier only when the cell layer answered", async () => {
    const band = (b: number) => Array.from({ length: 9 }, (_, i) => (i === b ? 1 : 0));
    serve({
      "/data/mortality-age-sex.json": mortality,
      "/data/causes.json": causeExport(),
      "/data/age-sex-cells.json": {
        archetypes: [{ m: band(3), f: band(3) }],
        classId: [0, 0],
        tier: [0, 2],
      },
    });
    await initPersona();

    expect(explainPersona(undefined, 0, "f", 3, undefined)!.tier).toBe(0);
    expect(explainPersona(undefined, 1, "f", 3, undefined)!.tier).toBe(2);
    // Out of range: pyramidFor() silently falls back to the country pyramid, so claiming a tier
    // here would attribute the draw to regional data that never touched it.
    expect(explainPersona(undefined, 99, "f", 3, undefined)!.tier).toBeNull();
    expect(explainPersona(undefined, undefined, "f", 3, undefined)!.tier).toBeNull();
  });

  it("returns no causes when the export cannot speak to the band", async () => {
    serve({ "/data/mortality-age-sex.json": mortality }); // no causes.json: fallback table answers
    await initPersona();

    const math = explainPersona(NGA, undefined, "m", 4, undefined);
    expect(math!.causes).toEqual([]);
    expect(sum(math!.ages)).toBeCloseTo(1, 10);
  });

  it("treats an all-zero cause table as no answer at all", async () => {
    // A band whose weights are all zero is a table in name only. Read literally it would let the
    // draw return a cause — weightedPick() falls through to the last entry — while the card
    // normalised every probability to zero, so the panel would name an outcome it also called
    // impossible. Both halves have to fall back to the illustrative table together.
    const empty = () =>
      Array.from({ length: 9 }, () =>
        Object.fromEntries(Object.keys(CAUSE_WEIGHTS).map((k) => [k, 0])),
      );
    const zeroed = { ...causeExport(), global: { m: empty(), f: empty() } };
    serve({ "/data/mortality-age-sex.json": mortality, "/data/causes.json": zeroed });
    await initPersona();

    expect(explainPersona(NGA, undefined, "m", 4, undefined)!.causes).toEqual([]);
    seedRandom(7);
    for (let i = 0; i < 200; i++) {
      expect(CAUSE_LABELS).not.toContain(makePersona(NGA, "Nigeria", WORDS).cause);
    }
  });

  it("moves cause weight with the month, and stays a distribution either way", async () => {
    // Real labels and a measured country: the multiplier is keyed by ICD-10 chapter, so the
    // invented labels the other tests use would sit outside the map and never move. Brazil is
    // one of the two countries data/seasonal-composition.json measures causes for.
    const labels = ["lower respiratory infection", "ischaemic heart disease", "drowning"];
    const cells = () => Array.from({ length: 9 }, () => ({ "0": 40, "1": 40, "2": 20 }));
    serve({
      "/data/mortality-age-sex.json": mortality,
      "/data/causes.json": {
        causes: labels,
        coverage: { location: "global", age: "age_bands", sex: "male_female" },
        global: { m: cells(), f: cells() },
        countries: {},
      },
      "/data/seasonal-composition.json": readData("seasonal-composition.json"),
      "/data/countries-110m.json": readData("../node_modules/world-atlas/countries-110m.json"),
      "/data/seasonality-climate-fallback.json": readData("seasonality-climate-fallback.json"),
    });
    await initPersona();

    const at = (iso: string) => {
      const math = explainPersona(BRA, undefined, "m", 5, new Date(iso));
      expect(sum(math!.causes.map((c) => c.p))).toBeCloseTo(1, 10);
      return new Map(math!.causes.map((c) => [c.label, c.p]));
    };
    const january = at("2026-01-15T00:00:00Z");
    const july = at("2026-07-15T00:00:00Z");

    // Brazil's winter is July. Respiratory deaths peak in it; drowning peaks in the January
    // summer. If the card showed one flat annual table these would be equal.
    expect(july.get("lower respiratory infection")!).toBeGreaterThan(
      january.get("lower respiratory infection")!,
    );
    expect(january.get("drowning")!).toBeGreaterThan(july.get("drowning")!);
  });
});

const death = (over: Partial<Death> = {}): Death => ({
  sex: "f",
  age: 70,
  cause: "cause-a",
  country: "Testland",
  text: "Woman 70, cause-a – Testland",
  bandIdx: 6,
  lon: 0,
  lat: 0,
  at: 0,
  m49: NGA,
  cellIndex: 0,
  eventDate: new Date("2026-09-10T00:00:00Z"),
  ...over,
});

describe("explainDeath", () => {
  it("keeps the drawn cause on the card even when it did not place", async () => {
    serve({ "/data/mortality-age-sex.json": mortality, "/data/causes.json": causeExport() });
    await initPersona();

    // "cause-f" is the lightest of six, so it falls outside the top five the card lists.
    const d = explainDeath(death({ cause: "cause-f" }));
    expect(d.causes!.length).toBe(6);
    expect(d.causes!.filter((c) => c.drawn).map((c) => c.label)).toEqual(["cause-f"]);
    expect(d.causeRanked).toBe(6);
    expect(d.causeCount).toBe(6);
  });

  it("flags the band the age came from and labels the open top band", async () => {
    serve({ "/data/mortality-age-sex.json": mortality, "/data/causes.json": causeExport() });
    await initPersona();

    const d = explainDeath(death({ bandIdx: 8 }));
    expect(d.ages!.filter((a) => a.drawn).map((a) => a.label)).toEqual(["85+"]);
    expect(d.ages!.map((a) => a.label)).toEqual([
      "0",
      "1–4",
      "5–14",
      "15–29",
      "30–49",
      "50–64",
      "65–74",
      "75–84",
      "85+",
    ]);
  });

  it("survives a sampler that has not registered an explainer", async () => {
    serve({ "/data/mortality-age-sex.json": mortality, "/data/causes.json": causeExport() });
    await initPersona();

    expect(explainDeath(death()).cell).toBeNull();
  });

  it("passes the sampler's cell arithmetic straight through", async () => {
    serve({ "/data/mortality-age-sex.json": mortality, "/data/causes.json": causeExport() });
    await initPersona();

    const cell: CellMath = {
      m49: NGA,
      year: 2024,
      population: 12_400,
      rate: 0.00953,
      baseDeaths: 118.17,
      seasonal: 1.07,
      seasonalDeaths: 126.44,
      conflict: 0,
      weight: 126.44,
      total: 61_615_938,
    };
    registerExplainer((i) => (i === 7 ? cell : null));
    expect(explainDeath(death({ cellIndex: 7 })).cell).toBe(cell);
  });
});
