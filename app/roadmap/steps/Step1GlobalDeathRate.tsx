"use client";

import GlobalRandomMap from "../charts/GlobalRandomMap";
import type { CountryFeature } from "../types";

interface Step1GlobalDeathRateProps {
  features: CountryFeature[] | null;
}

export default function Step1GlobalDeathRate({ features }: Step1GlobalDeathRateProps) {
  return (
    <li className="step done">
      <span className="ring" aria-hidden="true" />
      <div className="step-body">
        <h3>
          <span className="num">1</span> Global Death Rate
        </h3>
        <p>Globally, nearly two people die every second — one death roughly every half-second.</p>
        <span className="source">
          Source: World Bank Open Data — crude death rate and population (indicators SP.DYN.CDRT.IN
          and SP.POP.TOTL).
        </span>
        <div className="rate-explainer">
          <p>
            The first layer only matches the global average: about two deaths every second. Timing
            is random, not metronomic, so the gap between dots is drawn from an exponential
            distribution. Location is also fully random across the Earth&apos;s surface, so this
            baseline deliberately ignores countries, population density, seasons, and time zones.
          </p>
          <div className="chart-grid" aria-label="Global random mortality simulation map">
            <GlobalRandomMap features={features} />
          </div>
        </div>
      </div>
    </li>
  );
}
