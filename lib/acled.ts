import { readFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { SnapshotManager, type SnapshotResult } from "./acled-cache";
import {
  ACLED_SCHEMA_VERSION,
  ACLED_WINDOW_WEEKS,
  addUtcDays,
  buildSnapshot,
  commonCutoff,
  discoverWorkbook,
  isCompleteSnapshot,
  parseRegionalWorkbook,
  type AcledRegionSource,
  type ConflictsPayload,
  type RateGridInput,
} from "./acled-weekly";

export type {
  AcledRegionalCoverage,
  ConflictCell,
  ConflictCountry,
  ConflictFreshnessStatus,
  ConflictRegion,
  ConflictsPayload,
  ConflictWeeklyStack,
} from "./acled-weekly";

const OAUTH_URL = "https://acleddata.com/oauth/token";
const CLIENT_ID = "acled";
const LANDING_TIMEOUT_MS = 30_000;
const WORKBOOK_TIMEOUT_MS = 180_000;

export const ACLED_REGION_SOURCES: AcledRegionSource[] = [
  {
    id: "africa",
    label: "Africa",
    landingUrl: "https://acleddata.com/aggregated/aggregated-data-africa",
  },
  {
    id: "asia-pacific",
    label: "Asia Pacific",
    landingUrl: "https://acleddata.com/aggregated/aggregated-data-asia-pacific",
  },
  {
    id: "europe-central-asia",
    label: "Europe and Central Asia",
    landingUrl: "https://acleddata.com/aggregated/aggregated-data-europe-and-central-asia",
  },
  {
    id: "latin-america-caribbean",
    label: "Latin America and the Caribbean",
    landingUrl: "https://acleddata.com/aggregated/aggregated-data-latin-america-caribbean",
  },
  {
    id: "middle-east",
    label: "Middle East",
    landingUrl: "https://acleddata.com/aggregated/aggregated-data-middle-east",
  },
  {
    id: "us-canada",
    label: "United States and Canada",
    landingUrl: "https://acleddata.com/aggregated/aggregated-data-united-states-canada",
  },
];

interface OAuthTokenResponse {
  access_token?: string;
}

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function retry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(attempt * 500);
    }
  }
  throw lastError;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeout);
  }
}

async function tokenFor(username: string, password: string): Promise<string> {
  const response = await retry(() =>
    fetchWithTimeout(
      OAUTH_URL,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          username,
          password,
          grant_type: "password",
          client_id: CLIENT_ID,
          scope: "authenticated",
        }),
      },
      LANDING_TIMEOUT_MS,
    ),
  );
  if (!response.ok) throw new Error(`ACLED OAuth returned HTTP ${response.status}`);
  const json = (await response.json()) as OAuthTokenResponse;
  if (!json.access_token) throw new Error("ACLED OAuth response contained no access token");
  return json.access_token;
}

async function discoverRegionalWorkbooks(token: string) {
  return Promise.all(
    ACLED_REGION_SOURCES.map(async (source) => {
      const response = await retry(() =>
        fetchWithTimeout(
          source.landingUrl,
          { headers: { Authorization: `Bearer ${token}`, Accept: "text/html" } },
          LANDING_TIMEOUT_MS,
        ),
      );
      if (!response.ok) {
        throw new Error(`ACLED ${source.label} landing page returned HTTP ${response.status}`);
      }
      return discoverWorkbook(await response.text(), source);
    }),
  );
}

let rateGridPromise: Promise<RateGridInput> | null = null;

function loadRateGrid(): Promise<RateGridInput> {
  if (!rateGridPromise) {
    rateGridPromise = readFile(path.join(process.cwd(), "data", "rate-grid.json"), "utf8").then(
      (text) => {
        const value = JSON.parse(text) as Partial<RateGridInput>;
        if (!(Number(value.cellsize) > 0) || !Array.isArray(value.cells)) {
          throw new Error("rate-grid.json has an invalid shape");
        }
        return value as RateGridInput;
      },
    );
  }
  return rateGridPromise;
}

async function fetchRegionalWorkbook(
  token: string,
  workbook: Awaited<ReturnType<typeof discoverRegionalWorkbooks>>[number],
  start: string,
  end: string,
) {
  return retry(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WORKBOOK_TIMEOUT_MS);
    try {
      const response = await fetch(workbook.workbookUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok || !response.body) {
        throw new Error(`ACLED ${workbook.label} workbook returned HTTP ${response.status}`);
      }
      return await parseRegionalWorkbook(
        Readable.fromWeb(response.body as never),
        workbook.label,
        workbook.latestThrough,
        start,
        end,
      );
    } finally {
      clearTimeout(timeout);
    }
  });
}

