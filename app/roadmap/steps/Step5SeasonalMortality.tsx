"use client";

import ClimateZoneCurves from "../charts/ClimateZoneCurves";
import CountryAmplitudeMap from "../charts/CountryAmplitudeMap";
import CountryCurves from "../charts/CountryCurves";
import GdpScatter from "../charts/GdpScatter";
import KoppenGeigerScatter from "../charts/KoppenGeigerScatter";
import LatitudeCorrelation from "../charts/LatitudeCorrelation";
import NeighbourScatter from "../charts/NeighbourScatter";
import Pop65Scatter from "../charts/Pop65Scatter";
import PredictionComparison from "../charts/PredictionComparison";
import SeasonalityProxyTable from "../charts/SeasonalityProxyTable";
import TemperatureVsMortality from "../charts/TemperatureVsMortality";
import RoadmapMarkdown from "../roadmapMarkdown";
import type {
  CountryFeature,
  LooValidation,
  NeighborsByM49,
  SeasonalityData,
  SeasonalityProxies,
  TemperatureCurves,
} from "../types";

interface Step5SeasonalMortalityProps {
  features: CountryFeature[] | null;
  neighborsByM49: NeighborsByM49 | null;
  activeSeasonality: SeasonalityData | null;
  unified: SeasonalityData | null;
  proxies: SeasonalityProxies | null;
  temperatureCurves: TemperatureCurves | null;
  looValidation: LooValidation | null;
  copy: string;
}

export default function Step5SeasonalMortality({
  features,
  neighborsByM49,
  activeSeasonality,
  unified,
  proxies,
  temperatureCurves,
  looValidation,
  copy,
}: Step5SeasonalMortalityProps) {
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
              "[temperature vs mortality chart]": (
                <div className="chart-grid" aria-label="Temperature versus seasonal mortality">
                  <TemperatureVsMortality
                    seasonality={activeSeasonality}
                    temperatureCurves={temperatureCurves}
                    features={features}
                  />
                </div>
              ),
              "[amplitude by latitude scatter]": (
                <div className="chart-grid" aria-label="Amplitude versus latitude">
                  <LatitudeCorrelation unified={unified} proxies={proxies} features={features} />
                </div>
              ),
              "[amplitude by climate zone scatter]": (
                <div className="chart-grid" aria-label="Amplitude by climate zone">
                  <KoppenGeigerScatter unified={unified} proxies={proxies} features={features} />
                </div>
              ),
              "[amplitude by age over 65 scatter]": (
                <div className="chart-grid" aria-label="Amplitude versus population aged 65+">
                  <Pop65Scatter unified={unified} proxies={proxies} features={features} />
                </div>
              ),
              "[amplitude by gdp pc scatter]": (
                <div className="chart-grid" aria-label="Amplitude versus GDP per capita">
                  <GdpScatter unified={unified} proxies={proxies} features={features} />
                </div>
              ),
              "[amplitude by neighbouring countries scatter]": (
                <div className="chart-grid" aria-label="Amplitude versus neighbouring countries">
                  <NeighbourScatter
                    unified={unified}
                    features={features}
                    neighborsByM49={neighborsByM49}
                  />
                </div>
              ),
              "[prediction comparison chart]": (
                <div className="chart-grid" aria-label="Predictions versus measured seasonal curve">
                  <PredictionComparison looValidation={looValidation} />
                </div>
              ),
              "[climate zone curves]": (
                <div
                  className="chart-grid"
                  aria-label="Seasonal mortality reconstruction by climate zone"
                >
                  <ClimateZoneCurves looValidation={looValidation} />
                </div>
              ),
            }}
          />

          <div className="chart-grid" aria-label="Seasonal mortality amplitude maps">
            {unified && (
              <section className="chart-panel wide">
                <h4 className="chart-title">Seasonal Mortality Amplitude (Unified)</h4>
                <p className="chart-copy">
                  Every country with a measured curve from the notebook&apos;s unified sources,
                  colored by its own seasonal amplitude. Grey still means no direct data.
                </p>
                <CountryAmplitudeMap
                  seasonality={unified}
                  features={features}
                  domId="unified-amplitude-map-chart"
                  ariaLabel="World map with each country colored by its seasonal mortality amplitude, using the notebook's unified multi-source dataset"
                />
              </section>
            )}
            <section className="chart-panel wide">
              <h4 className="chart-title">Amplitude By Country</h4>
              <p className="chart-copy">
                Every rendered country is colored by seasonal amplitude: observed curves where
                available, and the fitted latitude fallback everywhere else. Borders are removed so
                the map reads as a continuous amplitude surface.
              </p>
              <CountryAmplitudeMap
                seasonality={activeSeasonality}
                features={features}
                domId="country-amplitude-map-chart"
                ariaLabel="World map with every country colored by observed or calculated seasonal mortality amplitude"
                includeFallback
              />
            </section>
          </div>
        </div>
      </div>
    </li>
  );
}
