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
  it("groups sub-10% country-weeks into Others without losing their breakdown", () => {
    const countryTotals: ConflictCountry[] = [
      { country: "Large", m49: 1, fatalities: 95 },
      { country: "Small", m49: 2, fatalities: 5 },
    ];
    const weekly = new Map([
      [
        "2026-08-01",
        new Map([
          ["Large", 95],
          ["Small", 5],
        ]),
      ],
    ]);
    const stack = buildWeeklyStack(["2026-08-01"], weekly, countryTotals);
    expect(stack.countries).toEqual(["Large", "Others"]);
    expect(stack.weeks[0]!.values).toEqual([95, 5]);
    expect(stack.weeks[0]!.othersBreakdown).toEqual([{ country: "Small", m49: 2, fatalities: 5 }]);
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
    expect(
      snapshot.weeklyStack.weeks.every((week) => week.values.reduce((a, b) => a + b, 0) === 35),
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
