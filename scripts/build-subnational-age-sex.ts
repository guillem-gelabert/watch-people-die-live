// Fold IHME GBD 2023 subnational deaths into per-region age x sex weights, keyed to the
// admin-1 / NUTS-2 identity data/subnational-cdr.json and data/region-keys.json already use.
//
// Input: one GBD Results export (Deaths, Number, All causes, 2023, male+female, the 22
// disjoint age groups, 204 countries plus 519 subnational units = 31,812 rows), plus the two
// open GBD metadata endpoints cached beside it so this build is reproducible offline:
//
//   data/source/gbd-subnational-age-sex/IHME-GBD_2023_DATA-*.csv   (gitignored)
//   data/source/gbd-subnational-age-sex/gbd-metadata.json          location id -> name
//   data/source/gbd-subnational-age-sex/gbd-hierarchy.json         parent/child tree
//
// Output: data/subnational-age-sex.json — NORMALISED WEIGHTS, never raw counts. IHME's
// non-commercial agreement forbids giving third parties the ability to download IHME data
// sets from our own hosting; a derived per-region distribution is the permitted shape, a
// re-hosted cube is not. The raw export stays inside gitignored data/source/.
//
// These are modelled estimates, not registrations. Every row carries
// measurement: "gbd-modeled" so a consumer can exclude them from validation statistics, the
// same way seasonality-subnational.json marks its India and China rows "climate-modeled".
//
// Usage: node --import tsx scripts/build-subnational-age-sex.ts

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SRC_DIR = path.join(ROOT, "data", "source", "gbd-subnational-age-sex");
const OUT = path.join(ROOT, "data", "subnational-age-sex.json");

const ATTRIBUTION =
  "Source: Institute for Health Metrics and Evaluation. Used with permission. All rights reserved.";
const CITATION =
  "Global Burden of Disease Collaborative Network. Global Burden of Disease Study 2023 " +
  "(GBD 2023) Results. Seattle, United States: Institute for Health Metrics and Evaluation " +
  "(IHME), 2024. Available from https://vizhub.healthdata.org/gbd-results/.";

// MUST match BANDS in build-causes.ts and build-mortality.ts, AGE_BANDS in app/globe/persona.ts,
// and BANDS in pipeline/age_bands.py.
const BANDS: [number, number][] = [
  [0, 0],
  [1, 4],
  [5, 14],
  [15, 29],
  [30, 49],
  [50, 64],
  [65, 74],
  [75, 84],
  [85, 200],
];

// GBD age_group_id -> band index. These 22 ids are the disjoint set; every one of them falls
// wholly inside a single band, so this is a lookup and never an apportioning.
//
// GBD's own `type` field cannot select this set in either direction: <1 year (28) and 95+ (235)
// are typed "aggregate" and are wanted, while 80+ (21), 85+ (160), 20+ (37) and 10-19 (162) are
// typed "specific" and are not. Note GBD 2023 has no `1-4 years` group at all — below five the
// disjoint set is <1 year + 12-23 months + 2-4 years.
const AGE_BAND = new Map<number, number>([
  [28, 0], // <1 year
  [238, 1], // 12-23 months
  [34, 1], // 2-4 years
  [6, 2], // 5-9
  [7, 2], // 10-14
  [8, 3], // 15-19
  [9, 3], // 20-24
  [10, 3], // 25-29
  [11, 4], // 30-34
  [12, 4], // 35-39
  [13, 4], // 40-44
  [14, 4], // 45-49
  [15, 5], // 50-54
  [16, 5], // 55-59
  [17, 5], // 60-64
  [18, 6], // 65-69
  [19, 6], // 70-74
  [20, 7], // 75-79
  [30, 7], // 80-84
  [31, 8], // 85-89
  [32, 8], // 90-94
  [235, 8], // 95+
]);

const SEX = new Map<number, "m" | "f">([
  [1, "m"],
  [2, "f"],
]);

// GBD parent-country name -> ISO3, for the Natural Earth join.
const COUNTRY_ISO3: Record<string, string> = {
  Brazil: "BRA",
  Ethiopia: "ETH",
  India: "IND",
  Indonesia: "IDN",
  "Iran (Islamic Republic of)": "IRN",
  Italy: "ITA",
  Japan: "JPN",
  Kenya: "KEN",
  Mexico: "MEX",
  Nigeria: "NGA",
  Norway: "NOR",
  Pakistan: "PAK",
  Philippines: "PHL",
  Poland: "POL",
  "South Africa": "ZAF",
  "United Kingdom": "GBR",
  "United States of America": "USA",
};

