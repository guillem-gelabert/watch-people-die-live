"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import {
  buildSpatialSeasonality,
  type SpatialSeasonalityEstimate,
} from "@/lib/spatial-seasonality";
import { fmtPlainPct, strength } from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
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
}

interface AmplitudeMapProps {
  seasonality: SeasonalityData | null;
  features: CountryFeature[] | null;
  neighborsByM49: NeighborsByM49 | null;
  regions: SubnationalSeasonalityRegion[] | null;
  admin1Features: Admin1Feature[] | null;
}

// Every country colored by seasonal amplitude — observed curve where available, then own
// measured regions, bordering measured countries, or the latitude fallback — with
// measured Admin-1 regions drawn on top at their own finer amplitude.
export default function AmplitudeMap({
  seasonality,
  features,
  neighborsByM49,
  regions,
  admin1Features,
}: AmplitudeMapProps) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!seasonality || !features || !neighborsByM49 || !ref.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const width = 860;
    const height = 360;
    const projection = d3.geoEqualEarth().fitExtent(
      [
        [18, 18],
        [width - 18, height - 18],
      ],
      { type: "Sphere" },
    );
    const path = d3.geoPath(projection);

    const estimates = buildSpatialSeasonality(features, neighborsByM49, seasonality, regions ?? []);
    const countryRows: CountryRow[] = features.flatMap((feature) => {
      const estimate = estimates.get(Number(feature.id));
      return estimate ? [{ feature, estimate, amplitude: strength(estimate.curve) }] : [];
    });

    const regionRows: RegionRow[] = [];
    if (regions && admin1Features) {
      const ampByCode = new Map<string, { amp: number; region: SubnationalSeasonalityRegion }>();
      for (const r of regions) {
        if (r.geo === "adm1") {
          ampByCode.set(r.key, { amp: strength(r.curve), region: r });
        }
      }
      for (const feature of admin1Features) {
        const hit = ampByCode.get(feature.properties?.adm1_code ?? "");
        if (hit) regionRows.push({ feature, amplitude: hit.amp, region: hit.region });
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
      .interpolator(d3.interpolateRgb("#233142", "#ff6b6b"));
    const defs = svg.append("defs");
    const stripeId = "amplitude-map-calculated-stripes";
    const stripes = defs
      .append("pattern")
      .attr("id", stripeId)
      .attr("patternUnits", "userSpaceOnUse")
      .attr("width", 7)
      .attr("height", 7)
      .attr("patternTransform", "rotate(45)");
    stripes
      .append("rect")
      .attr("width", 2.2)
      .attr("height", 7)
      .attr("fill", "rgba(10, 16, 28, 0.62)");
    const crossStripeId = "amplitude-map-no-neighbour-cross-stripes";
    const crossStripes = defs
      .append("pattern")
      .attr("id", crossStripeId)
      .attr("patternUnits", "userSpaceOnUse")
      .attr("width", 7)
      .attr("height", 7)
      .attr("patternTransform", "rotate(-45)");
    crossStripes
      .append("rect")
      .attr("width", 2.2)
      .attr("height", 7)
      .attr("fill", "rgba(10, 16, 28, 0.62)");

    svg
      .append("path")
      .datum<d3.GeoSphere>({ type: "Sphere" })
      .attr("d", path)
      .attr("fill", "rgba(255,255,255,0.025)")
      .attr("stroke", "rgba(255,255,255,0.16)");

    svg
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
                : `calculated from latitude fallback: ${d.estimate.donorNames[0]}`;
        showTooltip(
          `${name}: ${fmtPlainPct(d.amplitude)} (${source})`,
          event.clientX,
          event.clientY,
        );
      })
      .on("pointerleave", hideTooltip);

    // A separate pointer-transparent overlay preserves each estimate's amplitude color
    // while giving every calculated country the same unmistakable diagonal stripe encoding.
    svg
      .append("g")
      .selectAll("path")
      .data(countryRows.filter((d) => d.estimate.source !== "observed"))
      .join("path")
      .attr("class", "map-country-stripes")
      .attr("fill", `url(#${stripeId})`)
      .attr("d", (d) => path(d.feature));

    // Countries without an observed bordering donor use the latitude fallback.
    // Add the opposing diagonal on top of the standard estimate hatch so they read as checkered.
    svg
      .append("g")
      .selectAll("path")
      .data(countryRows.filter((d) => d.estimate.source === "latitude"))
      .join("path")
      .attr("class", "map-country-stripes")
      .attr("fill", `url(#${crossStripeId})`)
      .attr("d", (d) => path(d.feature));

    // Finer region fills for the measured sub-national countries, drawn on top of their country's fill.
    svg
      .append("g")
      .selectAll("path")
      .data(regionRows)
      .join("path")
      .attr("class", "map-country-fill has-data")
      .attr("fill", (d) => color(d.amplitude))
      .attr("d", (d) => path(d.feature))
      .on("pointermove", (event, d) => {
        const imp = d.region.imputed ? ` · imputed from ${d.region.imputedFrom?.join(", ")}` : "";
        showTooltip(
          `${d.region.name} (${d.region.country}): ${fmtPlainPct(d.amplitude)} amplitude${imp}`,
          event.clientX,
          event.clientY,
        );
      })
      .on("pointerleave", hideTooltip);

    const legendX = width - 260;
    const legendY = height - 32;
    const legendW = 210;
    const gradientId = "amplitude-map-gradient";
    const gradient = defs
      .append("linearGradient")
      .attr("id", gradientId)
      .attr("x1", "0%")
      .attr("x2", "100%");
    d3.range(0, 1.01, 0.1).forEach((t) => {
      gradient
        .append("stop")
        .attr("offset", `${t * 100}%`)
        .attr("stop-color", color(t * maxAmp));
    });
    svg
      .append("rect")
      .attr("x", legendX)
      .attr("y", legendY)
      .attr("width", legendW)
      .attr("height", 8)
      .attr("rx", 4)
      .attr("fill", `url(#${gradientId})`);
    svg
      .append("text")
      .attr("class", "chart-label")
      .attr("x", legendX)
      .attr("y", legendY - 7)
      .text("monthly deviation strength");
    svg
      .append("text")
      .attr("class", "chart-label")
      .attr("x", legendX)
      .attr("y", legendY + 24)
      .text("0%");
    svg
      .append("text")
      .attr("class", "chart-label")
      .attr("x", legendX + legendW)
      .attr("y", legendY + 24)
      .attr("text-anchor", "end")
      .text(fmtPlainPct(maxAmp));

    const estimateLegendX = 28;
    const estimateLegendY = height - 29;
    svg
      .append("rect")
      .attr("x", estimateLegendX)
      .attr("y", estimateLegendY)
      .attr("width", 22)
      .attr("height", 10)
      .attr("rx", 2)
      .attr("fill", color(maxAmp * 0.55));
    svg
      .append("rect")
      .attr("x", estimateLegendX)
      .attr("y", estimateLegendY)
      .attr("width", 22)
      .attr("height", 10)
      .attr("rx", 2)
      .attr("fill", `url(#${stripeId})`);
    svg
      .append("text")
      .attr("class", "chart-label")
      .attr("x", estimateLegendX + 30)
      .attr("y", estimateLegendY + 9)
      .text("spatial estimate");

    const noNeighborLegendX = 180;
    svg
      .append("rect")
      .attr("x", noNeighborLegendX)
      .attr("y", estimateLegendY)
      .attr("width", 22)
      .attr("height", 10)
      .attr("rx", 2)
      .attr("fill", color(maxAmp * 0.55));
    for (const patternId of [stripeId, crossStripeId]) {
      svg
        .append("rect")
        .attr("x", noNeighborLegendX)
        .attr("y", estimateLegendY)
        .attr("width", 22)
        .attr("height", 10)
        .attr("rx", 2)
        .attr("fill", `url(#${patternId})`);
    }
    svg
      .append("text")
      .attr("class", "chart-label")
      .attr("x", noNeighborLegendX + 30)
      .attr("y", estimateLegendY + 9)
      .text("no observed neighbour");
  }, [seasonality, features, neighborsByM49, regions, admin1Features]);

  return (
    <svg
      ref={ref}
      id="amplitude-map-chart"
      className="seasonality-chart"
      viewBox="0 0 860 360"
      role="img"
      aria-label="World map with every country colored by observed or spatially estimated seasonal mortality amplitude, with measured Admin-1 regions colored by their own finer amplitude"
    />
  );
}
