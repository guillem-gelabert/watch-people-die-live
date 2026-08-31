import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { afterEach, describe, expect, it } from "vitest";
import {
  ACLED_WINDOW_WEEKS,
  addUtcDays,
  buildSnapshot,
  buildWeeklyStack,
  commonCutoff,
  countryM49,
  discoverWorkbook,
  parseRegionalWorkbook,
  parseWeek,
  STACK_WEEKLY_SHARE,
  validateWorkbookHeaders,
  type ConflictCountry,
  type DiscoveredWorkbook,
  type ParsedRegionalWorkbook,
} from "./acled-weekly";

const HEADERS = [
  "WEEK",
  "REGION",
  "COUNTRY",
  "ADMIN1",
  "EVENT_TYPE",
  "SUB_EVENT_TYPE",
  "EVENTS",
  "FATALITIES",
  "POPULATION_EXPOSURE",
  "DISORDER_TYPE",
  "ID",
  "CENTROID_LATITUDE",
  "CENTROID_LONGITUDE",
];

const workbookDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    workbookDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

async function workbookFile(rows: unknown[][], headers = HEADERS): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "acled-weekly-workbook-"));
  workbookDirectories.push(directory);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Aggregated");
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
  const filename = path.join(directory, "aggregate.xlsx");
  await workbook.xlsx.writeFile(filename);
  return filename;
}

function row(
  week: unknown,
  country: unknown,
  admin1: unknown,
  fatalities: unknown,
  latitude: unknown,
  longitude: unknown,
): unknown[] {
  return [
    week,
    "Region",
    country,
    admin1,
    "Battles",
    "Armed clash",
    1,
    fatalities,
    0,
    "Political violence",
    "id",
    latitude,
    longitude,
  ];
}

describe("ACLED weekly workbook parsing", () => {
  it("parses Excel dates and filters incomplete, zero-fatality, and invalid rows", async () => {
    const serial = (Date.UTC(2026, 7, 1) - Date.UTC(1899, 11, 30)) / 86_400_000;
    expect(parseWeek(serial)).toBe("2026-08-01");
    expect(parseWeek(new Date("2026-08-01T12:00:00Z"))).toBe("2026-08-01");

    const parsed = await parseRegionalWorkbook(
      await workbookFile([
        row(new Date("2026-08-01T00:00:00Z"), "United States", "Texas", 4, 31, -99),
        row("2026-07-25", "United States", "Texas", 0, 31, -99),
        row("2026-08-08", "United States", "Texas", 7, 31, -99),
        row("not-a-date", "United States", "Texas", 2, 31, -99),
        row("2026-08-01", "United States", "Texas", 2, 100, -99),
      ]),
      "North America",
      "2026-08-08",
      "2026-05-16",
      "2026-08-01",
    );

    expect(parsed.rows).toEqual([
      {
        week: "2026-08-01",
        country: "United States",
        admin1: "Texas",
        fatalities: 4,
        latitude: 31,
        longitude: -99,
      },
    ]);
    expect(parsed.rowsRead).toBe(5);
    expect(parsed.rowsRetained).toBe(1);
    expect(parsed.invalidRows).toBe(2);
  });

  it("rejects a workbook whose aggregate schema changed", () => {
    expect(() => validateWorkbookHeaders(HEADERS.filter((header) => header !== "ADMIN1"))).toThrow(
      "ADMIN1",
    );
  });
});

describe("ACLED source selection and country mapping", () => {
  it("discovers the newest dated XLSX and chooses the oldest regional cutoff", () => {
    const source = { id: "africa", label: "Africa", landingUrl: "https://acled.test/africa" };
    const discovered = discoverWorkbook(
      '<a href="/old/week_of-2026-07-25.xlsx">old</a><a href="/new/week_of-2026-08-08.xlsx">new</a>',
      source,
    );
    expect(discovered.workbookUrl).toBe("https://acled.test/new/week_of-2026-08-08.xlsx");
    const workbooks = [
      discovered,
      { ...discovered, id: "asia", latestThrough: "2026-08-01" },
      { ...discovered, id: "europe", latestThrough: "2026-08-08" },
    ] satisfies DiscoveredWorkbook[];
    expect(commonCutoff(workbooks)).toBe("2026-08-01");
  });

  it("maps ACLED spellings and explicit aliases to M49", () => {
    expect(countryM49("United States")).toBe(840);
    expect(countryM49("Democratic Republic of Congo")).toBe(180);
    expect(countryM49("Moldova")).toBe(498);
    expect(countryM49("Syria")).toBe(760);
    expect(countryM49("Atlantis")).toBeNull();
  });
});

