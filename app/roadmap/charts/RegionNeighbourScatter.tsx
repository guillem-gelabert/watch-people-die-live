"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { fmtPlainPct, pearson, strength, styleAxis } from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import { labelRepresentatives, namedCountryOf, representatives } from "./representatives";
import { attachTapPicker } from "./touchPick";
import { figureHeight, useFigureWidth } from "./useFigureSize";
import { useDict } from "../I18nContext";
import type {
  CountryFeature,
  NeighborsByM49,
  RegionNeighborsByCode,
  SeasonalityData,
  SubnationalSeasonalityRegion,
} from "../types";

interface Row {
  name: string;
  // ISO3, or "" for the country series, whose points carry no name to offer.
  country: string;
  amplitude: number;
  neighborMean: number;
}

// A square frame: both axes are the same quantity, so equal scales are the point.
const SHAPE = { aspect: 0.78, min: 250, max: 340 };

interface RegionNeighbourScatterProps {
  regions: SubnationalSeasonalityRegion[] | null;
  regionNeighbors: RegionNeighborsByCode | null;
  unified: SeasonalityData | null;
  features: CountryFeature[] | null;
  neighborsByM49: NeighborsByM49 | null;
}

// Region-level analog of NeighbourScatter. Only Admin-1 regions participate; partido rows have
// no checked-in boundary topology and therefore cannot enter a border calculation.
export default function RegionNeighbourScatter({
  regions,
  regionNeighbors,
  unified,
  features,
  neighborsByM49,
}: RegionNeighbourScatterProps) {
  const t = useDict().charts.regionNeighbourScatter;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [sizeRef, WIDTH] = useFigureWidth<SVGSVGElement>();
  const HEIGHT = figureHeight(WIDTH, SHAPE);
  // The dots are .chart-point, which reads --accent; the legend now resolves the same value.
  const accent = "var(--red)";
  const legendRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!regions || !regionNeighbors || !unified || !features || !neighborsByM49 || !svgRef.current)
      return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Only observed regions; India/China climate-modeled estimates are not measurements.
    const borderedRegions = regions.filter(
      (r) => r.geo === "adm1" && r.measurement !== "climate-modeled",
    );
    const ampByKey = new Map(borderedRegions.map((r) => [r.key, strength(r.curve)]));
    const regionRows: Row[] = borderedRegions
      .map((r) => {
        const nb = (regionNeighbors.get(r.key) ?? [])
          .map((k) => ampByKey.get(k))
          .filter((v): v is number => v != null);
        if (!nb.length) return null;
        return {
          name: r.name,
          // ISO3, carried so the phone can offer one labelled region per country the prose names.
          country: r.country,
          amplitude: strength(r.curve),
          neighborMean: d3.mean(nb) ?? 0,
        };
      })
      .filter((r): r is Row => r !== null);

    const amplitudeById = new Map(
      Object.entries(unified.countries).map(([id, curve]) => [Number(id), strength(curve)]),
    );
    const countryRows: Row[] = [...amplitudeById.entries()]
      .map(([id, amplitude]) => {
        const nb = (neighborsByM49.get(id) ?? [])
          .map((n) => amplitudeById.get(n))
          .filter((v): v is number => v != null);
        if (!nb.length) return null;
        return { name: "", country: "", amplitude, neighborMean: d3.mean(nb) ?? 0 };
      })
      .filter((r): r is Row => r !== null);

    const width = WIDTH;
    const height = HEIGHT;
    const margin = { top: 16, right: 18, bottom: 42, left: 52 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const domainMax = Math.max(
      0.14,
      d3.max(regionRows, (d) => Math.max(d.amplitude, d.neighborMean)) || 0.14,
      d3.max(countryRows, (d) => Math.max(d.amplitude, d.neighborMean)) || 0.14,
    );
    const x = d3.scaleLinear().domain([0, domainMax]).nice().range([0, innerW]);
    const y = d3.scaleLinear().domain([0, domainMax]).nice().range([innerH, 0]);
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("line")
      .attr("x1", 0)
      .attr("y1", innerH)
      .attr("x2", x(domainMax))
      .attr("y2", y(domainMax))
      .attr("stroke", "var(--rule)")
      .attr("stroke-width", 1);

    g.selectAll("circle.country-pt")
      .data(countryRows)
      .join("circle")
      .attr("class", "country-pt")
      .attr("cx", (d) => x(d.neighborMean))
      .attr("cy", (d) => y(d.amplitude))
      .attr("r", 3)
      .attr("fill", "none")
      .attr("stroke", "var(--mute)")
      .attr("stroke-width", 0.9)
      .attr("opacity", 0.6);

    g.selectAll("circle.region-pt")
      .data(regionRows)
      .join("circle")
      .attr("class", "region-pt chart-point")
      .attr("cx", (d) => x(d.neighborMean))
      .attr("cy", (d) => y(d.amplitude))
      .attr("r", 3.2)
      .style("cursor", "pointer")
      .on("pointermove", (event, d) =>
        showTooltip(
          `${d.name}: own ${fmtPlainPct(d.amplitude)}, neighbours ${fmtPlainPct(d.neighborMean)}`,
          event.clientX,
          event.clientY,
        ),
      )
      .on("pointerleave", hideTooltip);

    const rCountriesOnly = pearson(
      countryRows.map((d) => d.neighborMean),
      countryRows.map((d) => d.amplitude),
    );
    // Pooled across both populations: every country and every region as one point cloud of
    // own-amplitude vs bordering-units' mean amplitude.
    const bothRows = [...countryRows, ...regionRows];
    const rBoth = pearson(
      bothRows.map((d) => d.neighborMean),
      bothRows.map((d) => d.amplitude),
    );
    g.append("text")
      .attr("class", "chart-note")
      .attr("x", 0)
      .attr("y", 4)
      .text(
        `only countries r = ${rCountriesOnly != null ? rCountriesOnly.toFixed(2) : "—"}  ·  countries & regions r = ${rBoth != null ? rBoth.toFixed(2) : "—"}`,
      );

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(fmtPlainPct))
      .call(styleAxis);
    g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(fmtPlainPct)).call(styleAxis);
    g.append("text")
      .attr("class", "chart-label")
      .attr("x", innerW / 2)
      .attr("y", innerH + 36)
      .attr("text-anchor", "middle")
      .text("mean amplitude of bordering neighbours");

    const legend = d3.select(legendRef.current);
    legend.selectAll("span").remove();
    // The region swatch used to be a fixed blue while the dots themselves were --accent, so the
    // legend named a colour that appeared nowhere on the chart. Both now read from the palette.
    legend.append("span").html(`<span class="swatch" style="color:${accent}"></span>regions`);
    legend
      .append("span")
      .html('<span class="swatch" style="color:var(--mute)"></span>countries (outline)');
    // Only the region series carries a tooltip here — the country dots are deliberately anonymous —
    // and at 221 points with a mean of 82 rivals inside a 44px target it is the densest cloud in the
    // story. So the phone reaches it only through one labelled region per country the prose names.
    attachTapPicker(g, {
      width: innerW,
      height: innerH,
      candidates: labelRepresentatives(g, {
        points: representatives(
          regionRows.map((row) => ({
            x: x(row.neighborMean),
            y: y(row.amplitude),
            text: `${row.name}: own ${fmtPlainPct(row.amplitude)}, neighbours ${fmtPlainPct(row.neighborMean)}`,
            country: namedCountryOf(row.country) ?? "",
            amplitude: row.amplitude,
            reach: Infinity,
          })),
          { countryOf: (row) => row.country, rank: (row) => row.amplitude },
        ),
        text: (row) => row.country,
        width: innerW,
        height: innerH,
      }),
      describe: (row) => row.text,
    });
  }, [regions, regionNeighbors, unified, features, neighborsByM49, accent, WIDTH, HEIGHT]);

  return (
    <>
      <svg
        ref={(node) => {
          svgRef.current = node;
          sizeRef(node);
        }}
        id="region-neighbour-scatter-chart"
        className="story-figure"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={t.aria}
      />
      <div
        className="chart-legend"
        ref={legendRef}
        id="region-neighbour-scatter-legend"
        aria-hidden="true"
      />
    </>
  );
}
