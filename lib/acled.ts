// Runtime ACLED conflict-fatalities layer.
//
// OAuths to the ACLED API (password grant), pulls fatal political-violence events over a
// trailing window, and aggregates their fatalities onto the same 0.5° grid the globe samples
// (data/rate-grid.json). The globe folds these weights into its weighted sampler so active
// conflict zones fire faster than their peacetime death rate alone; roadmap Step 6 draws them.
//
// Cadence: the paginated ACLED reads use Next's fetch cache (next:{revalidate}) and the
// assembled payload is memoised per UTC day in this long-lived process, so the upstream pull
// happens at most once per day — no scheduler, no committed data. Secrets stay server-side.
// The route handler is dynamic-by-default (Next 15+), so this always runs at request time with
// the runtime service variables rather than freezing an empty snapshot at build time.
//
// Auth: ACLED moved to OAuth2 in 2025 (the old key+email scheme is gone). Set a myACLED
// account's ACLED_USERNAME / ACLED_PASSWORD. Missing creds or any upstream failure degrade to
// an empty-but-valid payload so the globe/roadmap simply skip the layer (never a 500).

const OAUTH_URL = "https://acleddata.com/oauth/token";
const READ_URL = "https://acleddata.com/api/acled/read";
const CLIENT_ID = "acled";

const SOURCE = "ACLED (Armed Conflict Location & Event Data) — https://acleddata.com";
const LICENSE = "ACLED Terms of Use — academic / non-commercial";

const CACHE_TTL_SECONDS = 24 * 60 * 60; // Next fetch-cache TTL per ACLED page (~daily)
const REQUEST_TIMEOUT_MS = 30000;
const PAGE_LIMIT = 5000; // ACLED default max rows per page
const MAX_PAGES = 60; // safety cap: 60 * 5000 = 300k fatal events over the window
const DEFAULT_WINDOW_DAYS = 365;

// Must match data/rate-grid.json's cellsize. The globe re-snaps with the grid's own cellsize
// when folding, so this only needs to be fine enough to aggregate the payload compactly.
const CELL_SIZE = 0.5;

export type ConflictCell = [lon: number, lat: number, annualizedFatalities: number];

export interface ConflictCountry {
  country: string;
  iso: number;
  fatalities: number;
}

export interface ConflictsPayload {
  source: string;
  license: string;
  window: { start: string; end: string; days: number };
  cellsize: number;
  generatedAt: string;
  totalFatalities: number; // raw sum over the window
  eventCount: number;
  cells: ConflictCell[]; // [lon, lat, fatalities annualised to deaths/year] — for the globe sampler
  byCountry: ConflictCountry[]; // raw window fatalities per country, descending — for Step 6
  note?: string;
}

interface AcledEventRow {
  latitude?: string | number;
  longitude?: string | number;
  fatalities?: string | number;
  country?: string;
  iso?: string | number;
  event_date?: string;
}

interface AcledReadResponse {
  success?: boolean;
  count?: number;
  message?: string;
  error?: unknown;
  data?: AcledEventRow[];
}

interface OAuthTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function windowDays(): number {
  const raw = Number(process.env.ACLED_WINDOW_DAYS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_WINDOW_DAYS;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Lower-left corner of the 0.5° cell a coordinate falls in — matches the grid's convention
// (the globe jitters +Math.random()*cellsize up from each stored corner).
function snap(v: number): number {
  return Math.floor(v / CELL_SIZE) * CELL_SIZE;
}

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await run(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function retry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts) await sleep(500 * i);
    }
  }
  throw lastErr;
}

async function getToken(username: string, password: string): Promise<string> {
  const body = new URLSearchParams({
    username,
    password,
    grant_type: "password",
    client_id: CLIENT_ID,
    scope: "authenticated",
  });
  const json = await retry(() =>
    withTimeout(async (signal) => {
      const res = await fetch(OAUTH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body,
        signal,
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`ACLED OAuth HTTP ${res.status}`);
      return (await res.json()) as OAuthTokenResponse;
    }),
  );
  if (!json.access_token) throw new Error("ACLED OAuth returned no access_token");
  return json.access_token;
}

