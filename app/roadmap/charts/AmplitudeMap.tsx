"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import {
  buildSpatialSeasonality,
  type AppliedFallbackCurve,
  type AppliedSeasonalityFallbacks,
  type SpatialSeasonalityEstimate,
} from "@/lib/spatial-seasonality";
import { fmtPlainPct, strength } from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import { appendGrayEarthBasemap, fitRegionProjection, useIsMobileMap, type Bbox } from "./basemap";
import type {
  Admin1Feature,
  CountryFeature,
  NeighborsByM49,
  SeasonalityData,
  SubnationalSeasonalityRegion,
} from "../types";

interface CountryRow {
  feature: CountryFeature;
  estimate: SpatialSeasonalityEstimate;
  amplitude: number;
}

interface RegionRow {
  feature: Admin1Feature;
  amplitude: number;
  region: SubnationalSeasonalityRegion;
  appliedFallback?: AppliedFallbackCurve;
}

interface AmplitudeMapProps {
  seasonality: SeasonalityData | null;
  features: CountryFeature[] | null;
  neighborsByM49: NeighborsByM49 | null;
  regions: SubnationalSeasonalityRegion[] | null;
  admin1Features: Admin1Feature[] | null;
  appliedFallbacks: AppliedSeasonalityFallbacks | null;
}

interface AmpLegend {
  maxLabel: string;
  gradient: string;
}

// Africa.
const BBOX: Bbox = [
  [-20, -35],
  [52, 38],
];
const MOBILE_SIZE = 430;

// Same center as BBOX, cropped to a square and zoomed in for the 1:1 mobile panel.
const MOBILE_BBOX: Bbox = [
  [-11, -25.5],
  [43, 28.5],
];