// Countries joined to the committed NUTS-2 layer rather than Natural Earth admin-1, because
// that is the layer whose level actually matches what GBD publishes for them. Italy's 21 GBD
// regions are its 21 NUTS-2 regions; Natural Earth carries 110 Italian provinces instead.
const NUTS_COUNTRY: Record<string, string> = {
  Italy: "IT",
  Poland: "PL",
  "United Kingdom": "UK",
};

// The UK is the one roll-DOWN in here. GBD publishes 12 NUTS-1-level regions; the committed
// layer is NUTS-2. Each GBD region maps to a NUTS-1 code, and its distribution is broadcast to
// every NUTS-2 child of that code. Broadcasting is sound precisely because the output is a
// normalised distribution and not a count: every NUTS-2 region inside Greater London gets
// London's age/sex shape, which is a far better estimate than the national one, and no deaths
// are duplicated because no deaths are emitted.
const UK_NUTS1: Record<string, string> = {
  "East Midlands": "UKF",
  "East of England": "UKH",
  "Greater London": "UKI",
  "North East England": "UKC",
  "North West England": "UKD",
  "South East England": "UKJ",
  "South West England": "UKK",
  "West Midlands": "UKG",
  "Yorkshire and the Humber": "UKE",
  Scotland: "UKM",
  Wales: "UKL",
  "Northern Ireland": "UKN",
};

// Poland's Mazowieckie is one GBD region and two NUTS-2 regions (Warsaw split off in 2018), so
// it broadcasts the same way the UK regions do.
const PL_SPLIT: Record<string, string[]> = {
  Mazowieckie: ["PL91", "PL92"],
};

// GBD name -> committed-layer name, where the two disagree. Every entry is a spelling or
// language difference for the same place, not a judgement call: Eurostat-style English against
// Natural Earth's local naming (West Java / Jawa Barat), or transliteration (Isfahan / Esfahan).
const ALIAS: Record<string, Record<string, string>> = {
  ETH: {
    "Benishangul-Gumuz": "Benshangul-Gumaz",
    Gambella: "Gambela Peoples",
    Harari: "Harari People",
    Oromia: "Oromiya",
  },
  IDN: {
    "Bangka-Belitung Islands": "Bangka-Belitung",
    Jakarta: "Jakarta Raya",
    "West Java": "Jawa Barat",
    "Central Java": "Jawa Tengah",
    "East Java": "Jawa Timur",
    "West Kalimantan": "Kalimantan Barat",
    "South Kalimantan": "Kalimantan Selatan",
    "Central Kalimantan": "Kalimantan Tengah",
    "East Kalimantan": "Kalimantan Timur",
    "Riau Islands": "Kepulauan Riau",
    "North Maluku": "Maluku Utara",
    "West Nusa Tenggara": "Nusa Tenggara Barat",
    "East Nusa Tenggara": "Nusa Tenggara Timur",
    "West Papua": "Papua Barat",
    "West Sulawesi": "Sulawesi Barat",
    "South Sulawesi": "Sulawesi Selatan",
    "Central Sulawesi": "Sulawesi Tengah",
    "Southeast Sulawesi": "Sulawesi Tenggara",
    "North Sulawesi": "Sulawesi Utara",
    "West Sumatra": "Sumatera Barat",
    "South Sumatra": "Sumatera Selatan",
    "North Sumatra": "Sumatera Utara",
  },
  IND: { "Jammu & Kashmir and Ladakh": "Jammu and Kashmir" },
  IRN: {
    "Chahar Mahaal and Bakhtiari": "Chahar Mahall and Bakhtiari",
    "East Azarbayejan": "East Azarbaijan",
    Isfahan: "Esfahan",
    "Khorasan-e-Razavi": "Razavi Khorasan",
    "Kohgiluyeh and Boyer-Ahmad": "Kohgiluyeh and Buyer Ahmad",
    Kurdistan: "Kordestan",
    "Sistan and Baluchistan": "Sistan and Baluchestan",
    "West Azarbayejan": "West Azarbaijan",
  },
  MEX: {
    "Mexico City": "Distrito Federal",
    "Michoacán de Ocampo": "Michoacán",
    "Veracruz de Ignacio de la Llave": "Veracruz",
  },
  NGA: { "FCT (Abuja)": "Federal Capital Territory", Nasarawa: "Nassarawa" },
  PAK: {
    "Azad Jammu & Kashmir": "Azad Kashmir",
    Balochistan: "Baluchistan",
    "Gilgit-Baltistan": "Northern Areas",
    "Islamabad Capital Territory": "F.C.T.",
    "Khyber Pakhtunkhwa": "K.P.",
    Sindh: "Sind",
  },
  PHL: {
    "Cotabato (North Cotabato)": "Cotabato",
    "Davao de Oro": "Compostela Valley",
    "Occidental Mindoro": "Mindoro Occidental",
    "Oriental Mindoro": "Mindoro Oriental",
    "Samar (Western Samar)": "Samar",
    "National Capital Region": "Manila",
  },
  ITA: {
    "Valle d'Aosta": "Valle d’Aosta/Vallée d’Aoste",
    "Provincia autonoma di Bolzano": "Provincia Autonoma di Bolzano/Bozen",
    "Provincia autonoma di Trento": "Provincia Autonoma di Trento",
  },
};

