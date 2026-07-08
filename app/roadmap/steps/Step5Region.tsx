"use client";

import SubnationalChoroplethMap from "../charts/SubnationalChoroplethMap";
import type {
  Admin1Feature,
  Nuts2Feature,
  RatePer100kByCountry,
  RatePer100kByKey,
  SubnationalCdr,
} from "../types";

interface Step5RegionProps {
  admin1Features: Admin1Feature[] | null;
  nuts2Features: Nuts2Feature[] | null;
  ratePer100kByKey: RatePer100kByKey | null;
  ratePer100kByCountry: RatePer100kByCountry | null;
  nutsCountries: Set<string> | null;
  subnational: SubnationalCdr | null;
}

export default function Step5Region({
  admin1Features,
  nuts2Features,
  ratePer100kByKey,
  ratePer100kByCountry,
  nutsCountries,
  subnational,
}: Step5RegionProps) {
  const coverage = subnational
    ? `${subnational.meta.regionCount} regions across ${subnational.meta.countryCount} countries`
    : "hundreds of regions";

  return (
    <li className="step done">
      <span className="ring" aria-hidden="true" />
      <div className="step-body">
        <h3>
          <span className="num">5</span> Death Rate By Region
        </h3>
        <p>
          There are mortality differences between regions inside a single country, beyond the
          national average.
        </p>
        <span className="source">
          Source: IHME Global Burden of Disease 2023 (all-cause crude death rate) worldwide, and
          Eurostat 2023 NUTS-2 rates across Europe, joined to Natural Earth and GISCO regions.
        </span>
        <div className="rate-explainer">
          <p>
            A single national rate hides enormous internal spread. In Japan, rural{" "}
            <strong>Akita</strong> dies at nearly twice the rate of <strong>Tokyo</strong>; in the
            US, <strong>West Virginia</strong> runs well above <strong>Utah</strong>; in Europe,
            north-west <strong>Bulgaria</strong> and eastern Germany far exceed{" "}
            <strong>Ireland</strong> or the Nordic capitals. Most of the gap is age structure —
            older regions bury more of their people each year — layered over real differences in
            health, poverty, and access to care.
          </p>
          <div className="chart-grid" aria-label="Subnational death rate map">
            <SubnationalChoroplethMap
              admin1Features={admin1Features}
              nuts2Features={nuts2Features}
              ratePer100kByKey={ratePer100kByKey}
              ratePer100kByCountry={ratePer100kByCountry}
              nutsCountries={nutsCountries}
            />
          </div>
          <p className="chart-status">
            Subnational data covers {coverage}; every other country keeps its single national rate.
          </p>
        </div>
      </div>
    </li>
  );
}