// Every country colored by seasonal amplitude — observed curve where available, then own
// measured regions, bordering measured countries, or the latitude fallback — with
// measured Admin-1 regions drawn on top at their own finer amplitude.
export default function AmplitudeMap({
  seasonality,
  features,
  neighborsByM49,
  regions,
  admin1Features,
  appliedFallbacks,
}: AmplitudeMapProps) {
  const ref = useRef<SVGSVGElement | null>(null);
  const [legend, setLegend] = useState<AmpLegend | null>(null);
  const isMobile = useIsMobileMap();
  const width = isMobile ? MOBILE_SIZE : 860;
  const height = isMobile ? MOBILE_SIZE : 430;
  const bbox = isMobile ? MOBILE_BBOX : BBOX;

  useEffect(() => {
    if (!seasonality || !features || !neighborsByM49 || !ref.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const projection = fitRegionProjection(bbox, width, height);
    const path = d3.geoPath(projection);
    const content = appendGrayEarthBasemap(svg, projection, width, height, "amplitude-map");

    const estimates = buildSpatialSeasonality(
      features,
      neighborsByM49,
      seasonality,
      regions ?? [],
      appliedFallbacks,
    );
    const countryRows: CountryRow[] = features.flatMap((feature) => {
      const estimate = estimates.get(Number(feature.id));
      return estimate ? [{ feature, estimate, amplitude: strength(estimate.curve) }] : [];
    });

    const regionRows: RegionRow[] = [];
    if (regions && admin1Features) {
      const ampByCode = new Map<
        string,
        {
          amp: number;
          region: SubnationalSeasonalityRegion;
          appliedFallback?: AppliedFallbackCurve;
        }
      >();
      for (const r of regions) {
        if (r.geo === "adm1") {
          const appliedFallback = appliedFallbacks?.regions[r.key];
          ampByCode.set(r.key, {
            amp: strength(appliedFallback?.curve ?? r.curve),
            region: r,
            ...(appliedFallback ? { appliedFallback } : {}),
          });
        }
      }
      for (const feature of admin1Features) {
        const hit = ampByCode.get(feature.properties?.adm1_code ?? "");
        if (hit) regionRows.push({ feature, amplitude: hit.amp, ...hit });
      }
    }

    const maxAmp =
      Math.max(
        d3.max(countryRows, (d) => d.amplitude) ?? 0,
        d3.max(regionRows, (d) => d.amplitude) ?? 0,
      ) || 0.001;
    const color = d3
      .scaleSequential()
      .domain([0, maxAmp])
      .interpolator(d3.interpolateRgb("#233142", "#ff3b30"));

    content
      .append("g")
      .selectAll("path")
      .data(countryRows)
      .join("path")
      .attr("class", (d) =>
        d.estimate.source === "observed"
          ? "map-country-fill has-data"
          : "map-country-fill is-calculated",
      )
      .attr("fill", (d) => color(d.amplitude))
      .attr("d", (d) => path(d.feature))
      .on("pointermove", (event, d) => {
        const name = d.feature.properties?.name ?? "Unknown";
        const source =
          d.estimate.source === "observed"
            ? "observed"
            : d.estimate.source === "own-regions"
              ? `calculated from ${d.estimate.donorNames.length} measured regions`
              : d.estimate.source === "bordering-countries"
                ? `calculated from bordering countries: ${d.estimate.donorNames.join(", ")}`
                : d.estimate.source === "climate"
                  ? `estimated from climate: ${d.estimate.donorNames[0]}`
                  : `calculated from latitude fallback: ${d.estimate.donorNames[0]}`;
        showTooltip(
          `${name}: ${fmtPlainPct(d.amplitude)} (${source})`,
          event.clientX,
          event.clientY,
        );
      })
      .on("pointerleave", hideTooltip);

    // Finer region fills drawn on top of their country's fill. Measured regions read as data;
    // India/China are climate-modeled estimates, so they carry the same "is-calculated" class.
    content
      .append("g")
      .selectAll("path")
      .data(regionRows)
      .join("path")
      .attr("class", (d) =>
        d.region.measurement === "climate-modeled"
          ? "map-country-fill is-calculated"
          : "map-country-fill has-data",
      )
      .attr("fill", (d) => color(d.amplitude))
      .attr("d", (d) => path(d.feature))
      .on("pointermove", (event, d) => {
        const note =
          d.region.measurement === "climate-modeled"
            ? ` · ${d.appliedFallback?.proxy.toLowerCase() ?? "climate"} estimate${d.appliedFallback?.overridden ? " (manual override)" : ""}`
            : d.region.imputed
              ? ` · imputed from ${d.region.imputedFrom?.join(", ")}`
              : "";
        showTooltip(
          `${d.region.name} (${d.region.country}): ${fmtPlainPct(d.amplitude)} amplitude${note}`,
          event.clientX,
          event.clientY,
        );
      })
      .on("pointerleave", hideTooltip);

    setLegend({
      maxLabel: fmtPlainPct(maxAmp),
      gradient: `linear-gradient(to right, ${d3
        .range(0, 1.01, 0.1)
        .map((t) => color(t * maxAmp))
        .join(", ")})`,
    });
  }, [
    seasonality,
    features,
    neighborsByM49,
    regions,
    admin1Features,
    appliedFallbacks,
    bbox,
    width,
    height,
  ]);

  return (
    <>
      <svg
        ref={ref}
        id="amplitude-map-chart"
        className="seasonality-chart map-bleed"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Map of Africa with every country colored by observed or spatially estimated seasonal mortality amplitude, with measured Admin-1 regions colored by their own finer amplitude"
      />
      {legend && (
        <div className="amplitude-legend" aria-hidden="true">
          <div className="amplitude-legend-scale">
            <span>0%</span>
            <span className="amplitude-legend-bar" style={{ background: legend.gradient }} />
            <span>{legend.maxLabel}</span>
            <span className="amplitude-legend-caption">monthly deviation strength</span>
          </div>
        </div>
      )}
    </>
  );
}
