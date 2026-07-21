"use client";

import type { CountryFeature, NeighborsByM49, SeasonalityData, SeasonalityProxies } from "../types";
import { buildFallbackDonorCoverage } from "./fallbackDonorCoverage";

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
                Latitude donors
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
                <td
                  className="num"
                  title="Latitude is a fitted model, not a direct country donor pool."
                >
                  {row.latitudeDonors} · model
                </td>
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
        Latitude has no direct country donors: it evaluates a globally fitted, latitude-scaled
        curve. Climate uses the live class blend when available, otherwise its climate-family blend.
        Neighbour counts include only observed national curves on a direct land border; own measured
        regions are a separate, earlier evidence tier.
      </p>
    </section>
  );
}
