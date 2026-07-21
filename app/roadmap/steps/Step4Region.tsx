"use client";

import SubnationalChoroplethMap from "../charts/SubnationalChoroplethMap";
import RoadmapMarkdown from "../roadmapMarkdown";
import type {
  Admin1Feature,
  Nuts2Feature,
  RatePer100kByCountry,
  RatePer100kByKey,
  SubnationalCdr,
} from "../types";

interface Step4RegionProps {
  admin1Features: Admin1Feature[] | null;
  nuts2Features: Nuts2Feature[] | null;
  ratePer100kByKey: RatePer100kByKey | null;
  ratePer100kByCountry: RatePer100kByCountry | null;
  nutsCountries: Set<string> | null;
  nutsIso2ToIso3: Map<string, string> | null;
  subnational: SubnationalCdr | null;
  copy: string;
}

export default function Step4Region({
  admin1Features,
  nuts2Features,
  ratePer100kByKey,
  ratePer100kByCountry,
  nutsCountries,
  nutsIso2ToIso3,
  copy,
}: Step4RegionProps) {
  return (
    <section className="step step-04 done">
      <header className="step-header">
        <span className="step-sphere" aria-hidden="true" />
        <div>
          <p className="step-eyebrow">Step 04 · Implemented</p>
          <h2>Death Rate By Region</h2>
        </div>
      </header>
      <div className="two-col">
        <div className="rate-explainer step-body-prose">
          <RoadmapMarkdown source={copy} />
        </div>
        <div className="chart-grid" aria-label="Subnational death rate map">
          <SubnationalChoroplethMap
            admin1Features={admin1Features}
            nuts2Features={nuts2Features}
            ratePer100kByKey={ratePer100kByKey}
            ratePer100kByCountry={ratePer100kByCountry}
            nutsCountries={nutsCountries}
            nutsIso2ToIso3={nutsIso2ToIso3}
          />
        </div>
      </div>
    </section>
  );
}
