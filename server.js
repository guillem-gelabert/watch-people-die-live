import express from "express";
import path from "node:path";
import fs from "node:fs";
import dns from "node:dns";
import { fileURLToPath } from "node:url";
import isoCountries from "i18n-iso-countries";

// Some cloud hosts (incl. Railway) have a broken IPv6 path to certain upstreams.
// Node's fetch resolves AAAA first by default, so a host that publishes IPv6 (e.g.
// api.worldbank.org) can hang until the request aborts. Prefer IPv4 to avoid that.
dns.setDefaultResultOrder("ipv4first");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
// World Bank indicators (open API, no token): crude death rate + total population.
// Absolute deaths/year = CDR * population / 1000, which drives the real blink rate.
const CDR_INDICATOR = "SP.DYN.CDRT.IN";
const POP_INDICATOR = "SP.POP.TOTL";
const WB_BASE = "https://api.worldbank.org/v2";
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
app.get("/vendor/three.module.js", (_req, res) =>
  res.sendFile(path.join(__dirname, "node_modules/three/build/three.module.js"))
);
app.get("/vendor/OrbitControls.js", (_req, res) =>
  res.sendFile(
    path.join(__dirname, "node_modules/three/examples/jsm/controls/OrbitControls.js")
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

const REQUEST_HEADERS = {
  Accept: "application/json",
  "User-Agent": "watch-people-die-live/1.0 (+https://github.com/guillem-gelabert/watch-people-die-live)",
};

// --- Small fetch helper with timeout + one retry (handles transient hangs) ---
async function fetchJson(url, attempt = 1) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: REQUEST_HEADERS, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } catch (err) {
    if (attempt < 2) return fetchJson(url, attempt + 1);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Fetch the most recent non-empty value per economy for a World Bank indicator.
// Response shape: [ {page, pages, per_page, total}, [ {countryiso3code, country:{value}, date, value}, ... ] ]
async function fetchIndicatorLatest(code) {
  const base = `${WB_BASE}/country/all/indicator/${code}?format=json&mrnev=1&per_page=400`;
  const first = await fetchJson(base);
  if (!Array.isArray(first) || first.length < 2 || !Array.isArray(first[1])) {
    throw new Error(`Unexpected World Bank response shape for ${code}`);
  }
  const rows = [...first[1]];
  const pages = Number(first[0]?.pages) || 1;
  for (let p = 2; p <= pages; p++) {
    const pg = await fetchJson(`${base}&page=${p}`);
    if (Array.isArray(pg) && Array.isArray(pg[1])) rows.push(...pg[1]);
  }
  return rows;
}

// Index World Bank rows by numeric M49 id, keeping only real countries that exist
// in the map (drops aggregates/regions like "World" or income groups). Each entry:
// { id, iso3, name, value, year }.
function indexByM49(rows) {
  const byId = new Map();
  for (const r of rows) {
    if (r.value === null || r.value === undefined) continue;
    const iso3 = r.countryiso3code || r.country?.id;
    if (!iso3) continue;
    const id = Number(isoCountries.alpha3ToNumeric(iso3));
    if (!id || !countryIds.has(id)) continue;
    const year = Number(r.date);
    const existing = byId.get(id);
    if (!existing || year > existing.year) {
      byId.set(id, { id, iso3, name: r.country?.value ?? iso3, value: r.value, year });
    }
  }
  return byId;
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
    const [cdrRows, popRows] = await Promise.all([
      fetchIndicatorLatest(CDR_INDICATOR),
      fetchIndicatorLatest(POP_INDICATOR),
    ]);
    const cdr = indexByM49(cdrRows);
    const pop = indexByM49(popRows);
    if (!cdr.size) throw new Error("World Bank returned no usable values");

    // Merge population in so the client can compute real deaths/year per country.
    const values = [...cdr.values()].map((v) => ({
      id: v.id,
      iso3: v.iso3,
      name: v.name,
      value: v.value, // crude death rate (deaths per 1,000)
      year: v.year,
      population: pop.get(v.id)?.value ?? null,
    }));

    const payload = {
      indicator: "Crude Death Rate (deaths per 1,000 population)",
      year: Math.max(...values.map((v) => v.year)),
      source: "worldbank",
      values,
    };
    cache = { payload, ts: Date.now() };
    return payload;
  } catch (err) {
    console.error("Live World Bank fetch failed, serving sample data:", err.message);
    const payload = sampleFallback();
    // Cache the fallback briefly so an unreachable host isn't hammered on every request.
    cache = { payload, ts: Date.now() };
    return payload;
  }
}

// Diagnostic endpoint: reports exactly what the live source returns.
async function probe(url) {
  const started = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    const r = await fetch(url, { headers: REQUEST_HEADERS, signal: ctrl.signal });
    clearTimeout(timer);
    const body = (await r.text()).slice(0, 600);
    return {
      url,
      elapsedMs: Date.now() - started,
      status: r.status,
      statusText: r.statusText,
      server: r.headers.get("server"),
      contentType: r.headers.get("content-type"),
      bodySnippet: body,
    };
  } catch (err) {
    return { url, elapsedMs: Date.now() - started, error: `${err.name}: ${err.message}` };
  }
}

app.get("/api/debug", async (_req, res) => {
  res.json({
    worldBank: await probe(
      `${WB_BASE}/country/all/indicator/${CDR_INDICATOR}?format=json&mrnev=1&per_page=2`
    ),
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
