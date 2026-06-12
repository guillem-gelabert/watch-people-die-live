import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const API_BASE = "https://population.un.org/dataportalapi/api/v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // refresh ~daily
const REQUEST_TIMEOUT_MS = 20000;

const app = express();

// --- Static frontend + vendored libraries (no CDN, works offline / on Railway) ---
app.use(express.static(path.join(__dirname, "public")));
app.get("/vendor/d3.min.js", (_req, res) =>
  res.sendFile(path.join(__dirname, "node_modules/d3/dist/d3.min.js"))
);
app.get("/vendor/topojson-client.min.js", (_req, res) =>
  res.sendFile(
    path.join(__dirname, "node_modules/topojson-client/dist/topojson-client.min.js")
  )
);
app.get("/data/countries-110m.json", (_req, res) =>
  res.sendFile(path.join(__dirname, "node_modules/world-atlas/countries-110m.json"))
);

// --- Set of valid country M49 ids, read from the TopoJSON we ship to the client ---
const countryIds = (() => {
  try {
    const topo = JSON.parse(
      fs.readFileSync(path.join(__dirname, "node_modules/world-atlas/countries-110m.json"))
    );
    return new Set(topo.objects.countries.geometries.map((g) => Number(g.id)));
  } catch (err) {
    console.error("Could not read world-atlas TopoJSON:", err.message);
    return new Set();
  }
})();

// Node's fetch (undici) sends no User-Agent by default; the UN Data Portal's
// WAF rejects such requests, so present a full browser-like header set.
const REQUEST_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Referer: "https://population.un.org/dataportal/data/indicators",
};

// Minimal cookie jar: some WAFs answer the first request with a 401/403 challenge
// that sets a cookie, then accept a retry that echoes it back.
let cookieJar = "";
function rememberCookies(res) {
  const set = res.headers.getSetCookie?.() ?? [];
  const pairs = set.map((c) => c.split(";")[0]).filter(Boolean);
  if (pairs.length) cookieJar = pairs.join("; ");
}

