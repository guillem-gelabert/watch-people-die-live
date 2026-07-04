"use client";

import CountryCentroidMap from "../charts/CountryCentroidMap";
import type { CountryFeature, DeathsPerYearById } from "../types";

interface Step2DeathRateByCountryProps {
  features: CountryFeature[] | null;
  deathsPerYearById: DeathsPerYearById | null;
}

export default function Step2DeathRateByCountry({
  features,
  deathsPerYearById,
}: Step2DeathRateByCountryProps) {
  return (
    <li className="step done">
      <span className="ring" aria-hidden="true" />
      <div className="step-body">
        <h3>
          <span className="num">2</span> Death Rate By Country
        </h3>
        <p>Country-level mortality is measured consistently across every country in the world.</p>
        <span className="source">
          Source: World Bank crude death rate by country (derived from UN World Population
          Prospects).
        </span>
        <div className="rate-explainer">
          <p>
            In 2000, Mexico and Lithuania both had life expectancy around 72 years, but
            Mexico&apos;s crude death rate was about 4 per 1,000, while Lithuania&apos;s was about
            11 per 1,000. Same life expectancy, almost 3× crude death rate difference.{" "}
            <a
              href="https://www.sciencedirect.com/topics/mathematics/crude-death-rate"
              target="_blank"
              rel="noopener"
            >
              Source
            </a>
            .
          </p>
          <p>
            Each country now fires deaths at its own real annual rate instead of the flat global
            average — populous countries pulse far more often than sparse ones. But within a
            country, every death still lands on exactly the same point: its geographic center. Step
            3 fixes that by spreading deaths out realistically inside each border.
          </p>
          <div className="chart-grid" aria-label="Country-level death rate map">
            <CountryCentroidMap features={features} deathsPerYearById={deathsPerYearById} />
          </div>
        </div>
      </div>
    </li>
  );
}
