import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { AFRICA, AMERICAS, ASIA, CONTINENTS, EUROPE } from "@/lib/m49-geoscheme";
import { CONFLICT_CONTINENTS, CONFLICT_CONTINENT_SHADES } from "../palette";
import type { ConflictStackSegment, ConflictWeeklyStack } from "../types";
import { assignFills, bandContinent, drawOrder, fillVar, OTHER_FILL } from "./conflictStack";

// Codes used below: 804 Ukraine (Eastern Europe -> Europe), 466 Mali and 854 Burkina Faso
// (Western Africa -> Sub-Saharan Africa -> Africa), 566 Nigeria (the same chain), 104 Myanmar
// (South-eastern Asia -> Asia), 320 Guatemala (Central America -> LAC -> Americas).
const member = (country: string, m49: number | null, fatalities: number) => ({
  country,
  m49,
  fatalities,
});

const band = (
  key: string,
  kind: ConflictStackSegment["kind"],
  fatalities: number,
  members: Array<ReturnType<typeof member>>,
): ConflictStackSegment => ({ key, kind, fatalities, members });

const country = (name: string, m49: number, fatalities: number) =>
  band(name, "country", fatalities, [member(name, m49, fatalities)]);

const region = (code: number, members: Array<ReturnType<typeof member>>) =>
  band(
    String(code),
    "region",
    members.reduce((sum, entry) => sum + entry.fatalities, 0),
    members,
  );

const others = (members: Array<ReturnType<typeof member>>) =>
  band(
    "elsewhere",
    "elsewhere",
    members.reduce((sum, entry) => sum + entry.fatalities, 0),
    members,
  );

const stackOf = (weeks: Array<[string, ConflictStackSegment[]]>): ConflictWeeklyStack => {
  const totals = new Map<string, { kind: ConflictStackSegment["kind"]; total: number }>();
  for (const [, segments] of weeks) {
    for (const segment of segments) {
      const running = totals.get(segment.key);
      if (running) running.total += segment.fatalities;
      else totals.set(segment.key, { kind: segment.kind, total: segment.fatalities });
    }
  }
  return {
    keys: [...totals.entries()]
      .map(([key, { kind, total }]) => ({ key, kind, total }))
      .sort((a, b) => b.total - a.total),
    weeks: weeks.map(([week, segments]) => ({ week, segments })),
  };
};

describe("drawOrder", () => {
  it("puts the residual on the floor and climbs to the largest band", () => {
    const ordered = drawOrder([
      country("Ukraine", 804, 900),
      others([member("Pacific Ocean", null, 300)]),
      country("Nigeria", 566, 500),
      region(11, [member("Mali", 466, 200)]),
    ]);
    // Drawn from the axis up, so index 0 is the bottom of the bar and the last is the top.
    expect(ordered.map((segment) => segment.key)).toEqual([
      "elsewhere",
      "11",
      "Nigeria",
      "Ukraine",
    ]);
  });

  it("leaves a bar with no residual as a plain ascending stack", () => {
    const ordered = drawOrder([country("Ukraine", 804, 900), country("Nigeria", 566, 500)]);
    expect(ordered.map((segment) => segment.key)).toEqual(["Nigeria", "Ukraine"]);
  });

  it("breaks ties on key so a re-render cannot reorder two equal bands", () => {
    const forwards = drawOrder([country("Nigeria", 566, 500), country("Myanmar", 104, 500)]);
    const backwards = drawOrder([country("Myanmar", 104, 500), country("Nigeria", 566, 500)]);
    expect(forwards.map((segment) => segment.key)).toEqual(["Myanmar", "Nigeria"]);
    expect(backwards.map((segment) => segment.key)).toEqual(forwards.map((segment) => segment.key));
  });

  it("keeps every band, so a reorder cannot drop deaths out of the bar", () => {
    const segments = [
      country("Ukraine", 804, 900),
      others([member("Pacific Ocean", null, 300)]),
      region(11, [member("Mali", 466, 200)]),
    ];
    const ordered = drawOrder(segments);
    expect(ordered).toHaveLength(segments.length);
    expect(ordered.reduce((sum, segment) => sum + segment.fatalities, 0)).toBe(1400);
  });
});

describe("bandContinent", () => {
  it("reads a country band from its own code and a region band from its members", () => {
    expect(bandContinent(country("Ukraine", 804, 10))).toBe(EUROPE);
    expect(
      bandContinent(region(11, [member("Mali", 466, 4), member("Burkina Faso", 854, 3)])),
    ).toBe(AFRICA);
    expect(bandContinent(region(419, [member("Guatemala", 320, 4)]))).toBe(AMERICAS);
    expect(bandContinent(country("Myanmar", 104, 10))).toBe(ASIA);
  });

  it("resolves a region band whose first member has no M49", () => {
    // members arrive largest-first, and the largest can be a code the geoscheme does not know.
    const mixed = region(11, [member("Pacific Ocean", null, 9), member("Mali", 466, 4)]);
    expect(bandContinent(mixed)).toBe(AFRICA);
  });

  it("gives the residual no continent, however its members resolve", () => {
    expect(bandContinent(others([member("Mali", 466, 4)]))).toBeNull();
  });
});

