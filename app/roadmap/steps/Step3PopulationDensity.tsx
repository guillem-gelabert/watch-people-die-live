"use client";

import BorderRasterCloseup from "../charts/BorderRasterCloseup";
import DensityMap from "../charts/DensityMap";
import RoadmapMarkdown from "../roadmapMarkdown";
import type { CountryFeature, DensityGrid, DeathsPerYearById } from "../types";

const WEST_AFRICA_BBOX: [[number, number], [number, number]] = [
  [-4, 4],
  [15, 14],
];
const BENELUX_BBOX: [[number, number], [number, number]] = [
  [0, 44],
  [15, 54],
];

interface Step3PopulationDensityProps {
  features: CountryFeature[] | null;
  grid: DensityGrid | null;
  deathsPerYearById: DeathsPerYearById | null;
  copy: string;
}

export default function Step3PopulationDensity({
  features,
  grid,
  deathsPerYearById,
  copy,
}: Step3PopulationDensityProps) {
  const densityMap = (
    <div className="chart-grid" aria-label="Population density map">
      <DensityMap grid={grid} features={features} deathsPerYearById={deathsPerYearById} />
    </div>
  );

  return (
    <li className="step done">
      <span className="ring" aria-hidden="true" />
      <div className="step-body">
        <h3>
          <span className="num">3</span> Population Density
        </h3>
        <div className="density-explainer">
          <RoadmapMarkdown
            source={copy}
            slots={{
              "[Benelux Westafrika maps density/borders]": (
                <div className="chart-grid" aria-label="Vector border and raster density close-up">
                  <BorderRasterCloseup
                    features={features}
                    grid={grid}
                    bbox={WEST_AFRICA_BBOX}
                    title="West Africa"
                    id="border-raster-closeup-west-africa"
                    colorBy="country"
                  />
                  <BorderRasterCloseup
                    features={features}
                    grid={grid}
                    bbox={BENELUX_BBOX}
                    title="Benelux"
                    id="border-raster-closeup-benelux"
                    colorBy="density"
                  />
                </div>
              ),
              "[density map with dots in log]": densityMap,
            }}
          />
        </div>
      </div>
    </li>
  );
}
