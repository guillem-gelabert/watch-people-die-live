// World Bank crude-death-rate + population lookup, ported from the old Express server.
// Response shape is unchanged: { indicator, year, source, values:[{id,iso3,name,value,year,population}] }.
// Caching moves from an in-memory Map to Next's fetch cache (next:{revalidate}) so it
// works the same on a long-lived Node process and survives across route invocations.

import fs from "node:fs";
import path from "node:path";
import isoCountries from "i18n-iso-countries";
import { politeFetch, politeFetchJson } from "./http";

const CDR_INDICATOR = "SP.DYN.CDRT.IN";
const POP_INDICATOR = "SP.POP.TOTL";
const WB_BASE = "https://api.worldbank.org/v2";
const CACHE_TTL_SECONDS = 24 * 60 * 60; // refresh ~daily
const REQUEST_TIMEOUT_MS = 20000;

// The User-Agent now comes from lib/http.ts, which sets it for every host.
const REQUEST_HEADERS = { Accept: "application/json" };

const ROOT = process.cwd();

export interface MortalityValue {
  id: number;
  iso3: string;
  name: string;
  value: number; // crude death rate (deaths per 1,000)
  year: number;
  population: number | null;
}

export interface MortalityPayload {
  indicator: string;
  year: number;
  source: "worldbank" | "sample";
  note?: string;
  values: MortalityValue[];
}

interface WorldBankRow {
  countryiso3code?: string;
  country?: { id: string; value: string };
  date: string;
  value: number | null;
}

interface WorldBankPageMeta {
  page: number;
  pages: number;
  per_page: number;
  total: number;
}

type WorldBankResponse = [WorldBankPageMeta, WorldBankRow[]];

interface IndexedRow {
  id: number;
  iso3: string;
  name: string;
  value: number;
  year: number;
}

interface SampleCdrFile {
  indicator: string;
  year: number;
  note: string;
  values: MortalityValue[];
}

let countryIdsPromise: Promise<Set<number>> | null = null;
function loadCountryIds(): Promise<Set<number>> {
  if (!countryIdsPromise) {
    countryIdsPromise = (async () => {
      try {
        const topo = JSON.parse(
          fs.readFileSync(
            path.join(ROOT, "node_modules", "world-atlas", "countries-110m.json"),
            "utf8",
          ),
        );
        return new Set<number>(
          topo.objects.countries.geometries.map((g: { id: string | number }) => Number(g.id)),
        );
      } catch (err) {
        console.error(
          "Could not read world-atlas TopoJSON:",
          err instanceof Error ? err.message : err,
        );
        return new Set<number>();
      }
    })();
  }
  return countryIdsPromise;
}

async function fetchJson<T>(url: string, { revalidate }: { revalidate?: number } = {}): Promise<T> {
  return politeFetchJson<T>(
    url,
    {
      headers: REQUEST_HEADERS,
      next: revalidate ? { revalidate } : undefined,
    } as RequestInit,
    { timeoutMs: REQUEST_TIMEOUT_MS, label: "World Bank API" },
  );
}

// Fetch the most recent non-empty value per economy for a World Bank indicator.
async function fetchIndicatorLatest(code: string): Promise<WorldBankRow[]> {
  const base = `${WB_BASE}/country/all/indicator/${code}?format=json&mrnev=1&per_page=400`;
  const first = await fetchJson<WorldBankResponse>(base, { revalidate: CACHE_TTL_SECONDS });
  if (!Array.isArray(first) || first.length < 2 || !Array.isArray(first[1])) {
    throw new Error(`Unexpected World Bank response shape for ${code}`);
  }
  const rows = [...first[1]];
  const pages = Number(first[0]?.pages) || 1;
  for (let p = 2; p <= pages; p++) {
    const pg = await fetchJson<WorldBankResponse>(`${base}&page=${p}`, {
      revalidate: CACHE_TTL_SECONDS,
    });
    if (Array.isArray(pg) && Array.isArray(pg[1])) rows.push(...pg[1]);
  }
  return rows;
}

// Index World Bank rows by numeric M49 id, keeping only real countries that exist in
// the map (drops aggregates/regions). Each entry: { id, iso3, name, value, year }.
async function indexByM49(rows: WorldBankRow[]): Promise<Map<number, IndexedRow>> {
  const countryIds = await loadCountryIds();
  const byId = new Map<number, IndexedRow>();
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

function sampleFallback(): MortalityPayload {
  const sample = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data", "sample-cdr.json"), "utf8"),
  ) as SampleCdrFile;
  return {
    indicator: sample.indicator,
    year: sample.year,
    source: "sample",
    note: sample.note,
    values: sample.values,
  };
}

export async function getMortality(): Promise<MortalityPayload> {
  try {
    const [cdrRows, popRows] = await Promise.all([
      fetchIndicatorLatest(CDR_INDICATOR),
      fetchIndicatorLatest(POP_INDICATOR),
    ]);
    const [cdr, pop] = await Promise.all([indexByM49(cdrRows), indexByM49(popRows)]);
    if (!cdr.size) throw new Error("World Bank returned no usable values");

    const values: MortalityValue[] = [...cdr.values()].map((v) => ({
      id: v.id,
      iso3: v.iso3,
      name: v.name,
      value: v.value, // crude death rate (deaths per 1,000)
      year: v.year,
      population: pop.get(v.id)?.value ?? null,
    }));

    return {
      indicator: "Crude Death Rate (deaths per 1,000 population)",
      year: Math.max(...values.map((v) => v.year)),
      source: "worldbank",
      values,
    };
  } catch (err) {
    console.error(
      "Live World Bank fetch failed, serving sample data:",
      err instanceof Error ? err.message : err,
    );
    return sampleFallback();
  }
}

export interface WorldBankProbe {
  url: string;
  elapsedMs: number;
  status?: number;
  statusText?: string;
  server?: string | null;
  contentType?: string | null;
  bodySnippet?: string;
  error?: string;
}

export async function probeWorldBank(): Promise<WorldBankProbe> {
  const url = `${WB_BASE}/country/all/indicator/${CDR_INDICATOR}?format=json&mrnev=1&per_page=2`;
  const started = Date.now();
  try {
    const r = await politeFetch(
      url,
      { headers: REQUEST_HEADERS },
      {
        timeoutMs: REQUEST_TIMEOUT_MS,
        // A probe reports what came back; a 500 here is the finding, not an error to retry.
        attempts: 1,
        acceptAnyStatus: true,
        label: "World Bank probe",
      },
    );
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
    return {
      url,
      elapsedMs: Date.now() - started,
      error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    };
  }
}
