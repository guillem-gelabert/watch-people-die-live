import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { buffer as bufferStream } from "node:stream/consumers";
import ExcelJS from "exceljs";
import isoCountries from "i18n-iso-countries";
import unzipper from "unzipper";
import { robustEwma } from "./conflict-model";

export const ACLED_SCHEMA_VERSION = 2 as const;
export const ACLED_WINDOW_WEEKS = 12;
export const DEFAULT_HALF_LIFE_WEEKS = 4;
export const DEFAULT_CLAMP_PERCENTILE = 10;
export const STACK_WEEKLY_SHARE = 0.1;

export type ConflictCell = [lon: number, lat: number, annualizedFatalities: number];

export interface ConflictCountry {
  country: string;
  m49: number | null;
  fatalities: number;
}

export interface ConflictRegion {
  country: string;
  admin1: string;
  m49: number | null;
  latitude: number;
  longitude: number;
  fatalities: number;
  share: number;
  annualizedFatalities: number;
  cell: [lon: number, lat: number] | null;
}

export interface ConflictWeeklyStack {
  countries: string[];
  weeks: Array<{
    week: string;
    values: number[];
    othersBreakdown: ConflictCountry[];
  }>;
}

export interface AcledRegionalCoverage {
  region: string;
  latestThrough: string;
  rowsRead: number;
  rowsRetained: number;
  invalidRows: number;
}

export interface ConflictsPayload {
  schemaVersion: typeof ACLED_SCHEMA_VERSION;
  source: string;
  license: string;
  granularity: "week";
  spatialPrecision: "admin1-centroid";
  window: { start: string; end: string; weeks: number };
  commonThrough: string;
  generatedAt: string;
  totalFatalities: number;
  weeklyStack: ConflictWeeklyStack;
  regions: ConflictRegion[];
  byCountry: ConflictCountry[];
  cells: ConflictCell[];
  ewma: {
    halfLifeWeeks: number;
    clampPercentile: number;
    lower: number;
    upper: number;
    curve: number[];
    predictedWeekly: number;
    annualizedPrediction: number;
  };
  coverage: {
    regionalSources: AcledRegionalCoverage[];
    unmappedCountries: ConflictCountry[];
    droppedFatalities: number;
    placedFatalities: number;
  };
  // No `freshness` field. It used to carry { status, ageHours, refreshedAt } computed by the
  // runtime snapshot cache. With the layer baked at build time there is no honest value to put
  // in it: a status frozen at build says "fresh" forever, and `refreshedAt` set to the build
  // clock would move on a rebuild that fetched nothing new — telling a reader the data is
  // current when it is not. `commonThrough` is the honest field, it is already in the payload,
  // and `ConflictMap` already shows it. Any consumer wanting an age can subtract it from now.
  note?: string;
}

export interface AcledRegionSource {
  id: string;
  label: string;
  landingUrl: string;
}

export interface DiscoveredWorkbook extends AcledRegionSource {
  workbookUrl: string;
  latestThrough: string;
}

export interface AggregatedRegionRow {
  week: string;
  country: string;
  admin1: string;
  fatalities: number;
  latitude: number;
  longitude: number;
}

export interface ParsedRegionalWorkbook {
  region: string;
  latestThrough: string;
  rowsRead: number;
  rowsRetained: number;
  invalidRows: number;
  rows: AggregatedRegionRow[];
}

export interface RateGridInput {
  cellsize: number;
  cells: Array<[lon: number, lat: number, m49: number, weight: number]>;
}

const REQUIRED_HEADERS = [
  "WEEK",
  "COUNTRY",
  "ADMIN1",
  "FATALITIES",
  "CENTROID_LATITUDE",
  "CENTROID_LONGITUDE",
] as const;

