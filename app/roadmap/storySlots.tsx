"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import ConceptTiles from "./ConceptTiles";
import PullToGlobe from "./PullToGlobe";
import ProxyFigure from "./proxy/ProxyFigure";
import ProxyRankingCard from "./proxy/ProxyRankingCard";
import ProxyScorecard from "./proxy/ProxyScorecard";
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
import SmoothingExplainer from "./charts/SmoothingExplainer";
import SubnationalChoroplethMap from "./charts/SubnationalChoroplethMap";
import { PROXY } from "./charts/chartFrame";
import { useDict } from "./I18nContext";
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
  const d = useDict();
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
    smoothingDemo,
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
          <div className="chart-grid density-cluster" aria-label={d.panels.densityClusterLabel}>
            <BorderRasterCloseup
              features={features}
              grid={grid}
              bbox={WEST_AFRICA_BBOX}
              title={d.panels.westAfrica}
              id="border-raster-closeup-west-africa"
              colorBy="country"
              neighborsByM49={neighborsByM49}
            />
            <BorderRasterCloseup
              features={features}
              grid={grid}
              bbox={BENELUX_BBOX}
              title={d.panels.benelux}
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
            features={features}
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
        "[smoothing explainer]": <SmoothingExplainer data={smoothingDemo} />,
        "[proxy ranking card]": <ProxyRankingCard />,
        "[latitude scatter]": (
          <ProxyFigure proxyIndex={PROXY.latitude} title={d.panels.figureLatitude}>
            <LatitudeScatter
              unified={unified}
              features={features}
              regions={regions}
              admin1Features={admin1Features}
            />
          </ProxyFigure>
        ),
        "[koppen scatter]": (
          <ProxyFigure proxyIndex={PROXY.climate} title={d.panels.figureClimate}>
            <KoppenGeigerScatter
              unified={unified}
              proxies={proxies}
              features={features}
              regions={regions}
            />
          </ProxyFigure>
        ),
        "[pop65 scatter]": (
          <ProxyFigure proxyIndex={PROXY.pop65} title={d.panels.figurePop65}>
            <Pop65Scatter unified={unified} proxies={proxies} features={features} />
          </ProxyFigure>
        ),
        "[gdp scatter]": (
          <ProxyFigure proxyIndex={PROXY.gdp} title={d.panels.figureGdp}>
            <GdpScatter unified={unified} proxies={proxies} features={features} />
          </ProxyFigure>
        ),
        "[neighbour scatter]": (
          <ProxyFigure proxyIndex={PROXY.neighbour} title={d.panels.figureNeighbour}>
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
        "[proxy scorecard]": (
          <ProxyScorecard
            unified={unified}
            proxies={proxies}
            features={features}
            neighborsByM49={neighborsByM49}
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
            <h3 className="chart-title">{d.panels.samplingOrder}</h3>
            <PersonaDemo />
          </section>
        ),
        "[deaths by age and cause]": (
          <div className="chart-grid" aria-label={d.panels.deathsByAgeCauseLabel}>
            <section className="chart-panel wide">
              <h3 className="chart-title">{d.panels.deathsByAgeCauseTitle}</h3>
              <p className="chart-copy">{d.panels.deathsByAgeCauseCopy}</p>
              <AgeMix />
            </section>
          </div>
        ),
        "[what the clock got wrong]": <ConceptTiles set="clock" />,
      },

      "back-to-the-globe": {
        "[pull up for the globe]": <PullToGlobe />,
      },

      conflicts: {
        "[widget to update half life, curve smoothness, and see prediction]": (
          <div className="chart-grid" aria-label={d.panels.ewmaLabel}>
            <section className="chart-panel wide">
              <h3 className="chart-title">{d.panels.ewmaTitle}</h3>
              <p className="chart-copy">{d.panels.ewmaCopy}</p>
              <ConflictEwmaWidget dailyStack={conflicts?.dailyStack} />
            </section>
          </div>
        ),
        "[map of conflict fatalities]": (
          <div className="chart-grid" aria-label={d.panels.conflictMapLabel}>
            <section className="chart-panel wide">
              <h3 className="chart-title">{d.panels.conflictMapTitle}</h3>
              <p className="chart-copy">{d.panels.conflictMapCopy}</p>
              <ConflictMap conflicts={conflicts} features={features} />
            </section>
          </div>
        ),
      },
    }),
    [
      d,
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
      smoothingDemo,
      subnationalLoo,
    ],
  );
}
