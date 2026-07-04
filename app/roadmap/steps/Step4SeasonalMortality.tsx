"use client";

import CountryCurves from "../charts/CountryCurves";
import CountryAmplitudeMap from "../charts/CountryAmplitudeMap";
import SeasonalCurve from "../charts/SeasonalCurve";
import LatitudeCorrelation from "../charts/LatitudeCorrelation";
import type { CountryFeature, SeasonalityData } from "../types";

interface Step4SeasonalMortalityProps {
  features: CountryFeature[] | null;
  activeSeasonality: SeasonalityData | null;
  unified: SeasonalityData | null;
  seasonalityStatusText: string;
}

export default function Step4SeasonalMortality({
  features,
  activeSeasonality,
  unified,
  seasonalityStatusText,
}: Step4SeasonalMortalityProps) {
  return (
    <li className="step done">
      <span className="ring" aria-hidden="true" />
      <div className="step-body">
        <h3>
          <span className="num">4</span> Death Rate By Time Of Year
        </h3>
        <p>
          Mortality varies by season — winter respiratory and cardiovascular excess, and summer heat
          deaths.
        </p>
        <span className="source">
          Source: UN Demographic Yearbook monthly deaths, with a latitude-scaled fallback for
          countries without monthly reports.
        </span>
        <div className="seasonality-explainer">
          <p>
            The seasonal layer keeps each country&apos;s annual death total unchanged. It only
            redistributes timing across months: a factor above 1 means deaths fire faster than the
            annual average, and a factor below 1 means they fire slower. Today that&apos;s a direct,
            measured curve for 27 countries with stable UN monthly data — everyone else uses a
            latitude-scaled fallback instead, since winter deviation strengthens outside the tropics
            and (in the current model) plateaus around mid-latitudes.
          </p>
          <p>
            But what should the other ~170 countries without direct monthly data do? Two richer
            sources are under evaluation to shrink that gap: the{" "}
            <a href="https://www.mortality.org/Data/STMF" target="_blank" rel="noopener">
              Human Mortality Database&apos;s Short-Term Mortality Fluctuations
            </a>{" "}
            series (weekly deaths, 38 countries including the US, France, and Australia) and the{" "}
            <a href="https://github.com/akarlinsky/world_mortality" target="_blank" rel="noopener">
              World Mortality Dataset
            </a>{" "}
            (weekly or monthly, 100+ countries/territories). Folding both in — see{" "}
            <code>notebooks/seasonality.ipynb</code> — would raise direct-curve coverage from 27 to
            around 90 countries. For whoever is left, the same analysis found the fallback&apos;s
            flat-then-plateau latitude ramp underfits the real pattern: amplitude actually peaks
            near 40° and tapers off closer to the poles, rather than staying flat past 40° as the
            current fallback assumes — so the fallback itself is also due for a fix.
          </p>
          <div className="chart-grid" aria-label="Seasonal mortality charts">
            <CountryCurves seasonality={activeSeasonality} />
            {unified && (
              <section className="chart-panel wide">
                <h4 className="chart-title">Seasonal Mortality Amplitude (Unified)</h4>
                <p className="chart-copy">
                  Every country with a measured curve from the notebook&apos;s unified sources,
                  colored by its own seasonal amplitude — 87 countries instead of the 27 in{" "}
                  <code>data/seasonality.json</code>. Grey still means no direct data.
                </p>
                <CountryAmplitudeMap
                  seasonality={unified}
                  features={features}
                  domId="unified-amplitude-map-chart"
                  ariaLabel="World map with each country colored by its seasonal mortality amplitude, using the notebook's unified multi-source dataset"
                />
              </section>
            )}
            <SeasonalCurve seasonality={activeSeasonality} />
            <LatitudeCorrelation unified={activeSeasonality} features={features} />
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
          <p id="seasonality-chart-status" className="chart-status" aria-live="polite">
            {seasonalityStatusText}
          </p>
        </div>
      </div>
    </li>
  );
}
