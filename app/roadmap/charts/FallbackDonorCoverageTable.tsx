"use client";

import type { CountryFeature, NeighborsByM49, SeasonalityData, SeasonalityProxies } from "../types";
import {
  buildFallbackDonorCoverage,
  LATITUDE_DONOR_TOLERANCE_DEGREES,
} from "./fallbackDonorCoverage";

interface FallbackDonorCoverageTableProps {
  features: CountryFeature[] | null;
  seasonality: SeasonalityData | null;
  proxies: SeasonalityProxies | null;
  neighborsByM49: NeighborsByM49 | null;
}

export default function FallbackDonorCoverageTable({
  features,
  seasonality,
  proxies,
  neighborsByM49,
}: FallbackDonorCoverageTableProps) {
  if (!features || !seasonality || !neighborsByM49) return null;
  const rows = buildFallbackDonorCoverage(features, seasonality, proxies, neighborsByM49);

  return (
    <section className="chart-panel wide" aria-labelledby="fallback-donor-coverage-title">
      <h4 id="fallback-donor-coverage-title" className="chart-title">
        Fallback Donor Coverage
      </h4>
      <p className="chart-copy">
        Direct measured-country donors available independently to the {rows.length} countries
        without an observed national seasonal curve. Higher counts mean a proxy has more observed
        curves to draw on; they do not measure prediction accuracy.
      </p>
      <div className="loo-summary">
        <table className="loo-summary-table">
          <thead>
            <tr>
              <th scope="col">Country</th>
              <th scope="col" className="num">
                Latitude donors (±{LATITUDE_DONOR_TOLERANCE_DEGREES}°)
              </th>
              <th scope="col" className="num">
                Climate-zone donors
              </th>
              <th scope="col" className="num">
                Neighbour donors
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.m49}>
                <th scope="row">{row.country}</th>
                <td className="num">{row.latitudeDonors}</td>
                <td className="num" title={`Runtime climate source: ${row.climateLabel}.`}>
                  {row.climateDonors} · {row.climateLabel}
                </td>
                <td className="num">{row.neighborDonors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="loo-cohort-note">
        Latitude donors have a country-centroid absolute latitude within ±
        {LATITUDE_DONOR_TOLERANCE_DEGREES}° and are in the same hemisphere. The running map still
        evaluates a globally fitted, latitude-scaled curve rather than directly averaging this band.
        Climate uses the live class blend when available, otherwise its climate-family blend.
        Neighbour counts include only observed national curves on a direct land border; own measured
        regions are a separate, earlier evidence tier.
      </p>
    </section>
  );
}
