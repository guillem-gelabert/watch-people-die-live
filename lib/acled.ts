import { readFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import {
  ACLED_WINDOW_WEEKS,
  addUtcDays,
  buildSnapshot,
  commonCutoff,
  discoverWorkbook,
  parseRegionalWorkbook,
  type AcledRegionSource,
  type ConflictsPayload,
  type RateGridInput,
} from "./acled-weekly";

export type {
  AcledRegionalCoverage,
  ConflictCell,
  ConflictCountry,
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
