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
import { useFigureWidth } from "./useFigureSize";
import { useSkin } from "../SkinContext";
import { harmony } from "../palette";
import { appendMapPlate, fitRegionProjection, type Bbox } from "./basemap";
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

// Seven shades of the section's hue: the same ramp depth the two rate maps upstream use.
const RAMP_STEPS = 7;

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

// Africa, cropped square around the same centre — the panel is square at every width now, so
// there is only one crop to keep.
const BBOX: Bbox = [
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
  const { sky } = useSkin();
  const [legend, setLegend] = useState<AmpLegend | null>(null);
  const [sizeRef, measured] = useFigureWidth<SVGSVGElement>();
  // Square, at exactly the width the column gave it: the column's own max-width is the bound, so
  // the viewBox always equals the rendered size and nothing is scaled.
  const width = measured;
  const height = width;

  useEffect(() => {
    if (!seasonality || !features || !neighborsByM49 || !ref.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const projection = fitRegionProjection(BBOX, width, height);
    const path = d3.geoPath(projection);
    const content = appendMapPlate(svg, width, height, "amplitude-map");

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
    // Shades of the section's own hue rather than a fixed navy-to-red: this is the last map of the
    // seasonality chapter and it has to belong to the same palette as the charts that argued for it.
    const ramp = harmony(RAMP_STEPS, sky);
    const color = (amplitude: number) => {
      const t = Math.min(1, Math.max(0, amplitude / maxAmp));
      return ramp[RAMP_STEPS - 1 - Math.round(t * (RAMP_STEPS - 1))] as string;
    };

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
      // Stroked in its own fill colour, which is what closes the hairlines between neighbours. Two
      // adjacent polygons share an edge exactly, and each antialiases to about half coverage there, so
      // the halves do not add back up to one and the plate reads through as a thin dark line along
      // every border. A stroke of the same colour restores the coverage; because it is the polygon's
      // own colour it cannot show up as an outline, and at half a unit the encroachment onto a
      // neighbour is far below what the seam it removes was costing.
      .attr("stroke", (d) => color(d.amplitude))
      .attr("stroke-width", 0.5)
      .attr("stroke-linejoin", "round")
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
      // Same self-stroke as the country layer above, for the same reason: adjacent regions meet
      // exactly and would otherwise show the plate between them.
      .attr("stroke", (d) => color(d.amplitude))
      .attr("stroke-width", 0.5)
      .attr("stroke-linejoin", "round")
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
    width,
    height,
    sky,
  ]);

  return (
    <>
      <svg
        ref={(node) => {
          ref.current = node;
          sizeRef(node);
        }}
        id="amplitude-map-chart"
        className="story-figure"
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
