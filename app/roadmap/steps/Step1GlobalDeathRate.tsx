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
    <section className="step step-01 done">
      <header className="step-header">
        <span className="step-sphere" aria-hidden="true" />
        <div>
          <p className="step-eyebrow">Step 01 · Implemented</p>
          <h2>Global Death Rate</h2>
        </div>
      </header>
      <div className="step-body">
        <div className="rate-explainer">
          <RoadmapMarkdown
            source={copy}
            slots={{
              "[blinking dot every 500ms]": (
                <div className="chart-grid" aria-label="Blinking dot every 500 milliseconds">
                  <PulseComparison />
                </div>
              ),
              "[chart showing 365 sampled one-second intervals]": (
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
    </section>
  );
}
