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
// no-cache = the browser may keep a copy but must revalidate (via ETag) every load,
// so a new deploy shows up on the next refresh instead of serving a stale page/bundle.
app.use(
  express.static(path.join(__dirname, "public"), {
    setHeaders: (res) => res.setHeader("Cache-Control", "no-cache"),
  })
);
// Clean URL for the data & methodology page.
app.get("/methodology", (_req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(path.join(__dirname, "public/methodology.html"));
});
app.get("/vendor/d3.min.js", (_req, res) =>
  res.sendFile(path.join(__dirname, "node_modules/d3/dist/d3.min.js"))
);
app.get("/vendor/topojson-client.min.js", (_req, res) =>
  res.sendFile(
    path.join(__dirname, "node_modules/topojson-client/dist/topojson-client.min.js")
  )
);
// three.module.js re-exports from sibling ./three.core.js, so serve the whole build dir.
app.use("/vendor/three", express.static(path.join(__dirname, "node_modules/three/build")));
app.get("/vendor/OrbitControls.js", (_req, res) =>
  res.sendFile(
    path.join(__dirname, "node_modules/three/examples/jsm/controls/OrbitControls.js")
  )
);
app.get("/data/countries-110m.json", (_req, res) =>
  res.sendFile(path.join(__dirname, "node_modules/world-atlas/countries-110m.json"))
);
// Pre-built population-density grid (see scripts/build-density.mjs). Drives the
// sub-country, density-weighted death flicker on the client.
app.get("/data/density-grid.json", (_req, res) =>
  res.sendFile(path.join(__dirname, "data/density-grid.json"))
);
// Pre-built persona distributions: per-country age x sex deaths (UN WPP, see
// scripts/build-mortality.mjs) and cause-of-death by sex/age (IHME GBD, see
// scripts/build-causes.mjs), plus a small offline sample. Served as static JSON; the
// client (public/persona.js) fetches them once and falls back gracefully if absent.
for (const f of ["mortality-age-sex.json", "causes.json", "sample-personas.json"]) {
  app.get(`/data/${f}`, (_req, res) => res.sendFile(path.join(__dirname, "data", f)));
}

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

// --- Basic IP geolocation: lets the client center the globe on the viewer ---
// Best-effort and privacy-light: we look up the caller's approximate lat/lon via
// the free, no-key ip-api.com and return only coordinates + a place name. Nothing
// is stored beyond a short in-memory cache.
const GEO_TTL_MS = 60 * 60 * 1000;
const geoCache = new Map(); // ip -> { payload, ts }

function clientIp(req) {
  const xff = req.headers["x-forwarded-for"]; // set by Railway's proxy to the real client
  const ip = (xff ? xff.split(",")[0] : req.socket?.remoteAddress || "").trim();
  return ip.replace(/^::ffff:/, ""); // unwrap IPv4-mapped IPv6
}

function isPrivateIp(ip) {
  return (
    !ip ||
    ip === "::1" ||
    ip.startsWith("127.") ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

async function geolocate(ip) {
  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.ts < GEO_TTL_MS) return cached.payload;
  let payload = { lat: null, lon: null, name: null, source: "none" };
  try {
    // Omit the IP for local/private callers (dev) so ip-api uses the requester IP
    // it sees. ip-api free is HTTP-only, which is fine for a server-side call.
    const path = isPrivateIp(ip) ? "" : encodeURIComponent(ip);
    const data = await fetchJson(
      `http://ip-api.com/json/${path}?fields=status,lat,lon,country,city`
    );
    if (data && data.status === "success" && Number.isFinite(data.lat)) {
      payload = {
        lat: data.lat,
        lon: data.lon,
        name: data.city ? `${data.city}, ${data.country}` : data.country || null,
        source: "ip-api",
      };
    }
  } catch (err) {
    console.error("Geo lookup failed:", err.message);
  }
  geoCache.set(ip, { payload, ts: Date.now() });
  return payload;
}

app.get("/api/geo", async (req, res) => {
  res.json(await geolocate(clientIp(req)));
});

app.listen(PORT, () => {
  console.log(`watch-people-die-live listening on http://localhost:${PORT}`);
});