// Explicitly skipped, with the reason. Nothing is dropped silently: the output records every
// one of these with its forgone share of subnational deaths.
const SKIP_COUNTRY: Record<string, string> = {
  Kenya: "GBD publishes 47 counties; Natural Earth carries 8 pre-2013 provinces",
  Norway: "GBD uses post-2020 counties; both committed layers predate the reorganisation",
};

const SKIP_UNIT: Record<string, string> = {
  Sidama: "carved out of SNNPR in 2020, after the Natural Earth vintage",
  "South West": "carved out of SNNPR in 2021, after the Natural Earth vintage",
  "North Kalimantan": "created in 2012, absent from the Natural Earth vintage",
  "Other Union Territories": "a GBD aggregate of several territories, not one region",
  "Davao Occidental": "created in 2013, absent from the Natural Earth vintage",
  "Dinagat Islands": "absent from the Natural Earth vintage",
};

// Natural Earth spells several names with characters NFKD does not decompose, so they need
// explicit transliteration or Poland matches one region out of sixteen.
const TRANSLITERATE: Record<string, string> = {
  ł: "l",
  Ł: "L",
  ø: "o",
  Ø: "O",
  æ: "ae",
  đ: "d",
  ð: "d",
  þ: "th",
  ß: "ss",
};

function norm(s: string): string {
  const t = [...s].map((c) => TRANSLITERATE[c] ?? c).join("");
  return t
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

type Row = { location: number; sex: number; age: number; val: number };

function readExport(): Row[] {
  const csvs = fs
    .readdirSync(SRC_DIR)
    .filter((f) => f.endsWith(".csv"))
    .map((f) => path.join(SRC_DIR, f));
  if (csvs.length !== 1) {
    throw new Error(
      `expected exactly one CSV in ${SRC_DIR}, found ${csvs.length}. ` +
        "The build must not guess which export to use.",
    );
  }
  const text = fs.readFileSync(csvs[0] as string, "utf8");
  const lines = text.split("\n").filter((l) => l.trim());
  const header = (lines[0] ?? "").split(",");
  const col = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`export is missing the '${name}' column`);
    return i;
  };
  const [iLoc, iSex, iAge, iVal] = [col("location"), col("sex"), col("age"), col("val")];
  const iMeasure = col("measure");
  const iMetric = col("metric");
  const iCause = col("cause");
  const iYear = col("year");

  const rows: Row[] = [];
  const years = new Set<string>();
  for (const line of lines.slice(1)) {
    const f = line.split(",");
    // Deaths (1) as a Number (1) for All causes (294). Anything else means the wrong export
    // was downloaded, and silently folding it would produce a plausible-looking wrong answer.
    if (f[iMeasure] !== "1" || f[iMetric] !== "1" || f[iCause] !== "294") {
      throw new Error(
        "export contains rows that are not Deaths/Number/All causes — see gbd-export-spec.md",
      );
    }
    years.add(f[iYear] ?? "");
    rows.push({
      location: Number(f[iLoc]),
      sex: Number(f[iSex]),
      age: Number(f[iAge]),
      val: Number(f[iVal]),
    });
  }
  if (years.size !== 1) {
    throw new Error(`export spans ${years.size} years; it must be exactly one`);
  }
  return rows;
}

type LocInfo = { name: string; depth: number; parent: number | null; leaf: boolean };

