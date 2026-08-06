import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import type { Feature, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import {
  harmonicRms,
  meanHarmonicCurves,
  sampleHarmonicCurve,
  scaleHarmonicAmplitude,
  shiftHarmonicCurveHalfYear,
  type HarmonicCurve,
} from "../lib/seasonal-curve";
import { buildSpatialSeasonality } from "../lib/spatial-seasonality";
import type {
  Admin1Feature,
  CountryFeature,
  SeasonalityData,
  SeasonalityProxies,
  SubnationalSeasonality,
  SubnationalSeasonalityRegion,
} from "../app/roadmap/types";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MONTH_DAYS = [31, 28.2425, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_PHASES = (() => {
  const total = d3.sum(MONTH_DAYS);
  let elapsed = 0;
  return MONTH_DAYS.map((days) => {
    const phase = (elapsed + days / 2) / total;
    elapsed += days;
    return phase;
  });
})();

function readJson<T>(relative: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8")) as T;
}

function rounded(values: number[]): number[] {
  return values.map((value) => Number(value.toFixed(4)));
}

function sample(curve: HarmonicCurve): number[] {
  return rounded(sampleHarmonicCurve(curve, MONTH_PHASES));
}

function rmse(prediction: HarmonicCurve, actual: HarmonicCurve): number {
  const predicted = sampleHarmonicCurve(prediction, MONTH_PHASES);
  const observed = sampleHarmonicCurve(actual, MONTH_PHASES);
  const mse =
    d3.sum(
      predicted,
      (value, index) => (value - (observed[index] ?? 0)) ** 2 * (MONTH_DAYS[index] ?? 0),
    ) / d3.sum(MONTH_DAYS);
  return Math.sqrt(mse);
}

function correlation(prediction: HarmonicCurve, actual: HarmonicCurve): number {
  const x = sampleHarmonicCurve(prediction, MONTH_PHASES);
  const y = sampleHarmonicCurve(actual, MONTH_PHASES);
  const mx = d3.mean(x) ?? 0;
  const my = d3.mean(y) ?? 0;
  const numerator = d3.sum(x, (value, index) => (value - mx) * ((y[index] ?? 0) - my));
  const denominator = Math.sqrt(
    d3.sum(x, (value) => (value - mx) ** 2) * d3.sum(y, (value) => (value - my) ** 2),
  );
  return denominator > 0 ? numerator / denominator : 0;
}

function solve3(matrix: number[][], vector: number[]): [number, number, number] {
  const augmented = matrix.map((row, index) => [...row, vector[index] ?? 0]);
  for (let column = 0; column < 3; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < 3; row += 1) {
      if (Math.abs(augmented[row]?.[column] ?? 0) > Math.abs(augmented[pivot]?.[column] ?? 0)) {
        pivot = row;
      }
    }
    [augmented[column], augmented[pivot]] = [augmented[pivot]!, augmented[column]!];
    const divisor = augmented[column]?.[column] ?? 0;
    if (Math.abs(divisor) < 1e-12) return [0, 0, d3.mean(vector) ?? 0];
    for (let item = column; item < 4; item += 1) {
      augmented[column]![item] = (augmented[column]?.[item] ?? 0) / divisor;
    }
    for (let row = 0; row < 3; row += 1) {
      if (row === column) continue;
      const factor = augmented[row]?.[column] ?? 0;
      for (let item = column; item < 4; item += 1) {
        augmented[row]![item] =
          (augmented[row]?.[item] ?? 0) - factor * (augmented[column]?.[item] ?? 0);
      }
    }
  }
  return [augmented[0]![3]!, augmented[1]![3]!, augmented[2]![3]!];
}

function quadraticAmplitude(
  donors: Array<{ latitude: number; curve: HarmonicCurve }>,
  latitude: number,
): number {
  const xs = donors.map(({ latitude: donorLatitude }) => Math.abs(donorLatitude));
  const ys = donors.map(({ curve }) => harmonicRms(curve));
  const sums = (power: number) => d3.sum(xs, (value) => value ** power);
  const rhs = [
    d3.sum(xs, (value, index) => value ** 2 * (ys[index] ?? 0)),
    d3.sum(xs, (value, index) => value * (ys[index] ?? 0)),
    d3.sum(ys),
  ];
  const [a, b, c] = solve3(
    [
      [sums(4), sums(3), sums(2)],
      [sums(3), sums(2), sums(1)],
      [sums(2), sums(1), xs.length],
    ],
    rhs,
  );
  const predicted = a * Math.abs(latitude) ** 2 + b * Math.abs(latitude) + c;
  return Math.max(d3.min(ys) ?? 0, Math.min(d3.max(ys) ?? predicted, predicted));
}

function aligned(curve: HarmonicCurve, latitude: number): HarmonicCurve {
  return latitude < 0 ? shiftHarmonicCurveHalfYear(curve) : curve;
}

function latitudePrediction(
  targetLatitude: number,
  donors: Array<{ latitude: number; curve: HarmonicCurve; nYears: number }>,
): HarmonicCurve {
  const canonicalDonors = [...donors]
    .sort((left, right) => right.nYears - left.nYears)
    .slice(0, 15)
    .map((donor) => ({ curve: aligned(donor.curve, donor.latitude) }));
  const canonical = meanHarmonicCurves(canonicalDonors)!;
  const targetRms = quadraticAmplitude(donors, targetLatitude);
  const scaled = scaleHarmonicAmplitude(canonical, targetRms / harmonicRms(canonical));
  return targetLatitude < 0 ? shiftHarmonicCurveHalfYear(scaled) : scaled;
}

function median(values: number[]): number {
  return d3.median(values) ?? Number.NaN;
}

function roundMetric(value: number): number {
  return Number(value.toFixed(4));
}

const seasonality = readJson<SeasonalityData>("data/seasonality-unified.json");
const proxies = readJson<SeasonalityProxies>("data/seasonality-proxies.json");
const rateGrid = readJson<{ names: Record<string, string> }>("data/rate-grid.json");
const world = readJson<Topology>("node_modules/world-atlas/countries-110m.json");
const worldObject = world.objects.countries as GeometryCollection;
const countryFeatures = topojson.feature(world, worldObject).features as CountryFeature[];
const countryById = new Map(countryFeatures.map((feature) => [Number(feature.id), feature]));
const countryIds = Object.keys(seasonality.countries)
  .map(Number)
  .sort((a, b) => a - b);
const latitudeGaps = new Map([
  [344, 22.3], // Hong Kong is folded into China by the 110m topology.
  [702, 1.35], // Singapore is absent at this topology's resolution.
]);
const countryLatitude = new Map(
  countryIds.map((id) => {
    const feature = countryById.get(id) as Feature<Geometry> | undefined;
    return [id, feature ? d3.geoCentroid(feature)[1] : (latitudeGaps.get(id) ?? 0)];
  }),
);
const neighborIndexes = topojson.neighbors(worldObject.geometries);
const neighbors = new Map(
  worldObject.geometries.map((geometry, index) => [
    Number(geometry.id),
    (neighborIndexes[index] ?? []).map((neighbor) => Number(worldObject.geometries[neighbor]?.id)),
  ]),
);

const countryRows = countryIds.map((targetId) => {
  const actual = seasonality.countries[String(targetId)]!;
  const donors = countryIds
    .filter((id) => id !== targetId && countryLatitude.has(id))
    .map((id) => ({
      latitude: countryLatitude.get(id)!,
      curve: seasonality.countries[String(id)]!,
      nYears: seasonality.quality?.[String(id)]?.nYears ?? 1,
    }));
  const latitude = latitudePrediction(countryLatitude.get(targetId) ?? 0, donors);
  const mean = meanHarmonicCurves(donors.map(({ curve }) => ({ curve })))!;
  const targetProxy = proxies.byM49[String(targetId)];
  const climateDonors = donors.filter((donor) => {
    const donorId = countryIds.find((id) => seasonality.countries[String(id)] === donor.curve);
    const donorProxy = donorId == null ? undefined : proxies.byM49[String(donorId)];
    return targetProxy?.kgClass && donorProxy?.kgClass === targetProxy.kgClass;
  });
  const climateCanonical = meanHarmonicCurves(
    climateDonors.map((donor) => ({ curve: aligned(donor.curve, donor.latitude) })),
  );
  const climate = climateCanonical
    ? countryLatitude.get(targetId)! < 0
      ? shiftHarmonicCurveHalfYear(climateCanonical)
      : climateCanonical
    : latitude;
  const neighborCurves = (neighbors.get(targetId) ?? []).flatMap((id) => {
    const curve = seasonality.countries[String(id)];
    return curve ? [{ curve }] : [];
  });
  const neighbor = meanHarmonicCurves(neighborCurves) ?? latitude;
  return {
    m49: targetId,
    name: rateGrid.names[String(targetId)] ?? String(targetId),
    actual: sample(actual),
    latitude_prediction: sample(latitude),
    climate_prediction: sample(climate),
    neighbor_prediction: sample(neighbor),
    latitude_rmse: roundMetric(rmse(latitude, actual)),
    climate_rmse: roundMetric(rmse(climate, actual)),
    neighbor_rmse: roundMetric(rmse(neighbor, actual)),
    _meanRmse: rmse(mean, actual),
    _meanR: correlation(mean, actual),
    _latitudeR: correlation(latitude, actual),
    _climateR: correlation(climate, actual),
    _neighborR: correlation(neighbor, actual),
  };
});

const methods = [
  {
    label: "Mean mortality curve",
    rmse: (row: (typeof countryRows)[number]) => row._meanRmse,
    r: (row: (typeof countryRows)[number]) => row._meanR,
  },
  {
    label: "Nearest latitude",
    rmse: (row: (typeof countryRows)[number]) => row.latitude_rmse,
    r: (row: (typeof countryRows)[number]) => row._latitudeR,
  },
  {
    label: "Climate class",
    rmse: (row: (typeof countryRows)[number]) => row.climate_rmse,
    r: (row: (typeof countryRows)[number]) => row._climateR,
  },
  {
    label: "Nearest neighbour country",
    rmse: (row: (typeof countryRows)[number]) => row.neighbor_rmse,
    r: (row: (typeof countryRows)[number]) => row._neighborR,
  },
];
const meanError = d3.sum(countryRows, (row) => row._meanRmse ** 2);
const latitudeError = d3.sum(countryRows, (row) => row.latitude_rmse ** 2);
const comparisonTable = methods.map((method) => {
  const errors = countryRows.map(method.rmse);
  const total = d3.sum(errors, (error) => error ** 2);
  return {
    Method: method.label,
    "Median RMSE": roundMetric(median(errors)),
    "Median prediction r": Number(median(countryRows.map(method.r)).toFixed(2)),
    "Skill vs mean curve": Number((1 - total / meanError).toFixed(2)),
    "Skill vs latitude": Number((1 - total / latitudeError).toFixed(2)),
    "Countries won (vs latitude)":
      method.label === "Nearest latitude"
        ? null
        : Number(
            (
              countryRows.filter((row) => method.rmse(row) < row.latitude_rmse).length /
              countryRows.length
            ).toFixed(2),
          ),
  };
});

const countryOutput = {
  meta: {
    source:
      "Leave-one-country-out validation regenerated from continuous pooled order-4 harmonic curves; latitude is refit per fold, and climate/neighbor donor means exclude the target.",
    nCountries: countryRows.length,
    droppedNoTemperature: [],
    curveSampling: "Twelve calendar-month midpoint samples for the roadmap chart only.",
  },
  comparisonTable,
  perCountry: countryRows.map(
    ({ _meanRmse, _meanR, _latitudeR, _climateR, _neighborR, ...row }) => row,
  ),
};
fs.writeFileSync(
  path.join(ROOT, "data/seasonality-loo-validation.json"),
  `${JSON.stringify(countryOutput)}\n`,
);

const subnational = readJson<SubnationalSeasonality>("data/seasonality-subnational.json");
const admin = readJson<Topology>("data/admin1-10m.json");
const adminObject = admin.objects.ne_10m_admin_1 as GeometryCollection;
const adminFeatures = topojson.feature(admin, adminObject).features as Admin1Feature[];
const adminFeatureByKey = new Map(
  adminFeatures.map((feature) => [feature.properties.adm1_code, feature]),
);
const adminNeighborIndexes = topojson.neighbors(adminObject.geometries);
const adminNeighbors = new Map(
  adminObject.geometries.map((geometry, index) => [
    String((geometry.properties as { adm1_code?: string } | undefined)?.adm1_code),
    (adminNeighborIndexes[index] ?? []).flatMap((neighbor) => {
      const key = (
        adminObject.geometries[neighbor]?.properties as { adm1_code?: string } | undefined
      )?.adm1_code;
      return key ? [key] : [];
    }),
  ]),
);
const measuredRegions = subnational.regions.filter(
  (region): region is SubnationalSeasonalityRegion & { key: string } =>
    region.geo === "adm1" &&
    region.measurement !== "climate-modeled" &&
    adminFeatureByKey.has(region.key),
);
const measuredByKey = new Map(measuredRegions.map((region) => [region.key, region]));
const regionMean = meanHarmonicCurves(measuredRegions.map((region) => ({ curve: region.curve })))!;
const regionRows = measuredRegions.map((region) => {
  const feature = adminFeatureByKey.get(region.key)!;
  const latitudeEstimate = buildSpatialSeasonality([{ ...feature, id: 0 }], new Map(), {
    countries: {},
    fallback: seasonality.fallback,
  }).get(0)!.curve;
  const neighborCurves = (adminNeighbors.get(region.key) ?? []).flatMap((key) => {
    const donor = measuredByKey.get(key);
    return donor ? [{ curve: donor.curve }] : [];
  });
  const neighbor = meanHarmonicCurves(neighborCurves) ?? latitudeEstimate;
  return {
    region,
    latitude: latitudeEstimate,
    neighbor,
    meanRmse: rmse(regionMean, region.curve),
    latitudeRmse: rmse(latitudeEstimate, region.curve),
    neighborRmse: rmse(neighbor, region.curve),
  };
});
const countryMetric = (label: string) =>
  Number(comparisonTable.find((row) => row.Method === label)?.["Median RMSE"] ?? 0);
const exampleKeys = ["RUS-2333", "USA-3520", "ARG-1307", "BRA-612", "ZAF-1189"];
const regionOutput = {
  meta: {
    source:
      "Region-level leave-one-out regenerated from continuous pooled order-4 harmonic curves in data/seasonality-subnational.json.",
    metric: "median day-weighted RMSE (lower is better)",
    note: "Region and country LOO have different targets, so the columns are directional, not strictly comparable.",
    curveSampling: "Twelve calendar-month midpoint samples for the roadmap chart only.",
    nRegions: regionRows.length,
  },
  comparison: [
    {
      proxy: "Mean curve",
      country: countryMetric("Mean mortality curve"),
      region: roundMetric(median(regionRows.map((row) => row.meanRmse))),
    },
    {
      proxy: "Nearest latitude",
      country: countryMetric("Nearest latitude"),
      region: roundMetric(median(regionRows.map((row) => row.latitudeRmse))),
    },
    {
      proxy: "Nearest neighbour",
      country: countryMetric("Nearest neighbour country"),
      region: roundMetric(median(regionRows.map((row) => row.neighborRmse))),
    },
  ],
  examples: exampleKeys.flatMap((key) => {
    const row = regionRows.find((candidate) => candidate.region.key === key);
    return row
      ? [
          {
            key,
            name: row.region.name,
            country: row.region.country,
            measured: sample(row.region.curve),
            neighbour: sample(row.neighbor),
            latitude: sample(row.latitude),
            nbRMSE: roundMetric(row.neighborRmse),
          },
        ]
      : [];
  }),
};
fs.writeFileSync(
  path.join(ROOT, "data/seasonality-subnational-loo.json"),
  `${JSON.stringify(regionOutput)}\n`,
);
console.log(
  `Wrote harmonic validation: ${countryRows.length} countries, ${regionRows.length} measured regions.`,
);
