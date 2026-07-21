"use client";

import AmplitudeMap from "../charts/AmplitudeMap";
import CountryCurves from "../charts/CountryCurves";
import FallbackDonorCoverageTable from "../charts/FallbackDonorCoverageTable";
import GdpScatter from "../charts/GdpScatter";
import KoppenGeigerScatter from "../charts/KoppenGeigerScatter";
import LatitudeScatter from "../charts/LatitudeScatter";
import NeighbourScatter from "../charts/NeighbourScatter";
import Pop65Scatter from "../charts/Pop65Scatter";
import PredictionComparison from "../charts/PredictionComparison";
import RegionNeighbourScatter from "../charts/RegionNeighbourScatter";
import RegionPredictionComparison from "../charts/RegionPredictionComparison";
import SeasonalityProxyTable from "../charts/SeasonalityProxyTable";
import RoadmapMarkdown from "../roadmapMarkdown";
import type {
  Admin1Feature,
  CountryFeature,
  LooValidation,
  NeighborsByM49,
  RegionNeighborsByCode,
  SeasonalityData,
  SeasonalityProxies,
  SubnationalLoo,
  SubnationalSeasonality,
} from "../types";

interface Step5SeasonalMortalityProps {
  features: CountryFeature[] | null;
  neighborsByM49: NeighborsByM49 | null;
  activeSeasonality: SeasonalityData | null;
  unified: SeasonalityData | null;
  proxies: SeasonalityProxies | null;
  looValidation: LooValidation | null;
  admin1Features: Admin1Feature[] | null;
  subnationalSeasonality: SubnationalSeasonality | null;
  subnationalLoo: SubnationalLoo | null;
  regionNeighbors: RegionNeighborsByCode | null;
  copy: string;
}

export default function Step5SeasonalMortality({
  features,
  neighborsByM49,
  activeSeasonality,
  unified,
  proxies,
  looValidation,
  admin1Features,
  subnationalSeasonality,
  subnationalLoo,
  regionNeighbors,
  copy,
}: Step5SeasonalMortalityProps) {
  const subnationalRegions = subnationalSeasonality?.regions ?? null;
  return (
    <li className="step done">
      <span className="ring" aria-hidden="true" />
      <div className="step-body">
        <h3>
          <span className="num">5</span> Death Rate By Time Of Year
        </h3>
        <div className="seasonality-explainer">
          <RoadmapMarkdown
            source={copy}
            slots={{
              "[similar curves chart]": (
                <div className="chart-grid" aria-label="Similar seasonal mortality curves">
                  <CountryCurves seasonality={activeSeasonality} features={features} />
                </div>
              ),
              "[seasonality proxy table]": <SeasonalityProxyTable />,
              "[latitude scatter chart]": (
                <LatitudeScatter
                  unified={unified}
                  features={features}
                  regions={subnationalRegions}
                  admin1Features={admin1Features}
                />
              ),
              "[amplitude by climate zone scatter]": (
                <KoppenGeigerScatter unified={unified} proxies={proxies} features={features} />
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
                  <FallbackDonorCoverageTable
                    features={features}
                    seasonality={activeSeasonality}
                    proxies={proxies}
                    neighborsByM49={neighborsByM49}
                    regions={subnationalRegions}
                    admin1Features={admin1Features}
                  />
                </div>
              ),
              "[region amplitude by neighbouring regions scatter]": (
                <RegionNeighbourScatter
                  regions={subnationalRegions}
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
                      subnationalRegions?.filter(
                        (r) => r.geo === "adm1" && r.measurement !== "climate-modeled",
                      ).length ?? 0
                    }
                  />
                </div>
              ),
            }}
          />

          <div className="chart-grid" aria-label="Seasonal mortality amplitude map">
            <section className="chart-panel wide">
              <h4 className="chart-title">Amplitude By Country And Region</h4>
              <p className="chart-copy">
                Every rendered country is colored by seasonal amplitude: observed curves where
                available, measured regions where a national curve is missing, and bordering
                measured countries otherwise. Islands and countries without a measured bordering
                donor use the latitude model. Measured Admin-1 regions are colored by their own
                observed amplitude, showing the variation a national curve hides. Calculated country
                fills are striped; those without an observed bordering donor are checkered.
                Observations are solid.
              </p>
              <AmplitudeMap
                seasonality={activeSeasonality}
                features={features}
                neighborsByM49={neighborsByM49}
                regions={subnationalRegions}
                admin1Features={admin1Features}
              />
            </section>
          </div>
        </div>
      </div>
    </li>
  );
}