async function fetchPage(
  token: string,
  params: URLSearchParams,
  page: number,
): Promise<AcledEventRow[]> {
  const url = `${READ_URL}?${params.toString()}&page=${page}`;
  const json = await retry(() =>
    withTimeout(async (signal) => {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal,
        next: { revalidate: CACHE_TTL_SECONDS },
      });
      if (!res.ok) throw new Error(`ACLED read HTTP ${res.status} (page ${page})`);
      return (await res.json()) as AcledReadResponse;
    }),
  );
  // Surface auth/quota errors (e.g. {"message":"Access denied"}) instead of silently
  // treating them as an empty result set.
  if (json.success === false || (json.message && !Array.isArray(json.data))) {
    throw new Error(
      `ACLED read error (page ${page}): ${json.message ?? JSON.stringify(json.error ?? json)}`,
    );
  }
  return Array.isArray(json.data) ? json.data : [];
}

function emptyPayload(start: string, end: string, days: number, note: string): ConflictsPayload {
  return {
    source: SOURCE,
    license: LICENSE,
    window: { start, end, days },
    cellsize: CELL_SIZE,
    generatedAt: new Date().toISOString(),
    totalFatalities: 0,
    eventCount: 0,
    cells: [],
    byCountry: [],
    note,
  };
}

async function buildConflicts(): Promise<ConflictsPayload> {
  const days = windowDays();
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - days);
  const start = isoDate(startDate);
  const end = isoDate(endDate);

  const username = process.env.ACLED_USERNAME;
  const password = process.env.ACLED_PASSWORD;
  if (!username || !password) {
    console.warn("ACLED_USERNAME/ACLED_PASSWORD not set — /api/conflicts serving an empty layer.");
    return emptyPayload(start, end, days, "ACLED credentials not configured");
  }

  const token = await getToken(username, password);
  const params = new URLSearchParams({
    _format: "json",
    fields: "latitude|longitude|fatalities|country|iso|event_date",
    event_date: `${start}|${end}`,
    event_date_where: "BETWEEN",
    fatalities: "0",
    fatalities_where: ">", // only events with at least one fatality
    limit: String(PAGE_LIMIT),
  });

  // Aggregate as we page so we never hold every raw row in memory.
  const cellFatalities = new Map<string, number>();
  const countryFatalities = new Map<string, { iso: number; fatalities: number }>();
  let totalFatalities = 0;
  let eventCount = 0;
  let truncated = false;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const rows = await fetchPage(token, params, page);
    if (!rows.length) break;
    for (const r of rows) {
      const f = Number(r.fatalities);
      if (!(f > 0)) continue;
      const lon = Number(r.longitude);
      const lat = Number(r.latitude);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      eventCount++;
      totalFatalities += f;
      const key = `${snap(lon)},${snap(lat)}`;
      cellFatalities.set(key, (cellFatalities.get(key) ?? 0) + f);
      const name = r.country ?? "Unknown";
      const prev = countryFatalities.get(name) ?? { iso: Number(r.iso) || 0, fatalities: 0 };
      prev.fatalities += f;
      countryFatalities.set(name, prev);
    }
    if (rows.length < PAGE_LIMIT) break;
    if (page === MAX_PAGES) truncated = true;
  }
  if (truncated) {
    console.warn(
      `ACLED: hit MAX_PAGES=${MAX_PAGES} cap after ${eventCount} events — window may be truncated.`,
    );
  }

  const annualize = 365 / days;
  const cells: ConflictCell[] = [];
  for (const [key, f] of cellFatalities) {
    const comma = key.indexOf(",");
    cells.push([Number(key.slice(0, comma)), Number(key.slice(comma + 1)), f * annualize]);
  }
  const byCountry: ConflictCountry[] = [...countryFatalities.entries()]
    .map(([country, v]) => ({ country, iso: v.iso, fatalities: v.fatalities }))
    .sort((a, b) => b.fatalities - a.fatalities);

  return {
    source: SOURCE,
    license: LICENSE,
    window: { start, end, days },
    cellsize: CELL_SIZE,
    generatedAt: new Date().toISOString(),
    totalFatalities,
    eventCount,
    cells,
    byCountry,
    ...(truncated ? { note: `truncated at MAX_PAGES=${MAX_PAGES}` } : {}),
  };
}

// Memoise per UTC day in this (long-lived) Node process so we page ACLED at most once/day.
let memo: { day: string; payload: ConflictsPayload } | null = null;

export async function getConflicts(): Promise<ConflictsPayload> {
  const today = isoDate(new Date());
  if (memo && memo.day === today) return memo.payload;
  try {
    const payload = await buildConflicts();
    memo = { day: today, payload };
    return payload;
  } catch (err) {
    console.error("ACLED conflict fetch failed:", err instanceof Error ? err.message : err);
    if (memo) return memo.payload; // serve the last good pull if we have one
    const days = windowDays();
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - days);
    return emptyPayload(isoDate(start), isoDate(end), days, "ACLED fetch failed");
  }
}
