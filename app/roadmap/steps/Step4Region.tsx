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
    <li className="step done">
      <span className="ring" aria-hidden="true" />
      <div className="step-body">
        <h3>
          <span className="num">4</span> Death Rate By Region
        </h3>
        <div className="rate-explainer">
          <RoadmapMarkdown source={copy} />
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
      </div>
    </li>
  );
}
