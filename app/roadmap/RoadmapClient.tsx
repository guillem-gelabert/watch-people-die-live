"use client";

import Link from "next/link";
import { roadmapSection } from "./roadmapMarkdown";
import Step1GlobalDeathRate from "./steps/Step1GlobalDeathRate";
import Step2DeathRateByCountry from "./steps/Step2DeathRateByCountry";
import Step3PopulationDensity from "./steps/Step3PopulationDensity";
import Step4Region from "./steps/Step4Region";
import Step5SeasonalMortality from "./steps/Step5SeasonalMortality";
import Step6Conflicts from "./steps/Step6Conflicts";
import Step7Epidemics from "./steps/Step7Epidemics";
import { useRoadmapData } from "./useRoadmapData";

interface RoadmapClientProps {
  markdown: string;
}

export default function RoadmapClient({ markdown }: RoadmapClientProps) {
  const {
    features,
    neighborsByM49,
    seasonality,
    unified,
    grid,
    deathsPerYearById,
    admin1Features,
    nuts2Features,
    ratePer100kByKey,
    ratePer100kByCountry,
    nutsCountries,
    nutsIso2ToIso3,
    subnational,
    subnationalSeasonality,
    subnationalLoo,
    regionNeighbors,
    proxies,
    looValidation,
    conflicts,
  } = useRoadmapData();
  const activeSeasonality = unified || seasonality;

  return (
    <main>
      <Link className="back" href="/">
        ← Back to the globe
      </Link>
      <h1>Roadmap</h1>

      <div className="tracks">
        <section className="track" aria-label="Mortality track">
          <ol className="steps">
            <Step1GlobalDeathRate
              features={features}
              copy={roadmapSection(markdown, "Global Death Rate")}
            />
            <Step2DeathRateByCountry
              features={features}
              deathsPerYearById={deathsPerYearById}
              copy={roadmapSection(markdown, "Death Rate By Country")}
            />
            <Step3PopulationDensity
              features={features}
              grid={grid}
              deathsPerYearById={deathsPerYearById}
              copy={roadmapSection(markdown, "Population Density")}
            />
            <Step4Region
              admin1Features={admin1Features}
              nuts2Features={nuts2Features}
              ratePer100kByKey={ratePer100kByKey}
              ratePer100kByCountry={ratePer100kByCountry}
              nutsCountries={nutsCountries}
              nutsIso2ToIso3={nutsIso2ToIso3}
              subnational={subnational}
              copy={roadmapSection(markdown, "Death Rate By Region")}
            />
            <Step5SeasonalMortality
              features={features}
              neighborsByM49={neighborsByM49}
              activeSeasonality={activeSeasonality}
              unified={unified}
              proxies={proxies}
              looValidation={looValidation}
              admin1Features={admin1Features}
              subnationalSeasonality={subnationalSeasonality}
              subnationalLoo={subnationalLoo}
              regionNeighbors={regionNeighbors}
              copy={roadmapSection(markdown, "Death Rate By Time Of Year")}
            />
            <Step6Conflicts
              conflicts={conflicts}
              copy={roadmapSection(markdown, "Ongoing Conflicts")}
            />
            <Step7Epidemics copy={roadmapSection(markdown, "Ongoing Epidemics")} />
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