const COUNTRY_ALIASES = new Map<string, string>([
  ["bolivia (plurinational state of)", "BOL"],
  ["cape verde", "CPV"],
  ["cote d'ivoire", "CIV"],
  ["côte d'ivoire", "CIV"],
  ["czech republic", "CZE"],
  ["democratic people's republic of korea", "PRK"],
  ["democratic republic of congo", "COD"],
  ["democratic republic of the congo", "COD"],
  ["east timor", "TLS"],
  ["iran (islamic republic of)", "IRN"],
  ["ivory coast", "CIV"],
  ["kosovo", "XKK"],
  ["lao people's democratic republic", "LAO"],
  ["moldova", "MDA"],
  ["north korea", "PRK"],
  ["palestine", "PSE"],
  ["republic of congo", "COG"],
  ["republic of korea", "KOR"],
  ["republic of moldova", "MDA"],
  ["russia", "RUS"],
  ["russian federation", "RUS"],
  ["south korea", "KOR"],
  ["syria", "SYR"],
  ["syrian arab republic", "SYR"],
  ["taiwan", "TWN"],
  ["taiwan (province of china)", "TWN"],
  ["the gambia", "GMB"],
  ["turkiye", "TUR"],
  ["türkiye", "TUR"],
  ["united republic of tanzania", "TZA"],
  ["united states of america", "USA"],
  ["venezuela (bolivarian republic of)", "VEN"],
  ["viet nam", "VNM"],
]);

const DAY_MS = 24 * 60 * 60 * 1000;

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addUtcDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

function scalar(value: ExcelJS.CellValue | undefined): unknown {
  if (value && typeof value === "object" && !(value instanceof Date)) {
    if ("result" in value) return value.result;
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
    if ("text" in value) return value.text;
  }
  return value;
}

