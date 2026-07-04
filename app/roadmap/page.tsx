"use client";

import Link from "next/link";
import "./roadmap.css";
import { useRoadmapData } from "./useRoadmapData";
import Step1GlobalDeathRate from "./steps/Step1GlobalDeathRate";
import Step2DeathRateByCountry from "./steps/Step2DeathRateByCountry";
import Step3PopulationDensity from "./steps/Step3PopulationDensity";
import Step4SeasonalMortality from "./steps/Step4SeasonalMortality";
import Step5Region from "./steps/Step5Region";
import Step6Conflicts from "./steps/Step6Conflicts";
import Step7Epidemics from "./steps/Step7Epidemics";
import Step8TimeOfDay from "./steps/Step8TimeOfDay";

export default function RoadmapPage() {
  const { status, features, seasonality, unified, grid, deathsPerYearById } = useRoadmapData();
  const activeSeasonality = unified || seasonality;
  const seasonalityStatusText =
    status === "seasonality-error"
      ? "Seasonal charts could not be loaded."
      : "Deviation is measured as the largest monthly percent difference from the annual average.";

  return (
    <main>
      <Link className="back" href="/">
        ← Back to the globe
      </Link>
      <h1>Roadmap</h1>
      <p className="lead">
        People die. Every day. All the time — worldwide, nearly two people die every second. But
        deaths aren&apos;t spread evenly across time or space. The project closes the gap between
        reality and the best simulation one layer at a time. Green rings are implemented; white
        rings are still planned.
      </p>

      <div className="legend" aria-hidden="true">
        <span>
          <span className="key is-done" /> Implemented
        </span>
        <span>
          <span className="key is-todo" /> Planned
        </span>
      </div>

      <div className="tracks">
        <section className="track" aria-label="Mortality track">
          <span className="track-label">Mortality</span>
          <ol className="steps">
            <Step1GlobalDeathRate features={features} />
            <Step2DeathRateByCountry features={features} deathsPerYearById={deathsPerYearById} />
            <Step3PopulationDensity
              features={features}
              grid={grid}
              deathsPerYearById={deathsPerYearById}
            />
            <Step4SeasonalMortality
              features={features}
              activeSeasonality={activeSeasonality}
              unified={unified}
              seasonalityStatusText={seasonalityStatusText}
            />
            <Step5Region />
            <Step6Conflicts />
            <Step7Epidemics />
            <Step8TimeOfDay />
          </ol>
        </section>
      </div>

      <p className="note">
        The globe is statistical, not a feed of individual records. A flash and persona should be
        read as a representative event drawn from public aggregate data, never as an identifiable
        death.
      </p>

      <footer>This is a personal project exploring statistical mortality visualization.</footer>
    </main>
  );
}
