"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import PullToGlobe from "./PullToGlobe";
import ProxyFigure from "./proxy/ProxyFigure";
import ProxyRankingCard from "./proxy/ProxyRankingCard";
import AgeMix from "./charts/AgeMix";
import AmplitudeMap from "./charts/AmplitudeMap";
import BeatStrip from "./charts/BeatStrip";
import BorderRasterCloseup from "./charts/BorderRasterCloseup";
import DartTally from "./charts/DartTally";
import NationalVsRegionalBars from "./charts/NationalVsRegionalBars";
import ConflictEwmaWidget from "./charts/ConflictEwmaWidget";
import ConflictMap from "./charts/ConflictMap";
import CountryCentroidMap from "./charts/CountryCentroidMap";
import CountryCurves from "./charts/CountryCurves";
import DensityMap from "./charts/DensityMap";
import GdpScatter from "./charts/GdpScatter";
import GlobalRandomMap from "./charts/GlobalRandomMap";
import KoppenGeigerScatter from "./charts/KoppenGeigerScatter";
import LatitudeScatter from "./charts/LatitudeScatter";
import NeighbourScatter from "./charts/NeighbourScatter";
import PersonaDemo from "./charts/PersonaDemo";
import Pop65Scatter from "./charts/Pop65Scatter";
import PredictionComparison from "./charts/PredictionComparison";
import RegionNeighbourScatter from "./charts/RegionNeighbourScatter";
import RegionPredictionComparison from "./charts/RegionPredictionComparison";
import SubnationalChoroplethMap from "./charts/SubnationalChoroplethMap";
import { PROXY } from "./charts/chartFrame";
import { useRoadmapData } from "./useRoadmapData";

