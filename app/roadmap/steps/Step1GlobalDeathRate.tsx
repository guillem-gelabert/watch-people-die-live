"use client";

import GlobalRandomMap from "../charts/GlobalRandomMap";
import PoissonPulse from "../charts/PoissonPulse";
import PoissonTiming from "../charts/PoissonTiming";
import PulseComparison from "../charts/PulseComparison";
import RoadmapMarkdown from "../roadmapMarkdown";
import type { CountryFeature } from "../types";

interface Step1GlobalDeathRateProps {
  features: CountryFeature[] | null;
  copy: string;
}

export default function Step1GlobalDeathRate({ features, copy }: Step1GlobalDeathRateProps) {
  return (
    <li className="step done">
      <span className="ring" aria-hidden="true" />
      <div className="step-body">
        <h3>
          <span className="num">1</span> Global Death Rate
        </h3>
        <div className="rate-explainer">
          <RoadmapMarkdown
            source={copy}
            hiddenCodeBlockStarts={["lambda = 2"]}
            slots={{
              "[blinking dot every 500ms]": (
                <div className="chart-grid" aria-label="Blinking dot every 500 milliseconds">
                  <PulseComparison />
                </div>
              ),
              "[chart showing how many days in a year what number of people would die]": (
                <div className="chart-grid" aria-label="Poisson-distributed deaths across a year">
                  <PoissonTiming />
                </div>
              ),
              "[blinking dot randomly blinking]": (
                <div className="chart-grid" aria-label="Poisson-timed blinking dot">
                  <PoissonPulse />
                </div>
              ),
              "[map with random dots at random places]": (
                <div className="chart-grid" aria-label="Global random mortality simulation map">
                  <GlobalRandomMap features={features} />
                </div>
              ),
            }}
          />
        </div>
      </div>
    </li>
  );
}
