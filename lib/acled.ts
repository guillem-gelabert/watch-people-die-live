import { readFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { politeFetch } from "./http";
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
  expires_in?: number;
}

// One token per process. `upstreamCutoff()` and `buildConflictsSnapshot()` used to authenticate
// independently, so a full rebuild bought two tokens it could have shared. The token outlives the
// build (ACLED issues them for 24h), so the expiry check is a formality rather than a real cache.
let cachedToken: { key: string; token: string; expiresAt: number } | null = null;

async function tokenFor(username: string, password: string): Promise<string> {
  const key = `${username}:${password}`;
  if (cachedToken && cachedToken.key === key && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }
  const response = await politeFetch(
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
    { timeoutMs: LANDING_TIMEOUT_MS, label: "ACLED OAuth" },
  );
  const json = (await response.json()) as OAuthTokenResponse;
  if (!json.access_token) throw new Error("ACLED OAuth response contained no access token");
  const ttlMs = (json.expires_in ?? 3600) * 1000;
  // Expire early, so a token is never used in the last minute of its life mid-download.
  cachedToken = { key, token: json.access_token, expiresAt: Date.now() + ttlMs - 60_000 };
  return json.access_token;
}

// Memoised for the same reason as the token: the cutoff check and the snapshot build both need the
// six landing pages, and they advertise a new workbook once a week. Fetching them twice in one
// build is twelve requests where six will do.
let discoveredPromise: Promise<AcledDiscoveredWorkbook[]> | null = null;

type AcledDiscoveredWorkbook = ReturnType<typeof discoverWorkbook>;

function discoverRegionalWorkbooks(token: string): Promise<AcledDiscoveredWorkbook[]> {
  if (!discoveredPromise) {
    // politeFetch serialises these six per host anyway; mapping them stays as-is so a failure
    // still rejects the whole set.
    discoveredPromise = Promise.all(
      ACLED_REGION_SOURCES.map(async (source) => {
        const response = await politeFetch(
          source.landingUrl,
          { headers: { Authorization: `Bearer ${token}`, Accept: "text/html" } },
          { timeoutMs: LANDING_TIMEOUT_MS, label: `ACLED ${source.label} landing page` },
        );
        return discoverWorkbook(await response.text(), source);
      }),
    ).catch((error: unknown) => {
      discoveredPromise = null;
      throw error;
    });
  }
  return discoveredPromise;
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
  workbook: AcledDiscoveredWorkbook,
  start: string,
  end: string,
) {
  const response = await politeFetch(
    workbook.workbookUrl,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    },
    { timeoutMs: WORKBOOK_TIMEOUT_MS, label: `ACLED ${workbook.label} workbook` },
  );
  if (!response.body) {
    throw new Error(`ACLED ${workbook.label} workbook returned no body`);
  }
  return parseRegionalWorkbook(
    Readable.fromWeb(response.body as never),
    workbook.label,
    workbook.latestThrough,
    start,
    end,
  );
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
