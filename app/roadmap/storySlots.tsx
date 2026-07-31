"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import AmplitudeMap from "./charts/AmplitudeMap";
import BorderRasterCloseup from "./charts/BorderRasterCloseup";
import ConflictEwmaWidget from "./charts/ConflictEwmaWidget";
import CountryCentroidMap from "./charts/CountryCentroidMap";
import CountryCurves from "./charts/CountryCurves";
import DensityMap from "./charts/DensityMap";
import GdpScatter from "./charts/GdpScatter";
import GlobalRandomMap from "./charts/GlobalRandomMap";
import KoppenGeigerScatter from "./charts/KoppenGeigerScatter";
import LatitudeScatter from "./charts/LatitudeScatter";
import NeighbourScatter from "./charts/NeighbourScatter";
import Pop65Scatter from "./charts/Pop65Scatter";
import PoissonPulse from "./charts/PoissonPulse";
import PoissonTiming from "./charts/PoissonTiming";
import PredictionComparison from "./charts/PredictionComparison";
import PulseComparison from "./charts/PulseComparison";
import RegionNeighbourScatter from "./charts/RegionNeighbourScatter";
import RegionPredictionComparison from "./charts/RegionPredictionComparison";
import SubnationalChoroplethMap from "./charts/SubnationalChoroplethMap";
import { useRoadmapData } from "./useRoadmapData";

const WEST_AFRICA_BBOX: [[number, number], [number, number]] = [
  [-4, 4],
  [15, 14],
];
const BENELUX_BBOX: [[number, number], [number, number]] = [
  [0, 44],
  [15, 54],
];

type SlotsBySection = Record<string, Record<string, ReactNode>>;

// Every figure in the story, keyed by the section it belongs to and then by the placeholder
// line that summons it in ROADMAP.md.
//
// This replaces the seven step components, which existed mainly to drill twenty-odd fields
// from one useRoadmapData() call down to the charts. Loading the data once here and building
// the whole map in one place means adding a figure is a two-line change rather than a new
// component plus a new prop on the composition root.
export function useStorySlots(): SlotsBySection {
  const {
    features,
    neighborsByM49,
    seasonality,
    unified,
    appliedFallbacks,
    grid,
    deathsPerYearById,
    admin1Features,
    nuts2Features,
    ratePer100kByKey,
    ratePer100kByCountry,
    nutsCountries,
    nutsIso2ToIso3,
    subnationalSeasonality,
    subnationalLoo,
    regionNeighbors,
    proxies,
    looValidation,
    conflicts,
  } = useRoadmapData();

  const activeSeasonality = unified || seasonality;
  const regions = subnationalSeasonality?.regions ?? null;

  return useMemo<SlotsBySection>(
    () => ({
      "first-light": {
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
      },

      "where-global": {
        "[map with random dots at random places]": (
          <div className="chart-grid" aria-label="Global random mortality simulation map">
            <GlobalRandomMap features={features} />
          </div>
        ),
        "[chart cdr per country]": (
          <div className="chart-grid" aria-label="Country-level death rate map">
            <CountryCentroidMap features={features} deathsPerYearById={deathsPerYearById} />
          </div>
        ),
      },

      "where-country": {
        "[Benelux Westafrika maps density/borders]": (
          <div
            className="chart-grid density-cluster"
            aria-label="Vector border and raster density close-up"
          >
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
        "[density map with dots in log]": (
          <div className="chart-grid density-cluster" aria-label="Population density map">
            <DensityMap grid={grid} features={features} deathsPerYearById={deathsPerYearById} />
          </div>
        ),
      },

      "where-region": {
        "[subnational choropleth map]": (
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
        ),
      },

      "when-seasonality": {
        "[similar curves chart]": (
          <div className="chart-grid" aria-label="Similar seasonal mortality curves">
            <CountryCurves seasonality={activeSeasonality} features={features} proxies={proxies} />
          </div>
        ),
        "[latitude scatter chart]": (
          <LatitudeScatter
            unified={unified}
            features={features}
            regions={regions}
            admin1Features={admin1Features}
          />
        ),
        "[amplitude by climate zone scatter]": (
          <KoppenGeigerScatter
            unified={unified}
            proxies={proxies}
            features={features}
            regions={regions}
          />
        ),
        "[amplitude by age over 65 scatter]": (
          <Pop65Scatter unified={unified} proxies={proxies} features={features} />
        ),
        "[amplitude by gdp pc scatter]": (
          <GdpScatter unified={unified} proxies={proxies} features={features} />
        ),
        "[amplitude by neighbouring countries scatter]": (
          <NeighbourScatter
            unified={unified}
            features={features}
            neighborsByM49={neighborsByM49}
            regions={regions}
            regionNeighbors={regionNeighbors}
          />
        ),
        "[prediction comparison chart]": (
          <div className="chart-grid" aria-label="Predictions versus measured seasonal curve">
            <PredictionComparison
              looValidation={looValidation}
              proxies={proxies}
              neighborsByM49={neighborsByM49}
              features={features}
            />
          </div>
        ),
        "[region amplitude by neighbouring regions scatter]": (
          <RegionNeighbourScatter
            regions={regions}
            regionNeighbors={regionNeighbors}
            unified={unified}
            features={features}
            neighborsByM49={neighborsByM49}
          />
        ),
        "[region prediction comparison chart]": (
          <div
            className="chart-grid"
            aria-label="Predictions versus measured seasonal curve, region level"
          >
            <RegionPredictionComparison
              subnationalLoo={subnationalLoo}
              regionCount={
                regions?.filter((r) => r.geo === "adm1" && r.measurement !== "climate-modeled")
                  .length ?? 0
              }
            />
          </div>
        ),
        "[amplitude map]": (
          <div className="chart-grid" aria-label="Seasonal mortality amplitude map">
            <section className="chart-panel wide no-card">
              <h4 className="chart-title">Amplitude By Country And Region</h4>
              <p className="chart-copy">
                Every rendered country and region is colored by seasonal amplitude. Observations use
                their measured curves; targets without observations use the assigned climate,
                neighbour, or latitude proxy.
              </p>
              <AmplitudeMap
                seasonality={activeSeasonality}
                features={features}
                neighborsByM49={neighborsByM49}
                regions={regions}
                admin1Features={admin1Features}
                appliedFallbacks={appliedFallbacks}
              />
            </section>
          </div>
        ),
      },

      conflicts: {
        "[widget to update half life, curve smoothness, and see prediction]": (
          <div
            className="chart-grid"
            aria-label="Robust exponentially-weighted moving average of conflict fatalities"
          >
            <section className="chart-panel wide">
              <h4 className="chart-title">Robust EWMA — today&apos;s conflict deaths</h4>
              <ConflictEwmaWidget dailyStack={conflicts?.dailyStack} />
            </section>
          </div>
        ),
      },
    }),
    [
      features,
      neighborsByM49,
      activeSeasonality,
      unified,
      appliedFallbacks,
      grid,
      deathsPerYearById,
      admin1Features,
      nuts2Features,
      ratePer100kByKey,
      ratePer100kByCountry,
      nutsCountries,
      nutsIso2ToIso3,
      regions,
      subnationalLoo,
      regionNeighbors,
      proxies,
      looValidation,
      conflicts,
    ],
  );
}
