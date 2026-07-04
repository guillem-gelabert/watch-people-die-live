"use client";

import DensityMap from "../charts/DensityMap";
import BorderRasterCloseup from "../charts/BorderRasterCloseup";
import type { CountryFeature, DensityGrid, DeathsPerYearById } from "../types";

// Picked from /playground: West Africa (country-choropleth coloring) and Benelux
// (density-log coloring, matching the flat DensityMap above it). Titles stay
// region-only — country names surface on hover via the tooltip instead.
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
}

export default function Step3PopulationDensity({
  features,
  grid,
  deathsPerYearById,
}: Step3PopulationDensityProps) {
  return (
    <li className="step done">
      <span className="ring" aria-hidden="true" />
      <div className="step-body">
        <h3>
          <span className="num">3</span> Population Density
        </h3>
        <p>
          Deaths correlate strongly with population density — more people die in Paris than in
          Antarctica.
        </p>
        <span className="source">
          Source: Gridded Population of the World v4 (GPWv4, CIESIN), aggregated to a 0.5° density
          grid.
        </span>
        <div className="density-explainer">
          <p>
            Step 2 gave each country its correct death count; density decides where inside that
            country those deaths actually land. Each 0.5° grid cell carries a population count, and
            a country&apos;s deaths are split across its cells in proportion to how many people live
            in each one — so a death is far more likely to land in a city than in open countryside.
          </p>
          <div className="chart-grid" aria-label="Population density map">
            <DensityMap grid={grid} features={features} deathsPerYearById={deathsPerYearById} />
          </div>
          <p>
            Applying the raster grid to the vector country map isn&apos;t perfectly clean, though:
            country borders come from smooth vector polygons (topojson), while the population grid
            is a blocky 0.5° raster (~55 km per cell). Near a border, a single raster cell can
            straddle two countries — the close-up below shows exactly that overlap.
          </p>
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
        </div>
      </div>
    </li>
  );
}
