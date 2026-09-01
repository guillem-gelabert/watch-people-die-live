import fs from "node:fs";
import { describe, expect, it } from "vitest";
import isoCountries from "i18n-iso-countries";
import {
  NAMED_IN_PROSE,
  NAMED_IN_PROSE_COUNTRIES,
  namedCountryOf,
  reachedBy,
  representatives,
} from "./representatives";

describe("NAMED_IN_PROSE", () => {
  // The failure mode this guards is a name drifting out of the prose while the chart keeps
  // labelling it, or a country being written into the story and never becoming reachable. Both
  // look like working software. Same reasoning as the M49 coverage test in lib/m49-geoscheme.
  //
  // English only, and deliberately. Unlike the country names in the data — which are never
  // translated — the hand-written story prose does translate them: ROADMAP.ca.md says "Alemanya"
  // and ROADMAP.de.md "Deutschland". The English file is the schema the other two are checked
  // against (see app/roadmap/storyTranslations.test.ts), so it is the one that can answer whether
  // a country is named in the story at all.
  const prose = fs
    .readFileSync("docs/ROADMAP.md", "utf8")
    .replace(/\[[a-z0-9_-]+\]/gi, " ")
    .replace(/`[^`]*`/g, " ");

  it("names only countries the story actually mentions", () => {
    for (const country of NAMED_IN_PROSE) {
      expect(prose, `${country} is not named in docs/ROADMAP.md`).toContain(country);
    }
  });

  it("misses no country the story names", () => {
    // The other half of the coverage: a country written into the prose but left out of this list is
    // a country the reader met and then cannot find in any chart.
    const named = [
      "Mexico",
      "Lithuania",
      "Bulgaria",
      "Germany",
      "Ireland",
      "Sweden",
      "Spain",
      "Japan",
      "India",
      "Brazil",
      "South Africa",
      "Togo",
    ].filter((country) => prose.includes(country));
    expect([...NAMED_IN_PROSE].sort()).toEqual(named.sort());
  });

  it("holds each country once", () => {
    expect(new Set(NAMED_IN_PROSE).size).toBe(NAMED_IN_PROSE.length);
  });
});

describe("representatives", () => {
  const pt = (country: string, amplitude: number, name = country) => ({ country, amplitude, name });
  const opts = {
    countryOf: (p: { country: string }) => p.country,
    rank: (p: { amplitude: number }) => p.amplitude,
  };

  it("keeps only the countries the prose names", () => {
    const picked = representatives([pt("Mexico", 1), pt("Chad", 9), pt("Japan", 2)], opts);
    expect(picked.map((p) => p.country)).toEqual(["Mexico", "Japan"]);
  });

  it("takes one point per country, the highest ranked", () => {
    // A region-level cloud offers 32 Mexican states; Mexico should be offered once.
    const states = Array.from({ length: 32 }, (_, i) => pt("Mexico", i / 100, `state ${i}`));
    const picked = representatives(states, opts);
    expect(picked).toHaveLength(1);
    expect(picked[0]!.name).toBe("state 31");
  });

  it("orders by the story's order of mention, not by the data", () => {
    // So that labels dropped for want of room are the later-mentioned ones, not an arbitrary set.
    const picked = representatives([pt("Togo", 9), pt("Mexico", 1), pt("Germany", 5)], opts);
    expect(picked.map((p) => p.country)).toEqual(["Mexico", "Germany", "Togo"]);
  });

  it("answers empty when the chart holds none of them", () => {
    expect(representatives([pt("Chad", 1)], opts)).toEqual([]);
  });
});

describe("the labelled set covers the plot", () => {
  it("reaches a representative from anywhere, so no tap falls into a hole", () => {
    const reps = [
      { x: 20, y: 20 },
      { x: 200, y: 100 },
      { x: 90, y: 220 },
    ];
    for (let x = 0; x <= 300; x += 25) {
      for (let y = 0; y <= 240; y += 25) {
        expect(reachedBy(reps, x, y), `no representative for ${x},${y}`).not.toBeNull();
      }
    }
  });

  it("reaches nothing when a chart has no representatives, so it must not attach a picker", () => {
    expect(reachedBy([], 10, 10)).toBeNull();
  });
});

describe("the ISO3 codes the region series key on", () => {
  // Held as literals so the charts stay free of i18n-iso-countries — they are client components,
  // and the library would follow the whole ISO table into the bundle. The check lives here instead.
  it("resolves to the country the list names", () => {
    for (const { name, iso3 } of NAMED_IN_PROSE_COUNTRIES) {
      const official = isoCountries.getName(iso3, "en");
      expect(official, `${iso3} is not a country`).toBeTruthy();
      // The story's wording and the ISO register's wording need not match character for character
      // ("South Africa" does, "Bolivia" would not), so this asserts they agree on the same country
      // rather than on the same string.
      expect(isoCountries.alpha3ToAlpha2(iso3), `${iso3} has no alpha-2`).toBeTruthy();
      expect(namedCountryOf(iso3)).toBe(name);
    }
  });

  it("answers null for a country the story never names", () => {
    expect(namedCountryOf("TCD")).toBeNull();
  });
});