// The cutoff the six landing pages currently advertise, without downloading a single workbook.
// Six small HTML fetches, where a full build is six workbooks and Africa's sheet alone expands
// past 100 MB — so `scripts/build-conflicts.ts` asks this first and skips the download entirely
// when the committed snapshot already covers the same week. ACLED publishes weekly; Railway
// builds on every push.
export async function upstreamCutoff(): Promise<string> {
  const username = process.env.ACLED_USERNAME?.trim();
  const password = process.env.ACLED_PASSWORD;
  if (!username || !password) throw new Error("ACLED credentials are not configured");
  const discovered = await discoverRegionalWorkbooks(await tokenFor(username, password));
  if (discovered.length !== ACLED_REGION_SOURCES.length) {
    throw new Error("Not all ACLED regional workbooks were discovered");
  }
  return commonCutoff(discovered);
}

export async function buildConflictsSnapshot(): Promise<ConflictsPayload> {
  const username = process.env.ACLED_USERNAME?.trim();
  const password = process.env.ACLED_PASSWORD;
  if (!username || !password) throw new Error("ACLED credentials are not configured");

  const token = await tokenFor(username, password);
  const discovered = await discoverRegionalWorkbooks(token);
  if (discovered.length !== ACLED_REGION_SOURCES.length) {
    throw new Error("Not all ACLED regional workbooks were discovered");
  }
  const cutoff = commonCutoff(discovered);
  const start = addUtcDays(cutoff, -(ACLED_WINDOW_WEEKS - 1) * 7);
  const parsed = [];
  // Workbooks are deliberately processed one at a time. Africa's sheet alone expands beyond
  // 100 MB, so parallel readers would defeat the streaming reader's bounded-memory benefit.
  for (const workbook of discovered) {
    parsed.push(await fetchRegionalWorkbook(token, workbook, start, cutoff));
  }
  if (parsed.length !== ACLED_REGION_SOURCES.length) {
    throw new Error("ACLED refresh did not complete all six regions");
  }
  return buildSnapshot(parsed, cutoff, await loadRateGrid());
}

function lastCompleteSaturday(): string {
  const date = new Date();
  const daysSinceSaturday = (date.getUTCDay() + 1) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceSaturday);
  return date.toISOString().slice(0, 10);
}

function emptyPayload(note: string): ConflictsPayload {
  const end = lastCompleteSaturday();
  const start = addUtcDays(end, -(ACLED_WINDOW_WEEKS - 1) * 7);
  const weeks = Array.from({ length: ACLED_WINDOW_WEEKS }, (_, index) => ({
    week: addUtcDays(start, index * 7),
    values: [0],
    othersBreakdown: [],
  }));
  return {
    schemaVersion: ACLED_SCHEMA_VERSION,
    source: "ACLED weekly aggregated data — https://acleddata.com",
    license: "ACLED Terms of Use — academic / non-commercial",
    granularity: "week",
    spatialPrecision: "admin1-centroid",
    window: { start, end, weeks: ACLED_WINDOW_WEEKS },
    commonThrough: end,
    generatedAt: new Date().toISOString(),
    totalFatalities: 0,
    weeklyStack: { countries: ["Others"], weeks },
    regions: [],
    byCountry: [],
    cells: [],
    ewma: {
      halfLifeWeeks: 4,
      clampPercentile: 10,
      lower: 0,
      upper: 0,
      curve: [],
      predictedWeekly: 0,
      annualizedPrediction: 0,
    },
    coverage: {
      regionalSources: [],
      unmappedCountries: [],
      droppedFatalities: 0,
      placedFatalities: 0,
    },
    freshness: { status: "unavailable", ageHours: null, refreshedAt: null },
    note,
  };
}

function configuredCacheFile(): string | null {
  const value = process.env.ACLED_WEEKLY_CACHE_FILE?.trim();
  return value || null;
}

let manager: SnapshotManager | null = null;

function snapshotManager(): SnapshotManager {
  if (!manager) {
    manager = new SnapshotManager({
      cacheFile: configuredCacheFile(),
      build: buildConflictsSnapshot,
      validate: isCompleteSnapshot,
      empty: emptyPayload,
    });
  }
  return manager;
}

export function getConflicts(): Promise<SnapshotResult> {
  return snapshotManager().get();
}

export async function refreshConflicts(): Promise<void> {
  try {
    await snapshotManager().refresh();
  } catch (error) {
    console.error(
      "ACLED weekly refresh failed; retaining the last complete snapshot:",
      error instanceof Error ? error.message : "unknown error",
    );
  }
}
