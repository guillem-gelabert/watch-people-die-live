import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as topojson from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type {
  AppliedFallbackCurve,
  AppliedSeasonalityFallbacks,
  ClimateFallbackModel,
} from "../lib/spatial-seasonality";
import {
  buildFallbackProxyAssignments,
  FALLBACK_CLIMATE_CLASS_OVERRIDES,
  FALLBACK_PROXY_OVERRIDES,
  type FallbackProxyAssignment,
  type FallbackGroup,
} from "../lib/fallback-proxy-assignment";
import type {
  Admin1Feature,
  Admin1Properties,
  CountryFeature,
  NeighborsByM49,
  RegionNeighborsByCode,
  SeasonalityData,
  SeasonalityProxies,
  SubnationalSeasonality,
} from "../app/roadmap/types";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8")) as T;
}

function sourceForProxy(proxy: FallbackGroup): AppliedFallbackCurve["source"] {
  const sources: Record<FallbackGroup, AppliedFallbackCurve["source"]> = {
    Latitude: "latitude",
    Climate: "climate",
    "Regional / neighbour": "bordering-countries",
  };
  return sources[proxy];
}

function selectedCurve(row: FallbackProxyAssignment): number[] | null {
  const proxy = row.appliedProxy?.group;
  if (proxy === "Latitude") return row.latitude.curve;
  if (proxy === "Climate") return row.climate.curve;
  if (proxy === "Regional / neighbour") return row.neighbor.curve;
  return null;
}

function appliedCurve(row: FallbackProxyAssignment): AppliedFallbackCurve | null {
  const proxy = row.appliedProxy?.group;
  const curve = selectedCurve(row);
  if (!proxy || !curve?.length) return null;
  return {
    curve,
    source: sourceForProxy(proxy),
    proxy,
    ...(row.appliedProxy?.overridden ? { overridden: true } : {}),
  };
}

const countryTopology = readJson<Topology>("node_modules/world-atlas/countries-110m.json");
const countryObject = countryTopology.objects.countries as GeometryCollection;
const features = topojson.feature(countryTopology, countryObject).features as CountryFeature[];
const countryNeighborIndexes = topojson.neighbors(countryObject.geometries);
const neighborsByM49: NeighborsByM49 = new Map(
  countryObject.geometries.map((geometry, index) => [
    Number(geometry.id),
    (countryNeighborIndexes[index] ?? [])
      .map((neighborIndex) => countryObject.geometries[neighborIndex]?.id)
      .filter((id): id is string | number => id != null)
      .map(Number),
  ]),
);

const admin1Topology = readJson<Topology>("data/admin1-10m.json");
const admin1Object = admin1Topology.objects.ne_10m_admin_1 as GeometryCollection;
const admin1Features = topojson.feature(admin1Topology, admin1Object).features as Admin1Feature[];
const admin1NeighborIndexes = topojson.neighbors(admin1Object.geometries);
const regionNeighbors: RegionNeighborsByCode = new Map(
  admin1Object.geometries.map((geometry, index) => {
    const properties = geometry.properties as Admin1Properties | undefined;
    return [
      properties?.adm1_code ?? String(index),
      (admin1NeighborIndexes[index] ?? [])
        .map((neighborIndex) => {
          const neighbor = admin1Object.geometries[neighborIndex];
          return (neighbor?.properties as Admin1Properties | undefined)?.adm1_code;
        })
        .filter((key): key is string => key != null),
    ];
  }),
);

const seasonality = readJson<SeasonalityData>("data/seasonality-unified.json");
seasonality.climate = readJson<ClimateFallbackModel>("data/seasonality-climate-fallback.json");
const proxies = readJson<SeasonalityProxies>("data/seasonality-proxies.json");
const subnational = readJson<SubnationalSeasonality>("data/seasonality-subnational.json");
const rows = buildFallbackProxyAssignments(
  features,
  seasonality,
  proxies,
  neighborsByM49,
  subnational.regions,
  admin1Features,
  regionNeighbors,
);

const countries: AppliedSeasonalityFallbacks["countries"] = {};
const regions: AppliedSeasonalityFallbacks["regions"] = {};
const unassignedTargets: string[] = [];
for (const row of rows) {
  const applied = appliedCurve(row);
  if (!applied) {
    unassignedTargets.push(row.country);
    continue;
  }
  if (row.isRegional) regions[row.id.slice("region-".length)] = applied;
  else countries[String(row.m49)] = applied;
}

const output: AppliedSeasonalityFallbacks = {
  meta: {
    method:
      "Highest-quality donor group from the fallback proxy-assignment model, with explicit regional overrides.",
    countryCount: Object.keys(countries).length,
    regionCount: Object.keys(regions).length,
    unassignedTargets,
    unassignedNote:
      "Antarctica has no observed curve, usable donor proxy, or populated mortality-grid cells.",
    overrides: FALLBACK_PROXY_OVERRIDES,
    climateClassOverrides: FALLBACK_CLIMATE_CLASS_OVERRIDES,
  },
  countries,
  regions,
};

const outputPath = path.join(ROOT, "data/seasonality-applied-fallbacks.json");
fs.writeFileSync(outputPath, `${JSON.stringify(output)}\n`);
console.log(
  `Wrote ${path.relative(ROOT, outputPath)}: ${Object.keys(countries).length} countries, ${Object.keys(regions).length} regions.`,
);
