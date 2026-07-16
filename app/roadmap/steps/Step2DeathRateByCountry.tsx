"use client";

import CountryCentroidMap from "../charts/CountryCentroidMap";
import RoadmapMarkdown from "../roadmapMarkdown";
import type { CountryFeature, DeathsPerYearById } from "../types";

interface Step2DeathRateByCountryProps {
  features: CountryFeature[] | null;
  deathsPerYearById: DeathsPerYearById | null;
  copy: string;
}

export default function Step2DeathRateByCountry({
  features,
  deathsPerYearById,
  copy,
}: Step2DeathRateByCountryProps) {
  return (
    <li className="step done">
      <span className="ring" aria-hidden="true" />
      <div className="step-body">
        <h3>
          <span className="num">2</span> Death Rate By Country
        </h3>
        <div className="rate-explainer">
          <RoadmapMarkdown
            source={copy}
            slots={{
              "[chart cdr per country]": (
                <div className="chart-grid" aria-label="Country-level death rate map">
                  <CountryCentroidMap features={features} deathsPerYearById={deathsPerYearById} />
                </div>
              ),
            }}
          />
        </div>
      </div>
    </li>
  );
}