describe("weekly aggregation and spatial placement", () => {
  // Codes used below: 466 Mali and 854 Burkina Faso are Western Africa (011), which rolls up
  // through Sub-Saharan Africa (202) to Africa (002); 320 Guatemala and 340 Honduras are Central
  // America (013) under Latin America and the Caribbean (419) and then the Americas (019).
  const country = (name: string, m49: number | null, fatalities: number): ConflictCountry => ({
    country: name,
    m49,
    fatalities,
  });
  const stackOf = (week: Array<[string, number]>, totals: ConflictCountry[]) =>
    buildWeeklyStack(["2026-08-01"], new Map([["2026-08-01", new Map(week)]]), totals).weeks[0]!
      .segments;

  it("names a country on exactly the threshold and nothing below it", () => {
    const segments = stackOf(
      [
        ["Ukraine", 80],
        ["Mali", 10],
        ["Burkina Faso", 10],
      ],
      [country("Ukraine", 804, 80), country("Mali", 466, 10), country("Burkina Faso", 854, 10)],
    );
    // Mali and Burkina Faso are each exactly 10% of the 100 deaths, so both stand alone; nothing
    // is left over to group.
    expect(segments.map((segment) => segment.key)).toEqual(["Ukraine", "Mali", "Burkina Faso"]);
    expect(segments.every((segment) => segment.kind === "country")).toBe(true);
  });

  it("groups sub-threshold countries that share a subregion", () => {
    const segments = stackOf(
      [
        ["Ukraine", 84],
        ["Mali", 8],
        ["Burkina Faso", 8],
      ],
      [country("Ukraine", 804, 84), country("Mali", 466, 8), country("Burkina Faso", 854, 8)],
    );
    // Neither reaches 10% of the 100 deaths alone; together their subregion does, so Western
    // Africa is drawn rather than two slivers or an anonymous residual.
    expect(segments.map((segment) => segment.key)).toEqual(["Ukraine", "11"]);
    expect(segments[1]!.kind).toBe("region");
    expect(segments[1]!.members.map(({ country: name }) => name).sort()).toEqual([
      "Burkina Faso",
      "Mali",
    ]);
  });

  it("sends a lone sub-threshold country to the residual, however far it coarsens", () => {
    const segments = stackOf(
      [
        ["Ukraine", 80],
        ["Mali", 8],
        ["Burkina Faso", 12],
      ],
      [country("Ukraine", 804, 80), country("Mali", 466, 8), country("Burkina Faso", 854, 12)],
    );
    // Burkina Faso clears 10% on its own, so Mali is alone below the line: no amount of
    // coarsening gets 8 to 10, and Western Africa, Sub-Saharan Africa and Africa each hold only
    // Mali. It ends in the residual — which is then itself under the floor and absorbs the
    // smallest band.
    expect(segments.map((segment) => segment.key)).toEqual(["Ukraine", "elsewhere"]);
    expect(segments[1]!.members.map(({ country: name }) => name)).toEqual(["Burkina Faso", "Mali"]);
  });

  it("coarsens through the intermediary region only as far as it must", () => {
    const segments = stackOf(
      [
        ["Ukraine", 168],
        ["Guatemala", 16],
        ["Haiti", 16],
      ],
      [country("Ukraine", 804, 168), country("Guatemala", 320, 16), country("Haiti", 332, 16)],
    );
    // Of 200 deaths the floor is 20. Central America (013) and the Caribbean (029) each hold 16
    // and fail alone; both climb one step to Latin America and the Caribbean (419), where they
    // meet and clear together. The continent (019) is never reached.
    expect(segments.map((segment) => segment.key)).toEqual(["Ukraine", "419"]);
    expect(segments[1]!.members.map(({ country: name }) => name).sort()).toEqual([
      "Guatemala",
      "Haiti",
    ]);
  });

  it("sends a country with no M49 to the residual instead of naming it", () => {
    const segments = stackOf(
      [
        ["Ukraine", 80],
        ["Pacific Ocean", 20],
      ],
      [country("Ukraine", 804, 80), country("Pacific Ocean", null, 20)],
    );
    // ACLED files events at sea under an ocean. It is 20% of the week and would otherwise take a
    // band and a colour, but it has no region to roll up into.
    expect(segments.map((segment) => segment.key)).toEqual(["Ukraine", "elsewhere"]);
    expect(segments[1]!.members.map(({ country: name }) => name)).toEqual(["Pacific Ocean"]);
  });

  it("keeps the residual itself above the threshold by absorbing the smallest band", () => {
    const segments = stackOf(
      [
        ["Ukraine", 840],
        ["Mali", 100],
        ["Pacific Ocean", 60],
      ],
      [country("Ukraine", 804, 840), country("Mali", 466, 100), country("Pacific Ocean", null, 60)],
    );
    // The floor is 100. The ocean's 60 cannot reach it and has nowhere to roll up, so the residual
    // would be a 6% sliver; it takes the smallest surviving band — Mali's — and clears.
    const residual = segments.find((segment) => segment.kind === "elsewhere")!;
    expect(residual.fatalities).toBe(160);
    expect(residual.members.map(({ country: name }) => name)).toEqual(["Mali", "Pacific Ocean"]);
    expect(segments.every((segment) => segment.fatalities >= 1000 * STACK_WEEKLY_SHARE)).toBe(true);
  });

  it("ranks keys once for the window so a band keeps its colour across weeks it misses", () => {
    const weeks = ["2026-08-01", "2026-08-08"];
    const stack = buildWeeklyStack(
      weeks,
      new Map([
        [
          "2026-08-01",
          new Map([
            ["Ukraine", 50],
            ["Mali", 50],
          ]),
        ],
        // Mali is absent entirely in the second week.
        ["2026-08-08", new Map([["Ukraine", 100]])],
      ]),
      [country("Ukraine", 804, 150), country("Mali", 466, 50)],
    );
    expect(stack.keys.map(({ key }) => key)).toEqual(["Ukraine", "Mali"]);
    expect(stack.keys.map(({ total }) => total)).toEqual([150, 50]);
    expect(stack.weeks[1]!.segments.map(({ key }) => key)).toEqual(["Ukraine"]);
  });

  it("keeps 12 complete weeks, places centroids in-country, and conserves model weight", () => {
    const cutoff = "2026-08-01";
    const start = addUtcDays(cutoff, -(ACLED_WINDOW_WEEKS - 1) * 7);
    const rows = Array.from({ length: ACLED_WINDOW_WEEKS }, (_, index) => {
      const week = addUtcDays(start, index * 7);
      return [
        {
          week,
          country: "Afghanistan",
          admin1: "Near Kabul",
          fatalities: 10,
          latitude: 0.2,
          longitude: 0.2,
        },
        {
          week,
          country: "United States",
          admin1: "Texas",
          fatalities: 20,
          latitude: 30,
          longitude: -99,
        },
        {
          week,
          country: "Atlantis",
          admin1: "Nowhere",
          fatalities: 5,
          latitude: 5,
          longitude: 5,
        },
      ];
    }).flat();
    const workbook: ParsedRegionalWorkbook = {
      region: "Test",
      latestThrough: cutoff,
      rowsRead: rows.length,
      rowsRetained: rows.length,
      invalidRows: 0,
      rows,
    };
    const snapshot = buildSnapshot([workbook], cutoff, {
      cellsize: 0.5,
      cells: [
        [0, 0, 4, 100],
        [10, 10, 4, 100],
        [-99.5, 29.5, 840, 100],
        [-80, 40, 840, 100],
      ],
    });

    expect(snapshot.weeklyStack.weeks).toHaveLength(12);
    // The rollup must not lose anybody: every death in a week is in exactly one band, whether
    // that band is a country, a region it was grouped into, or the residual.
    expect(
      snapshot.weeklyStack.weeks.every(
        (week) => week.segments.reduce((sum, segment) => sum + segment.fatalities, 0) === 35,
      ),
    ).toBe(true);
    expect(snapshot.regions.find((region) => region.admin1 === "Near Kabul")?.cell).toEqual([0, 0]);
    expect(snapshot.regions.find((region) => region.admin1 === "Texas")?.cell).toEqual([
      -99.5, 29.5,
    ]);
    expect(snapshot.coverage.unmappedCountries.map(({ country }) => country)).toEqual(["Atlantis"]);
    expect(snapshot.coverage.droppedFatalities).toBe(60);
    expect(snapshot.cells.reduce((sum, cell) => sum + cell[2], 0)).toBeCloseTo(
      snapshot.ewma.predictedWeekly * (365 / 7),
      8,
    );
  });
});
