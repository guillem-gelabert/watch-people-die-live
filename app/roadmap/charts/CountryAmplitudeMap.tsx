"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { fmtPlainPct, strength, fallbackAmplitudeForLat } from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import type { CountryFeature, SeasonalityData } from "../types";

interface Row {
  feature: CountryFeature;
  hasData: boolean;
  amplitude: number | null;
}

interface CountryAmplitudeMapProps {
  seasonality: SeasonalityData | null;
  features: CountryFeature[] | null;
  domId: string;
  ariaLabel: string;
  includeFallback?: boolean;
}

// Charts 4 & 7: choropleth of seasonal amplitude by country. Shared between the
// "Amplitude By Country" chart (includeFallback: calculated fallback fills the rest)
// and the "Seasonal Mortality Amplitude (Unified)" chart (observed-only, grey rest).
export default function CountryAmplitudeMap({
  seasonality,
  features,
  domId,
  ariaLabel,
  includeFallback = false,
}: CountryAmplitudeMapProps) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!seasonality || !features || !ref.current) return;
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

    const rows: Row[] = features.map((feature) => {
      const own = seasonality.countries[String(Number(feature.id))];
      const hasData = Boolean(own);
      const lat = d3.geoCentroid(feature)[1];
      return {
        feature,
        hasData,
        amplitude: hasData
          ? strength(own!)
          : includeFallback
            ? fallbackAmplitudeForLat(lat, seasonality)
            : null,
      };
    });
    const maxAmp = d3.max(rows, (d) => d.amplitude ?? undefined) || 0.001;
    const color = d3
      .scaleSequential()
      .domain([0, maxAmp])
      .interpolator(d3.interpolateRgb("#233142", "#ff6b6b"));

    svg
      .append("path")
      .datum<d3.GeoSphere>({ type: "Sphere" })
      .attr("d", path)
      .attr("fill", "rgba(255,255,255,0.025)")
      .attr("stroke", "rgba(255,255,255,0.16)");
    svg
      .append("g")
      .selectAll("path")
      .data(rows)
      .join("path")
      .attr("class", (d) =>
        d.amplitude == null
          ? "map-country"
          : d.hasData
            ? "map-country-fill has-data"
            : "map-country-fill is-calculated",
      )
      .attr("fill", (d) => (d.amplitude == null ? null : color(d.amplitude)))
      .attr("d", (d) => path(d.feature))
      .on("pointermove", (event, d) => {
        const name = d.feature.properties?.name ?? "Unknown";
        const text =
          d.amplitude == null
            ? `${name}: no direct monthly data`
            : `${name}: ${fmtPlainPct(d.amplitude)} (${d.hasData ? "observed" : "calculated fallback"})`;
        showTooltip(text, event.clientX, event.clientY);
      })
      .on("pointerleave", hideTooltip);

    const legendX = width - 260;
    const legendY = height - 32;
    const legendW = 210;
    const defs = svg.append("defs");
    const gradientId = `${domId.replace(/[^a-z0-9_-]/gi, "")}-gradient`;
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
  }, [seasonality, features, domId, includeFallback]);

  return (
    <svg
      ref={ref}
      id={domId}
      className="seasonality-chart"
      viewBox="0 0 860 360"
      role="img"
      aria-label={ariaLabel}
    />
  );
}