describe("assignFills", () => {
  it("colours by continent and separates two bands that share one in a bar", () => {
    const fills = assignFills(
      stackOf([
        [
          "2026-08-01",
          [
            country("Ukraine", 804, 900),
            country("Nigeria", 566, 500),
            region(11, [member("Mali", 466, 200)]),
            others([member("Pacific Ocean", null, 100)]),
          ],
        ],
      ]),
    );
    const ukraine = fills.get("Ukraine")!;
    const nigeria = fills.get("Nigeria")!;
    const westAfrica = fills.get("11")!;
    // Nigeria and Western Africa are both Africa, so the hue is shared and the shade is not.
    expect(nigeria.continent).toBe(westAfrica.continent);
    expect(nigeria.shade).not.toBe(westAfrica.shade);
    // Ukraine is Europe, so it takes a different hue and is free to reuse shade 0.
    expect(ukraine.continent).not.toBe(nigeria.continent);
    expect(fillVar(ukraine)).not.toBe(fillVar(nigeria));
    expect(fillVar(fills.get("elsewhere"))).toBe(OTHER_FILL);
  });

  it("keys the hue to the continent, not to rank, so a band keeps it across a week it misses", () => {
    const fills = assignFills(
      stackOf([
        ["2026-08-01", [country("Ukraine", 804, 900), country("Nigeria", 566, 500)]],
        // Nigeria absent entirely, and Myanmar arrives above it in the ranking.
        ["2026-08-08", [country("Ukraine", 804, 900), country("Myanmar", 104, 800)]],
      ]),
    );
    expect(fills.get("Ukraine")!.continent).toBe(CONTINENTS.indexOf(EUROPE));
    expect(fills.get("Nigeria")!.continent).toBe(CONTINENTS.indexOf(AFRICA));
    expect(fills.get("Myanmar")!.continent).toBe(CONTINENTS.indexOf(ASIA));
  });

  it("spends the extreme shades first, so the common pair is the most separated one", () => {
    const fills = assignFills(
      stackOf([
        [
          "2026-08-01",
          [
            country("Nigeria", 566, 500),
            region(11, [member("Mali", 466, 200)]),
            country("Ukraine", 804, 100),
          ],
        ],
      ]),
    );
    // shadeRamp orders its ramp extremes-first, so shades 0 and 1 are the two ends of it.
    expect([fills.get("Nigeria")!.shade, fills.get("11")!.shade].sort()).toEqual([0, 1]);
  });

  it("falls back to rank rather than throwing when a bar outruns the ramp", () => {
    const many = Array.from({ length: CONFLICT_CONTINENT_SHADES + 2 }, (_, i) =>
      region(11, [member(`Africa country ${i}`, 466, 100 - i)]),
    ).map((segment, i) => ({ ...segment, key: `africa-${i}` }));
    const fills = assignFills(stackOf([["2026-08-01", many]]));
    expect(fills.size).toBe(many.length);
    for (const segment of many) {
      const fill = fills.get(segment.key)!;
      expect(fill.shade).toBeGreaterThanOrEqual(0);
      expect(fill.shade).toBeLessThan(CONFLICT_CONTINENT_SHADES);
    }
  });

  it("survives an absent stack", () => {
    expect(assignFills(undefined).size).toBe(0);
    expect(fillVar(undefined)).toBe(OTHER_FILL);
  });
});

// The palette publishes one hue per continent and the stack maps a continent to a hue slot by its
// index in CONTINENTS. Nothing in either file fails loudly if those two drift, so assert it here:
// a seventh continent, or a narrower ramp, would otherwise silently paint bands off the end of the
// published variables. Same reasoning as the M49 coverage test in lib/m49-geoscheme.test.ts.
describe("the ramp covers the geoscheme", () => {
  it("publishes a hue for every continent a band can resolve to", () => {
    expect(CONFLICT_CONTINENTS).toBe(CONTINENTS.length);
  });

  it("gives every continent a slot inside the published ramp", () => {
    for (const continent of CONTINENTS) {
      const slot = CONTINENTS.indexOf(continent);
      expect(slot).toBeGreaterThanOrEqual(0);
      expect(slot).toBeLessThan(CONFLICT_CONTINENTS);
    }
  });
});

describe("the committed snapshot", () => {
  const payload = JSON.parse(fs.readFileSync("data/conflicts.json", "utf8")) as {
    weeklyStack: ConflictWeeklyStack;
  };

  it("never draws one fill twice in a bar", () => {
    const fills = assignFills(payload.weeklyStack);
    for (const week of payload.weeklyStack.weeks) {
      const drawn = week.segments.map((segment) => fillVar(fills.get(segment.key)));
      expect(new Set(drawn).size, `${week.week} repeats a fill`).toBe(drawn.length);
    }
  });

  it("resolves a continent for every band that is not the residual", () => {
    for (const week of payload.weeklyStack.weeks) {
      for (const segment of week.segments) {
        if (segment.kind === "elsewhere") continue;
        expect(bandContinent(segment), `${week.week} ${segment.key}`).not.toBeNull();
      }
    }
  });

  it("puts the residual at the bottom of every bar and the largest band at the top", () => {
    for (const week of payload.weeklyStack.weeks) {
      const ordered = drawOrder(week.segments);
      const residual = week.segments.find((segment) => segment.kind === "elsewhere");
      if (residual) expect(ordered[0]!.key).toBe("elsewhere");
      const tops = ordered.filter((segment) => segment.kind !== "elsewhere");
      const largest = Math.max(...tops.map((segment) => segment.fatalities));
      expect(tops[tops.length - 1]!.fatalities).toBe(largest);
    }
  });
});