function readHierarchy(): Map<number, LocInfo> {
  const meta = JSON.parse(fs.readFileSync(path.join(SRC_DIR, "gbd-metadata.json"), "utf8"));
  const hier = JSON.parse(fs.readFileSync(path.join(SRC_DIR, "gbd-hierarchy.json"), "utf8"));
  const names = new Map<number, string>();
  for (const v of Object.values(meta.data.location) as { id?: number; name?: string }[]) {
    if (typeof v.id === "number" && v.name) names.set(v.id, v.name);
  }
  const out = new Map<number, LocInfo>();
  const walk = (
    nodes: { id: number; children?: unknown[] }[],
    depth: number,
    parent: number | null,
  ) => {
    for (const n of nodes) {
      const children = (n.children ?? []) as { id: number; children?: unknown[] }[];
      out.set(n.id, {
        name: names.get(n.id) ?? String(n.id),
        depth,
        parent,
        leaf: children.length === 0,
      });
      walk(children, depth + 1, n.id);
    }
  };
  walk(hier.data.locations as { id: number; children?: unknown[] }[], 0, null);
  return out;
}

type Props = Record<string, string | number | undefined>;

function readLayer(file: string, object: string): { properties: Props }[] {
  const topo = JSON.parse(fs.readFileSync(path.join(ROOT, "data", file), "utf8"));
  return topo.objects[object].geometries as { properties: Props }[];
}