export function parseWeek(value: unknown): string | null {
  const raw = scalar(value as ExcelJS.CellValue | undefined);
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return isoDate(raw);
  if (typeof raw === "number" && Number.isFinite(raw)) {
    // Excel's 1900 date system includes the fictitious 1900-02-29; 1899-12-30 is the
    // conventional epoch that compensates for it.
    return isoDate(new Date(Date.UTC(1899, 11, 30) + Math.floor(raw) * DAY_MS));
  }
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(`${text}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : isoDate(date);
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : isoDate(date);
}

function normalizedCountry(country: string): string {
  return country.trim().toLocaleLowerCase("en").replaceAll("’", "'");
}

export function countryM49(country: string): number | null {
  const alpha3 =
    COUNTRY_ALIASES.get(normalizedCountry(country)) ?? isoCountries.getAlpha3Code(country, "en");
  if (!alpha3) return null;
  const numeric = Number(isoCountries.alpha3ToNumeric(alpha3));
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

export function discoverWorkbook(html: string, source: AcledRegionSource): DiscoveredWorkbook {
  const decoded = html.replaceAll("\\/", "/").replaceAll("&amp;", "&");
  const matches = [...decoded.matchAll(/(?:href\s*=\s*)?["']([^"']+\.xlsx(?:\?[^"']*)?)["']/gi)];
  const candidates = matches
    .map((match) => {
      const raw = match[1];
      if (!raw) return null;
      const url = new URL(raw, source.landingUrl).toString();
      const dateMatches = [...url.matchAll(/(\d{4}-\d{2}-\d{2})/g)];
      const latestThrough = dateMatches.at(-1)?.[1];
      return latestThrough ? { url, latestThrough } : null;
    })
    .filter((value): value is { url: string; latestThrough: string } => value !== null)
    .sort((a, b) => b.latestThrough.localeCompare(a.latestThrough));
  const current = candidates[0];
  if (!current) throw new Error(`ACLED ${source.label} page contained no dated XLSX link`);
  return { ...source, workbookUrl: current.url, latestThrough: current.latestThrough };
}

export function commonCutoff(workbooks: DiscoveredWorkbook[]): string {
  if (workbooks.length === 0) throw new Error("No ACLED regional workbooks were discovered");
  return workbooks.reduce(
    (oldest, workbook) => (workbook.latestThrough < oldest ? workbook.latestThrough : oldest),
    workbooks[0]!.latestThrough,
  );
}

export function validateWorkbookHeaders(headers: string[]): void {
  const normalized = new Set(headers.map((header) => header.trim().toUpperCase()));
  const missing = REQUIRED_HEADERS.filter((header) => !normalized.has(header));
  // The received row goes in the message. Without it "missing headers: WEEK, COUNTRY, ..." is
  // the same text whether the sheet has the wrong columns, whether the header row was skipped and
  // a data row measured instead, or whether the cells arrived empty because the reader reached
  // the worksheet before the shared-string table. Those need different fixes.
  if (missing.length) {
    const saw = headers.length ? headers.map((h) => JSON.stringify(h)).join(", ") : "(no cells)";
    throw new Error(`ACLED workbook missing headers: ${missing.join(", ")}; row contained ${saw}`);
  }
}

function headerIndexes(row: ExcelJS.Row): Record<(typeof REQUIRED_HEADERS)[number], number> {
  const found = new Map<string, number>();
  row.eachCell({ includeEmpty: false }, (cell, column) => {
    found.set(
      String(scalar(cell.value) ?? "")
        .trim()
        .toUpperCase(),
      column,
    );
  });
  validateWorkbookHeaders([...found.keys()]);
  return Object.fromEntries(
    REQUIRED_HEADERS.map((header) => [header, found.get(header)!]),
  ) as Record<(typeof REQUIRED_HEADERS)[number], number>;
}

function textCell(row: ExcelJS.Row, column: number): string {
  return String(scalar(row.getCell(column).value) ?? "").trim();
}

function numberCell(row: ExcelJS.Row, column: number): number {
  const value = Number(scalar(row.getCell(column).value));
  return Number.isFinite(value) ? value : Number.NaN;
}

// The slice of ExcelJS's streaming WorkbookReader that primeWorkbookReader reaches into. These
// are the reader's own parse methods and caches, just not part of its published typings.
interface WorkbookReaderInternals {
  sharedStrings?: unknown[];
  workbookRels?: unknown;
  model?: unknown;
  _parseRels(entry: Readable): Promise<void>;
  _parseWorkbook(entry: Readable): Promise<void>;
  _parseSharedStrings(entry: Readable): AsyncGenerator<unknown>;
  _parseStyles(entry: Readable): Promise<void>;
}

// Excel and ExcelJS both write sharedStrings.xml AFTER the worksheets in the ZIP. ExcelJS's
// streaming reader handles that order by spooling each early worksheet to a temp file and
// parsing it once the whole archive has been read — but that detour stalls the unzip stream
// often enough that it fires `end` mid-archive, and the spooled sheet is then parsed with no
// shared strings and no workbook model at all: every text cell surfaces as {sharedString: n}.
// So read the tiny metadata parts out of the ZIP's central directory first (random access — no
// ordering, no streaming) and hand them to the reader before it sees the first entry. Every
// worksheet then takes the reader's direct streaming path and the temp-file detour is dead code.
async function primeWorkbookReader(
  reader: ExcelJS.stream.xlsx.WorkbookReader,
  archive: Buffer,
): Promise<void> {
  const internals = reader as unknown as WorkbookReaderInternals;
  const directory = await unzipper.Open.buffer(archive);
  const part = (path: string) =>
    directory.files.find((file) => file.path.replaceAll("\\", "/") === path);

  const rels = part("xl/_rels/workbook.xml.rels");
  if (rels) await internals._parseRels(rels.stream() as unknown as Readable);
  const workbook = part("xl/workbook.xml");
  if (workbook) await internals._parseWorkbook(workbook.stream() as unknown as Readable);
  const styles = part("xl/styles.xml");
  if (styles) await internals._parseStyles(styles.stream() as unknown as Readable);
  const shared = part("xl/sharedStrings.xml");
  if (shared) {
    // In "cache" mode the generator yields nothing; iterating it just runs the parse.
    for await (const ignored of internals._parseSharedStrings(
      shared.stream() as unknown as Readable,
    )) {
      void ignored;
    }
  } else {
    // No shared-string table (all-inline workbook): an empty cache keeps the reader on its
    // direct path, which never consults it for inline cells.
    internals.sharedStrings = [];
  }
}

export async function parseRegionalWorkbook(
  input: string | Readable,
  region: string,
  latestThrough: string,
  start: string,
  end: string,
): Promise<ParsedRegionalWorkbook> {
  const archive = typeof input === "string" ? await readFile(input) : await bufferStream(input);
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(Readable.from(archive), {
    entries: "ignore",
    sharedStrings: "cache",
    hyperlinks: "ignore",
    styles: "cache",
    worksheets: "emit",
  });
  await primeWorkbookReader(reader, archive);
  let rowsRead = 0;
  let rowsRetained = 0;
  let invalidRows = 0;
  const rows: AggregatedRegionRow[] = [];
  let sawWorksheet = false;

  for await (const worksheet of reader) {
    sawWorksheet = true;
    let headers: ReturnType<typeof headerIndexes> | null = null;
    for await (const row of worksheet) {
      if (!headers) {
        if (row.cellCount === 0) continue;
        headers = headerIndexes(row);
        continue;
      }
      rowsRead++;
      const week = parseWeek(row.getCell(headers.WEEK).value);
      const fatalities = numberCell(row, headers.FATALITIES);
      if (!week || !Number.isFinite(fatalities)) {
        invalidRows++;
        continue;
      }
      if (week < start || week > end || fatalities <= 0) continue;
      const country = textCell(row, headers.COUNTRY);
      const admin1 = textCell(row, headers.ADMIN1);
      const latitude = numberCell(row, headers.CENTROID_LATITUDE);
      const longitude = numberCell(row, headers.CENTROID_LONGITUDE);
      if (
        !country ||
        !admin1 ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        invalidRows++;
        continue;
      }
      rowsRetained++;
      rows.push({ week, country, admin1, fatalities, latitude, longitude });
    }
    // Only the first worksheet carries data; returning here also stops the reader before it
    // re-parses the shared-string and workbook entries still ahead of it in the archive.
    break;
  }
  if (!sawWorksheet) throw new Error(`ACLED ${region} workbook contained no worksheet`);
  return { region, latestThrough, rowsRead, rowsRetained, invalidRows, rows };
}

export function buildWeeklyStack(
  weeks: string[],
  weeklyCountry: Map<string, Map<string, number>>,
  countries: ConflictCountry[],
): ConflictWeeklyStack {
  const named = new Set<string>();
  for (const week of weeks) {
    const counts = weeklyCountry.get(week) ?? new Map();
    const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
    if (total <= 0) continue;
    for (const [country, fatalities] of counts) {
      if (fatalities >= total * STACK_WEEKLY_SHARE) named.add(country);
    }
  }
  const ordered = countries
    .filter(({ country }) => named.has(country))
    .map(({ country }) => country);
  const byName = new Map(countries.map((country) => [country.country, country]));
  return {
    countries: [...ordered, "Others"],
    weeks: weeks.map((week) => {
      const counts = weeklyCountry.get(week) ?? new Map();
      const values = ordered.map((country) => counts.get(country) ?? 0);
      const shown = new Set(ordered.filter((_, index) => values[index]! > 0));
      const othersBreakdown = [...counts.entries()]
        .filter(([country]) => !shown.has(country))
        .map(([country, fatalities]) => ({
          country,
          m49: byName.get(country)?.m49 ?? countryM49(country),
          fatalities,
        }))
        .sort((a, b) => b.fatalities - a.fatalities);
      return {
        week,
        values: [...values, othersBreakdown.reduce((sum, item) => sum + item.fatalities, 0)],
        othersBreakdown,
      };
    }),
  };
}

interface RegionAccumulator {
  country: string;
  admin1: string;
  m49: number | null;
  fatalities: number;
  weightedLatitude: number;
  weightedLongitude: number;
}

function nearestCell(
  longitude: number,
  latitude: number,
  candidates: Array<[lon: number, lat: number]>,
  cellsize: number,
): [lon: number, lat: number] | null {
  let nearest: [number, number] | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const [lon, lat] of candidates) {
    const cellLon = lon + cellsize / 2;
    const cellLat = lat + cellsize / 2;
    const dx = (cellLon - longitude) * Math.cos(((cellLat + latitude) / 2) * (Math.PI / 180));
    const dy = cellLat - latitude;
    const distance = dx * dx + dy * dy;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = [lon, lat];
    }
  }
  return nearest;
}

export function buildSnapshot(
  workbooks: ParsedRegionalWorkbook[],
  cutoff: string,
  rateGrid: RateGridInput,
  generatedAt = new Date().toISOString(),
): ConflictsPayload {
  const start = addUtcDays(cutoff, -(ACLED_WINDOW_WEEKS - 1) * 7);
  const weeks = Array.from({ length: ACLED_WINDOW_WEEKS }, (_, index) =>
    addUtcDays(start, index * 7),
  );
  const allowedWeeks = new Set(weeks);
  const weeklyCountry = new Map<string, Map<string, number>>(
    weeks.map((week) => [week, new Map()]),
  );
  const countryTotals = new Map<string, number>();
  const regionTotals = new Map<string, RegionAccumulator>();

  for (const workbook of workbooks) {
    for (const row of workbook.rows) {
      if (!allowedWeeks.has(row.week) || row.fatalities <= 0) continue;
      const perCountry = weeklyCountry.get(row.week)!;
      perCountry.set(row.country, (perCountry.get(row.country) ?? 0) + row.fatalities);
      countryTotals.set(row.country, (countryTotals.get(row.country) ?? 0) + row.fatalities);
      const key = `${row.country}\u0000${row.admin1}`;
      const current = regionTotals.get(key) ?? {
        country: row.country,
        admin1: row.admin1,
        m49: countryM49(row.country),
        fatalities: 0,
        weightedLatitude: 0,
        weightedLongitude: 0,
      };
      current.fatalities += row.fatalities;
      current.weightedLatitude += row.latitude * row.fatalities;
      current.weightedLongitude += row.longitude * row.fatalities;
      regionTotals.set(key, current);
    }
  }

  const byCountry: ConflictCountry[] = [...countryTotals.entries()]
    .map(([country, fatalities]) => ({ country, m49: countryM49(country), fatalities }))
    .sort((a, b) => b.fatalities - a.fatalities);
  const totalFatalities = byCountry.reduce((sum, country) => sum + country.fatalities, 0);
  const totals = weeks.map((week) =>
    [...(weeklyCountry.get(week)?.values() ?? [])].reduce((sum, value) => sum + value, 0),
  );
  const model = robustEwma(totals, DEFAULT_HALF_LIFE_WEEKS, DEFAULT_CLAMP_PERCENTILE);
  const annualizedPrediction = model.prediction * (365 / 7);

  const gridByCountry = new Map<number, Array<[number, number]>>();
  for (const [lon, lat, m49, weight] of rateGrid.cells) {
    if (!(weight > 0)) continue;
    const cells = gridByCountry.get(m49) ?? [];
    cells.push([lon, lat]);
    gridByCountry.set(m49, cells);
  }

  const preliminary = [...regionTotals.values()].map((region) => ({
    ...region,
    latitude: region.weightedLatitude / region.fatalities,
    longitude: region.weightedLongitude / region.fatalities,
  }));
  const placedFatalities = preliminary.reduce(
    (sum, region) =>
      region.m49 != null && gridByCountry.has(region.m49) ? sum + region.fatalities : sum,
    0,
  );
  const cellWeights = new Map<string, number>();
  const regions: ConflictRegion[] = preliminary
    .map((region) => {
      const cell =
        region.m49 == null
          ? null
          : nearestCell(
              region.longitude,
              region.latitude,
              gridByCountry.get(region.m49) ?? [],
              rateGrid.cellsize,
            );
      const share = placedFatalities > 0 && cell ? region.fatalities / placedFatalities : 0;
      const annualizedFatalities = annualizedPrediction * share;
      if (cell && annualizedFatalities > 0) {
        const key = `${cell[0]},${cell[1]}`;
        cellWeights.set(key, (cellWeights.get(key) ?? 0) + annualizedFatalities);
      }
      return {
        country: region.country,
        admin1: region.admin1,
        m49: region.m49,
        latitude: region.latitude,
        longitude: region.longitude,
        fatalities: region.fatalities,
        share,
        annualizedFatalities,
        cell,
      };
    })
    .sort((a, b) => b.fatalities - a.fatalities);

  const cells: ConflictCell[] = [...cellWeights.entries()]
    .map(([key, annualizedFatalities]) => {
      const comma = key.indexOf(",");
      return [
        Number(key.slice(0, comma)),
        Number(key.slice(comma + 1)),
        annualizedFatalities,
      ] as ConflictCell;
    })
    .sort((a, b) => b[2] - a[2]);
  const unmappedCountries = byCountry.filter(
    (country) => country.m49 == null || !gridByCountry.has(country.m49),
  );

  return {
    schemaVersion: ACLED_SCHEMA_VERSION,
    source: "ACLED weekly aggregated data — https://acleddata.com",
    license: "ACLED Terms of Use — academic / non-commercial",
    granularity: "week",
    spatialPrecision: "admin1-centroid",
    window: { start, end: cutoff, weeks: ACLED_WINDOW_WEEKS },
    commonThrough: cutoff,
    generatedAt,
    totalFatalities,
    weeklyStack: buildWeeklyStack(weeks, weeklyCountry, byCountry),
    regions,
    byCountry,
    cells,
    ewma: {
      halfLifeWeeks: DEFAULT_HALF_LIFE_WEEKS,
      clampPercentile: DEFAULT_CLAMP_PERCENTILE,
      lower: model.lower,
      upper: model.upper,
      curve: model.curve,
      predictedWeekly: model.prediction,
      annualizedPrediction,
    },
    coverage: {
      regionalSources: workbooks.map((workbook) => ({
        region: workbook.region,
        latestThrough: workbook.latestThrough,
        rowsRead: workbook.rowsRead,
        rowsRetained: workbook.rowsRetained,
        invalidRows: workbook.invalidRows,
      })),
      unmappedCountries,
      droppedFatalities: Math.max(0, totalFatalities - placedFatalities),
      placedFatalities,
    },
  };
}

export function isCompleteSnapshot(value: unknown): value is ConflictsPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<ConflictsPayload>;
  return (
    payload.schemaVersion === ACLED_SCHEMA_VERSION &&
    payload.granularity === "week" &&
    payload.spatialPrecision === "admin1-centroid" &&
    payload.window?.weeks === ACLED_WINDOW_WEEKS &&
    Array.isArray(payload.weeklyStack?.weeks) &&
    payload.weeklyStack.weeks.length === ACLED_WINDOW_WEEKS &&
    Array.isArray(payload.coverage?.regionalSources) &&
    payload.coverage.regionalSources.length === 6 &&
    !payload.coverage.unmappedCountries.some((country) => countryM49(country.country) != null) &&
    Array.isArray(payload.regions) &&
    Array.isArray(payload.cells) &&
    typeof payload.generatedAt === "string"
  );
}