// The two crops the design uses: West Africa, where the borders are straight lines a grid can
// almost follow, and the Low Countries, where they are not.
const WEST_AFRICA_BBOX: [[number, number], [number, number]] = [
  [-6, 4],
  [6, 14],
];
const BENELUX_BBOX: [[number, number], [number, number]] = [
  [-3, 43.5],
  [16, 53],
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
    subnational,
    subnationalSeasonality,
    regionNeighbors,
    proxies,
    conflicts,
    looValidation,
    subnationalLoo,
  } = useRoadmapData();

  const activeSeasonality = unified || seasonality;
  const regions = subnationalSeasonality?.regions ?? null;

  return useMemo<SlotsBySection>(
    () => ({
      "first-light": {
        "[blinking dot every 500ms]": <BeatStrip mode="metronome" />,
        "[blinking dot randomly blinking]": <BeatStrip mode="poisson" />,
      },

      "where-global": {
        "[map with random dots at random places]": (
          <GlobalRandomMap features={features} grid={grid} />
        ),
        "[ocean uninhabited inhabited tally]": <DartTally />,
        "[chart cdr per country]": (
          <CountryCentroidMap features={features} deathsPerYearById={deathsPerYearById} />
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
              neighborsByM49={neighborsByM49}
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
        "[density map asia]": (
          <DensityMap grid={grid} features={features} deathsPerYearById={deathsPerYearById} />
        ),
      },

      "where-region": {
        "[subnational choropleth]": (
          <SubnationalChoroplethMap
            admin1Features={admin1Features}
            nuts2Features={nuts2Features}
            ratePer100kByKey={ratePer100kByKey}
            ratePer100kByCountry={ratePer100kByCountry}
            nutsCountries={nutsCountries}
            nutsIso2ToIso3={nutsIso2ToIso3}
          />
        ),
      },

      "borders-wrong-unit": {
        "[national vs regional bars]": <NationalVsRegionalBars subnational={subnational} />,
      },

      "when-seasonality": {
        "[seasonality curves]": (
          <CountryCurves seasonality={activeSeasonality} features={features} proxies={proxies} />
        ),
        "[proxy ranking card]": <ProxyRankingCard />,
        "[latitude scatter]": (
          <ProxyFigure proxyIndex={PROXY.latitude} title="Latitude correlation">
            <LatitudeScatter
              unified={unified}
              features={features}
              regions={regions}
              admin1Features={admin1Features}
            />
          </ProxyFigure>
        ),
        "[koppen scatter]": (
          <ProxyFigure proxyIndex={PROXY.climate} title="Amplitude by climate zone">
            <KoppenGeigerScatter
              unified={unified}
              proxies={proxies}
              features={features}
              regions={regions}
            />
          </ProxyFigure>
        ),
        "[pop65 scatter]": (
          <ProxyFigure proxyIndex={PROXY.pop65} title="Amplitude vs. population 65+">
            <Pop65Scatter unified={unified} proxies={proxies} features={features} />
          </ProxyFigure>
        ),
        "[gdp scatter]": (
          <ProxyFigure proxyIndex={PROXY.gdp} title="Amplitude vs. GDP per capita">
            <GdpScatter unified={unified} proxies={proxies} features={features} />
          </ProxyFigure>
        ),
        "[neighbour scatter]": (
          <ProxyFigure proxyIndex={PROXY.neighbour} title="Amplitude vs. neighbouring countries">
            <NeighbourScatter
              unified={unified}
              features={features}
              neighborsByM49={neighborsByM49}
              regions={regions}
              regionNeighbors={regionNeighbors}
            />
          </ProxyFigure>
        ),
        "[prediction comparison]": (
          <PredictionComparison
            looValidation={looValidation}
            proxies={proxies}
            neighborsByM49={neighborsByM49}
            features={features}
          />
        ),
        "[region neighbour scatter]": (
          <RegionNeighbourScatter
            regions={regions}
            regionNeighbors={regionNeighbors}
            unified={unified}
            features={features}
            neighborsByM49={neighborsByM49}
          />
        ),
        "[region prediction comparison]": (
          <RegionPredictionComparison
            subnationalLoo={subnationalLoo}
            regionCount={regions?.length ?? 0}
          />
        ),
        "[amplitude map]": (
          <AmplitudeMap
            seasonality={activeSeasonality}
            features={features}
            neighborsByM49={neighborsByM49}
            regions={regions}
            admin1Features={admin1Features}
            appliedFallbacks={appliedFallbacks}
          />
        ),
      },

      who: {
        "[sampling order]": (
          <section className="chart-panel">
            <h4 className="chart-title">Sampling order</h4>
            <PersonaDemo />
          </section>
        ),
        "[deaths by age and cause]": (
          <div className="chart-grid" aria-label="Deaths by age band and cause">
            <section className="chart-panel wide">
              <h4 className="chart-title">Deaths by age, and what they die of</h4>
              <p className="chart-copy">
                Share of deaths in each age band, and the cause mix within it.
              </p>
              <AgeMix />
            </section>
          </div>
        ),
      },

      "back-to-the-globe": {
        "[pull up for the globe]": <PullToGlobe />,
      },

      conflicts: {
        "[widget to update half life, curve smoothness, and see prediction]": (
          <div
            className="chart-grid"
            aria-label="Robust exponentially-weighted moving average of conflict fatalities"
          >
            <section className="chart-panel wide">
              <h4 className="chart-title">
                Monthly fatalities, and the weighted mean the globe uses
              </h4>
              <p className="chart-copy">
                Bars are reported fatalities; the line is the exponentially weighted mean.
              </p>
              <ConflictEwmaWidget dailyStack={conflicts?.dailyStack} />
            </section>
          </div>
        ),
        "[map of conflict fatalities]": (
          <div className="chart-grid" aria-label="Conflict fatalities on the sampling grid">
            <section className="chart-panel wide">
              <h4 className="chart-title">Where the trailing year&apos;s fatalities are</h4>
              <p className="chart-copy">ACLED fatal events aggregated onto the sampling grid.</p>
              <ConflictMap conflicts={conflicts} features={features} />
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
      subnational,
      regionNeighbors,
      proxies,
      conflicts,
      looValidation,
      subnationalLoo,
    ],
  );
}