function main(): void {
  const rows = readExport();
  const loc = readHierarchy();

  // Country of a subnational unit: walk up until depth 3.
  const countryOf = (id: number): number => {
    let cur = id;
    let info = loc.get(cur);
    while (info && info.depth > 3 && info.parent != null) {
      cur = info.parent;
      info = loc.get(cur);
    }
    return cur;
  };

  // Natural Earth admin-1, keyed by ISO3 then normalised name -> adm1_code.
  const ne = readLayer("admin1-10m.json", "ne_10m_admin_1");
  const nePool = new Map<string, Map<string, string>>();
  for (const g of ne) {
    const iso = String(g.properties.adm0_a3 ?? "");
    const name = g.properties.name;
    const code = g.properties.adm1_code;
    if (!iso || typeof name !== "string" || typeof code !== "string") continue;
    if (!nePool.has(iso)) nePool.set(iso, new Map());
    const m = nePool.get(iso)!;
    if (!m.has(norm(name))) m.set(norm(name), code);
  }

  // Committed NUTS-2 geometry, keyed by country code then normalised name -> NUTS_ID.
  const nuts = readLayer("nuts2-20m.json", "nuts2_20m");
  const nutsPool = new Map<string, Map<string, string>>();
  const nutsIds: string[] = [];
  for (const g of nuts) {
    const cc = String(g.properties.CNTR_CODE ?? "");
    const name = g.properties.NAME_LATN;
    const id = g.properties.NUTS_ID;
    if (typeof id !== "string") continue;
    nutsIds.push(id);
    if (!cc || typeof name !== "string") continue;
    if (!nutsPool.has(cc)) nutsPool.set(cc, new Map());
    const m = nutsPool.get(cc)!;
    if (!m.has(norm(name))) m.set(norm(name), id);
  }

  // Fold every row into per-location band totals, and track deaths for the join report.
  type Cell = { m: number[]; f: number[] };
  const byLoc = new Map<number, Cell>();
  const deathsOf = new Map<number, number>();
  const unknownAges = new Set<number>();
  for (const r of rows) {
    const band = AGE_BAND.get(r.age);
    const sex = SEX.get(r.sex);
    if (band === undefined) {
      unknownAges.add(r.age);
      continue;
    }
    if (!sex) continue;
    if (!byLoc.has(r.location)) {
      byLoc.set(r.location, {
        m: new Array(BANDS.length).fill(0),
        f: new Array(BANDS.length).fill(0),
      });
    }
    const cell = byLoc.get(r.location)!;
    cell[sex][band] = (cell[sex][band] ?? 0) + r.val;
    deathsOf.set(r.location, (deathsOf.get(r.location) ?? 0) + r.val);
  }
  if (unknownAges.size) {
    throw new Error(
      `export carries age group ids outside the disjoint 22: ${[...unknownAges].join(", ")}. ` +
        "Mis-binning them would silently distort every pyramid — see gbd-export-spec.md.",
    );
  }

  // Leaves only. Brazil, Italy and the UK publish macro-regions at depth 4 and the real units
  // one level below, so taking every depth>=4 node would double-count them against each other.
  const leaves = [...loc.entries()].filter(([, v]) => v.depth >= 4 && v.leaf).map(([id]) => id);
  const totalLeafDeaths = leaves.reduce((a, id) => a + (deathsOf.get(id) ?? 0), 0);

  type Out = {
    geo: "adm1" | "nuts2";
    key: string;
    name: string;
    country: string;
    locationId: number;
    measurement: "gbd-modeled";
    m: number[];
    f: number[];
  };
  const out: Out[] = [];
  const skipped: {
    name: string;
    country: string;
    deaths: number;
    share: number;
    reason: string;
  }[] = [];

  const weightsOf = (cell: Cell): { m: number[]; f: number[] } | null => {
    const total = [...cell.m, ...cell.f].reduce((a, b) => a + b, 0);
    if (!(total > 0)) return null;
    // Weights over the whole region, both sexes together, so a consumer reading m[b]+f[b]
    // gets the region's share of deaths in band b and the male/female split inside it.
    return {
      m: cell.m.map((v) => Number((v / total).toFixed(8))),
      f: cell.f.map((v) => Number((v / total).toFixed(8))),
    };
  };

  for (const id of leaves) {
    const info = loc.get(id)!;
    const cname = loc.get(countryOf(id))?.name ?? "?";
    const deaths = deathsOf.get(id) ?? 0;
    const share = totalLeafDeaths ? deaths / totalLeafDeaths : 0;
    const skip = (reason: string) =>
      skipped.push({ name: info.name, country: cname, deaths, share, reason });

    const countryReason = SKIP_COUNTRY[cname];
    if (countryReason) {
      skip(countryReason);
      continue;
    }
    const unitReason = SKIP_UNIT[info.name];
    if (unitReason) {
      skip(unitReason);
      continue;
    }
    const cell = byLoc.get(id);
    const w = cell ? weightsOf(cell) : null;
    if (!w) {
      skip("no rows in the export");
      continue;
    }
    const iso3 = COUNTRY_ISO3[cname] ?? "?";

    let keys: string[] = [];
    let geo: "adm1" | "nuts2" = "adm1";

    if (cname === "United Kingdom") {
      const prefix = UK_NUTS1[info.name];
      keys = prefix ? nutsIds.filter((x) => x.startsWith(prefix)).sort() : [];
      geo = "nuts2";
    } else if (NUTS_COUNTRY[cname]) {
      const cc = NUTS_COUNTRY[cname];
      const target = ALIAS[iso3]?.[info.name] ?? info.name;
      const hit = nutsPool.get(cc)?.get(norm(target));
      keys = hit ? [hit] : (PL_SPLIT[info.name] ?? []).filter((k) => nutsIds.includes(k));
      geo = "nuts2";
    } else {
      const target = ALIAS[iso3]?.[info.name] ?? info.name;
      const hit = nePool.get(iso3)?.get(norm(target));
      keys = hit ? [hit] : [];
      geo = "adm1";
    }

    if (!keys.length) {
      skip(geo === "nuts2" ? "no NUTS-2 name match" : "no Natural Earth name match");
      continue;
    }
    for (const key of keys) {
      out.push({
        geo,
        key,
        name: info.name,
        country: iso3,
        locationId: id,
        measurement: "gbd-modeled",
        m: w.m,
        f: w.f,
      });
    }
  }

  out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const matchedDeaths = totalLeafDeaths - skipped.reduce((a, s) => a + s.deaths, 0);
  const byCountry: Record<string, { matched: number; skipped: number }> = {};
  for (const r of out) {
    const tally = (byCountry[r.country] ??= { matched: 0, skipped: 0 });
    tally.matched += 1;
  }
  for (const s of skipped) {
    const iso = COUNTRY_ISO3[s.country] ?? s.country;
    const tally = (byCountry[iso] ??= { matched: 0, skipped: 0 });
    tally.skipped += 1;
  }

  // Roll the subnational counts back up to national and compare the SHAPE against the UN WPP
  // pyramid in data/mortality-age-sex.json. Only ratios and a total-variation distance are
  // emitted, never counts, so this stays a derived statistic rather than a re-publication.
  //
  // It agrees closely where both sources rest on civil registration (USA, Japan, Brazil) and
  // diverges where GBD is modelling around its absence (Nigeria, Pakistan). That divergence is
  // the finding, not a bug: it marks exactly the regions whose pyramids a consumer should treat
  // as estimates. Countries with no national row, or whose subnational set is partial, are
  // absent from the block rather than reported as a perfect match.
  const nationalPath = path.join(ROOT, "data", "mortality-age-sex.json");
  const national = JSON.parse(fs.readFileSync(nationalPath, "utf8")) as {
    countries: Record<string, { m: number[]; f: number[] }>;
  };
  const M49: Record<string, string> = {
    Brazil: "76",
    Ethiopia: "231",
    India: "356",
    Indonesia: "360",
    "Iran (Islamic Republic of)": "364",
    Italy: "380",
    Japan: "392",
    Kenya: "404",
    Mexico: "484",
    Nigeria: "566",
    Norway: "578",
    Pakistan: "586",
    Philippines: "608",
    Poland: "616",
    "South Africa": "710",
    "United Kingdom": "826",
    "United States of America": "840",
  };
  const rolled = new Map<string, number[]>();
  for (const id of leaves) {
    const cname = loc.get(countryOf(id))?.name ?? "?";
    const cell = byLoc.get(id);
    if (!cell) continue;
    const acc: number[] = rolled.get(cname) ?? new Array(BANDS.length).fill(0);
    for (let b = 0; b < BANDS.length; b++) {
      acc[b] = (acc[b] ?? 0) + (cell.m[b] ?? 0) + (cell.f[b] ?? 0);
    }
    rolled.set(cname, acc);
  }
  const crossCheck: Record<string, { subnationalOverNational: number; shapeDiff: number }> = {};
  for (const [cname, bands] of rolled) {
    const row = national.countries[M49[cname] ?? ""];
    if (!row) continue;
    const nat = row.m.map((v, i) => v + (row.f[i] ?? 0));
    const gs = bands.reduce((a, b) => a + b, 0);
    const ns = nat.reduce((a, b) => a + b, 0);
    if (!(gs > 0) || !(ns > 0)) continue;
    const tvd = bands.reduce((a, v, i) => a + Math.abs(v / gs - (nat[i] ?? 0) / ns), 0) / 2;
    crossCheck[COUNTRY_ISO3[cname] ?? cname] = {
      subnationalOverNational: Number((gs / ns).toFixed(3)),
      shapeDiff: Number(tvd.toFixed(4)),
    };
  }

  const payload = {
    meta: {
      note:
        "Per-region age x sex death WEIGHTS, not counts. Modelled estimates from IHME GBD 2023, " +
        "not observed registrations — every row carries measurement:'gbd-modeled' and must be " +
        "excluded from validation statistics. Weights sum to 1 across m[] + f[] for each region.",
      source: "IHME Global Burden of Disease 2023 (Deaths, Number, All causes, 2023)",
      attribution: ATTRIBUTION,
      citation: CITATION,
      gbdRound: 2023,
      bands: BANDS,
      leafSubnationalUnits: leaves.length,
      matchedUnits: new Set(out.map((r) => r.locationId)).size,
      emittedRows: out.length,
      matchedDeathShare: Number((matchedDeaths / totalLeafDeaths).toFixed(4)),
      skippedDeathShare: Number(
        (skipped.reduce((a, s) => a + s.deaths, 0) / totalLeafDeaths).toFixed(4),
      ),
      byCountry,
      skipped: skipped
        .sort((a, b) => b.deaths - a.deaths)
        .map((s) => ({
          name: s.name,
          country: s.country,
          share: Number(s.share.toFixed(6)),
          reason: s.reason,
        })),
      nationalCrossCheck: crossCheck,
      nationalCrossCheckNote:
        "subnationalOverNational is the GBD subnational total divided by the UN WPP national " +
        "total; shapeDiff is the total-variation distance between the two age distributions. " +
        "Close agreement where civil registration exists, wider where GBD is modelling without it.",
      unassignedKeysNote:
        "Some emitted keys win no cell in data/region-keys.json — Delhi, Jakarta, Osaka, Mexico " +
        "City and other small or urban regions lose the 0.5-degree area-majority vote. The keys " +
        "are valid committed geometry; that is a property of 04-05's assignment, not of this join.",
      rollDown:
        "United Kingdom regions and Poland's Mazowieckie are broadcast to their NUTS-2 children: " +
        "the output is a distribution, so a child inherits its parent's shape without duplicating " +
        "any deaths.",
    },
    regions: out,
  };

  fs.writeFileSync(OUT, JSON.stringify(payload) + "\n");
  console.log(
    `wrote ${path.relative(ROOT, OUT)} — ${payload.meta.matchedUnits}/${leaves.length} units, ` +
      `${out.length} region rows, ${(payload.meta.matchedDeathShare * 100).toFixed(2)}% of subnational deaths`,
  );
}

main();
