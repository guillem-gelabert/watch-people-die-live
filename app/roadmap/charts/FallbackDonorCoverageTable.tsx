"use client";

import type {
  Admin1Feature,
  CountryFeature,
  NeighborsByM49,
  SeasonalityData,
  SeasonalityProxies,
  SubnationalSeasonalityRegion,
} from "../types";
import { fmtPlainPct } from "../chartHelpers";
import {
  buildFallbackDonorCoverage,
  LATITUDE_DONOR_TOLERANCE_DEGREES,
} from "./fallbackDonorCoverage";

interface FallbackDonorCoverageTableProps {
  features: CountryFeature[] | null;
  seasonality: SeasonalityData | null;
  proxies: SeasonalityProxies | null;
  neighborsByM49: NeighborsByM49 | null;
  regions: SubnationalSeasonalityRegion[] | null;
  admin1Features: Admin1Feature[] | null;
}

function formatFallback(summary: {
  countryDonors: number;
  regionDonors: number;
  amplitude: number | null;
}) {
  return `c${summary.countryDonors} · r${summary.regionDonors} · ${
    summary.amplitude == null ? "—" : fmtPlainPct(summary.amplitude)
  }`;
}

function formatHighestQuality(row: ReturnType<typeof buildFallbackDonorCoverage>[number]) {
  const winner = row.highestQualityDonorGroup;
  if (!winner) return "—";
  const cadence = winner.quality.cadence ? `${winner.quality.cadence}ly` : "cadence unknown";
  const years =
    winner.quality.medianYears == null
      ? "years unknown"
      : `${winner.quality.medianYears % 1 ? winner.quality.medianYears.toFixed(1) : winner.quality.medianYears} median years`;
  const geography = winner.quality.geography === "region" ? "regions" : "countries";
  return `${winner.groups.join(" / ")} — ${cadence}; ${years}; ${geography}`;
}

export default function FallbackDonorCoverageTable({
  features,
  seasonality,
  proxies,
  neighborsByM49,
  regions,
  admin1Features,
}: FallbackDonorCoverageTableProps) {
  if (!features || !seasonality || !neighborsByM49) return null;
  const rows = buildFallbackDonorCoverage(
    features,
    seasonality,
    proxies,
    neighborsByM49,
    regions ?? [],
    admin1Features ?? [],
  );

  return (
    <section className="chart-panel wide" aria-labelledby="fallback-donor-coverage-title">
      <h4 id="fallback-donor-coverage-title" className="chart-title">
        Fallback Donor Coverage
      </h4>
      <p className="chart-copy">
        Three independently generated fallback curves for each of the {rows.length} countries
        without an observed national seasonal curve. Every cell shows donor countries (c), donor
        regions (r), then the curve amplitude.
      </p>
      <div className="loo-summary">
        <table className="loo-summary-table">
          <thead>
            <tr>
              <th scope="col">Country</th>
              <th scope="col" className="num">
                Latitude (c / r / amp)
              </th>
              <th scope="col" className="num">
                Climate zone (c / r / amp)
              </th>
              <th scope="col" className="num">
                Regional / neighbour (c / r / amp)
              </th>
              <th scope="col" className="num">
                Amplitude spread
              </th>
              <th scope="col">Highest-quality donor group</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.m49}>
                <th scope="row">{row.country}</th>
                <td
                  className="num"
                  title={`Latitude candidates are within ±${LATITUDE_DONOR_TOLERANCE_DEGREES}° in the same hemisphere.`}
                >
                  {formatFallback(row.latitude)}
                </td>
                <td className="num" title={`Runtime climate source: ${row.climate.label}.`}>
                  {formatFallback(row.climate)}
                </td>
                <td className="num">{formatFallback(row.neighbor)}</td>
                <td className="num">
                  {row.amplitudeSpread == null ? "—" : fmtPlainPct(row.amplitudeSpread)}
                </td>
                <td>{formatHighestQuality(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="loo-cohort-note">
        Amplitude is the maximum monthly distance from a mean-1 curve. Latitude candidates have a
        country or Admin-1 centroid within ±{LATITUDE_DONOR_TOLERANCE_DEGREES}° in the same
        hemisphere. Climate uses the live class blend when available, otherwise its climate-family
        blend. The regional/neighbour curve uses observed Admin-1 regions in the target country
        first; otherwise evidence from directly bordering countries. Amplitude spread is the maximum
        minus minimum available fallback amplitude: lower means closer agreement. The final column
        ranks the donor groups by their finest known cadence (weekly, then monthly, then quarterly),
        then median coverage years, then regional over country donors.
      </p>
    </section>
  );
}
