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
    <section className="step step-02 done">
      <header className="step-header">
        <span className="step-sphere" aria-hidden="true" />
        <div>
          <p className="step-eyebrow">Step 02 · Implemented</p>
          <h2>Death Rate By Country</h2>
        </div>
      </header>
      <div className="step-body">
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
    </section>
  );
}