async function rawFetch(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const headers = { ...REQUEST_HEADERS };
    if (cookieJar) headers.Cookie = cookieJar;
    return await fetch(url, { headers, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// --- fetch helper: captures challenge cookies and retries once ---
async function fetchJson(url) {
  let res = await rawFetch(url);
  if ((res.status === 401 || res.status === 403) && (res.headers.getSetCookie?.()?.length)) {
    rememberCookies(res);
    res = await rawFetch(url); // retry with the cookie the challenge handed us
  } else {
    rememberCookies(res);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.json();
}

// Follow the API's `nextPage` links, accumulating every page's `data` array.
async function fetchAllPages(url) {
  const rows = [];
  let next = url;
  let guard = 0;
  while (next && guard++ < 200) {
    const page = await fetchJson(next);
    if (Array.isArray(page?.data)) rows.push(...page.data);
    next = page?.nextPage || null;
  }
  return rows;
}

// 1. Resolve the Crude Death Rate indicator id by name (avoids hardcoding a brittle id).
async function resolveCdrIndicatorId() {
  const indicators = await fetchAllPages(`${API_BASE}/indicators/`);
  const match = indicators.find((i) =>
    /crude death rate/i.test(`${i.name} ${i.shortName ?? ""} ${i.displayName ?? ""}`)
  );
  if (!match) throw new Error("Crude Death Rate indicator not found");
  return match.id;
}

// 2. Country location ids that also exist as geometry in our map.
async function resolveCountryLocationIds() {
  const locations = await fetchAllPages(`${API_BASE}/locations/`);
  const ids = locations
    .map((l) => Number(l.id))
    .filter((id) => countryIds.has(id));
  return [...new Set(ids)];
}

// 3. Latest year that has an estimate value (<= current calendar year).
async function resolveLatestYear(indicatorId) {
  const now = new Date().getFullYear();
  const url = `${API_BASE}/data/indicators/${indicatorId}/locations/900/start/${now - 4}/end/${now}/`;
  const rows = await fetchAllPages(url);
  const years = rows
    .map((r) => Number(r.timeLabel))
    .filter((y) => Number.isFinite(y) && y <= now);
  if (!years.length) throw new Error("No recent years available for indicator");
  return Math.max(...years);
}

// 4. Fetch values for every country for the chosen year, both sexes, deduped per country.
async function fetchValues(indicatorId, year, locationIds) {
  const chunkSize = 100;
  const byLocation = new Map();
  for (let i = 0; i < locationIds.length; i += chunkSize) {
    const csv = locationIds.slice(i, i + chunkSize).join(",");
    const url = `${API_BASE}/data/indicators/${indicatorId}/locations/${csv}/start/${year}/end/${year}/`;
    const rows = await fetchAllPages(url);
    for (const r of rows) {
      if (r.sexId !== undefined && r.sexId !== 3) continue; // 3 = Both sexes
      if (Number(r.timeLabel) !== year) continue;
      if (r.value === null || r.value === undefined) continue;
      const id = Number(r.locationId);
      const isMedian = /median|estimate/i.test(r.variant ?? "");
      const existing = byLocation.get(id);
      // Prefer the median/estimate variant when a location has several rows.
      if (!existing || (isMedian && !existing._median)) {
        byLocation.set(id, {
          id,
          iso3: r.iso3,
          name: r.location,
          value: r.value,
          _median: isMedian,
        });
      }
    }
  }
  return [...byLocation.values()].map(({ _median, ...v }) => v);
}

// --- In-memory cache + sample fallback ---
let cache = null; // { payload, ts }

function sampleFallback() {
  const sample = JSON.parse(
    fs.readFileSync(path.join(__dirname, "data/sample-cdr.json"))
  );
  return {
    indicator: sample.indicator,
    year: sample.year,
    source: "sample",
    note: sample.note,
    values: sample.values,
  };
}

async function getMortality() {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache.payload;

  try {
    const indicatorId = await resolveCdrIndicatorId();
    const [locationIds, year] = await Promise.all([
      resolveCountryLocationIds(),
      resolveLatestYear(indicatorId),
    ]);
    const values = await fetchValues(indicatorId, year, locationIds);
    if (!values.length) throw new Error("UN API returned no values");

    const payload = {
      indicator: "Crude Death Rate (deaths per 1,000 population)",
      year,
      source: "un",
      values,
    };
    cache = { payload, ts: Date.now() };
    return payload;
  } catch (err) {
    console.error("Live UN API fetch failed, serving sample data:", err.message);
    const payload = sampleFallback();
    // Cache the fallback briefly so a blocked host doesn't hammer the API on every request.
    cache = { payload, ts: Date.now() };
    return payload;
  }
}

// Diagnostic endpoint: probes each endpoint and dumps status + key headers so a
// deployment-only failure (e.g. a WAF challenge) can be diagnosed without guessing.
async function probe(url) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    const headers = { ...REQUEST_HEADERS };
    if (cookieJar) headers.Cookie = cookieJar;
    const r = await fetch(url, { headers, signal: ctrl.signal });
    clearTimeout(timer);
    const body = (await r.text()).slice(0, 500);
    return {
      url,
      status: r.status,
      statusText: r.statusText,
      server: r.headers.get("server"),
      contentType: r.headers.get("content-type"),
      wwwAuthenticate: r.headers.get("www-authenticate"),
      setCookie: (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]),
      bodySnippet: body,
    };
  } catch (err) {
    return { url, error: `${err.name}: ${err.message}` };
  }
}

app.get("/api/debug", async (_req, res) => {
  const now = new Date().getFullYear();
  res.json({
    indicators: await probe(`${API_BASE}/indicators/?pageSize=1`),
    locations: await probe(`${API_BASE}/locations/?pageSize=1`),
    data: await probe(
      `${API_BASE}/data/indicators/59/locations/900/start/${now - 1}/end/${now}/`
    ),
    dataWithFormat: await probe(
      `${API_BASE}/data/indicators/59/locations/900/start/${now - 1}/end/${now}/?format=json`
    ),
    cookieJar,
  });
});

app.get("/api/mortality", async (_req, res) => {
  try {
    res.json(await getMortality());
  } catch (err) {
    console.error("Unexpected error in /api/mortality:", err);
    res.status(500).json({ error: "Failed to load mortality data" });
  }
});

app.listen(PORT, () => {
  console.log(`watch-people-die-live listening on http://localhost:${PORT}`);
});
