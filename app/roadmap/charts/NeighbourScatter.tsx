"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import {
  buildLegendSteps,
  fmtPlainPct,
  pearson,
  renderGradientLegend,
  strength,
  styleAxis,
} from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import LayerToggle from "./LayerToggle";
import type {
  CountryFeature,
  NeighborsByM49,
  RegionNeighborsByCode,
  SeasonalityData,
  SubnationalSeasonalityRegion,
} from "../types";

interface Row {
  name: string;
  neighborMean: number;
  amplitude: number;
  donors: number; // bordering neighbours that report a curve
  totalNeighbors: number; // all bordering neighbours
  coverage: number; // donors / totalNeighbors, in [0, 1]
  step: number; // index into the coverage legend steps
}

interface RegionRow {
  name: string;
  amplitude: number;
  neighborMean: number;
  donors: number; // bordering regions that report a curve
  totalNeighbors: number; // all bordering regions
  coverage: number; // donors / totalNeighbors, in [0, 1]
  step: number; // index into the shared coverage legend steps
}

interface NeighbourScatterProps {
  unified: SeasonalityData | null;
  features: CountryFeature[] | null;
  neighborsByM49: NeighborsByM49 | null;
  regions: SubnationalSeasonalityRegion[] | null;
  regionNeighbors: RegionNeighborsByCode | null;
}

const N_STEPS = 5;
// Colour ramp for the share of a country's neighbours that report a curve: warm amber at
// low coverage (the point rests on one or two donors, so distrust it) to bright cyan when
// every neighbour has data. Interpolated through HSL for maximum contrast across the range.
const coverageInterpolator = d3.interpolateHsl("#f59e0b", "#22d3ee");

// Amplitude vs. the plain mean amplitude of a unit's bordering neighbours that also report a
// curve (shared-border adjacency from the topojson topology, not a distance threshold). Country
// dots are coloured by the share of bordering neighbours that actually report a curve, so
// single-donor points read as low-confidence; measured Admin-1 regions overlay as hollow rings.
export default function NeighbourScatter({
  unified,
  features,
  neighborsByM49,
  regions,
  regionNeighbors,
}: NeighbourScatterProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const legendRef = useRef<HTMLDivElement | null>(null);
  const visualRef = useRef<HTMLDivElement | null>(null);
  const sweepPlayedRef = useRef(false);
  const [showCountries, setShowCountries] = useState(true);
  const [showRegions, setShowRegions] = useState(true);

  useEffect(() => {
    if (
      !unified ||
      !features ||
      !neighborsByM49 ||
      !svgRef.current ||
      !legendRef.current ||
      !visualRef.current
    )
      return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const nameById = new Map(features.map((f) => [Number(f.id), f.properties?.name ?? ""]));
    const amplitudeById = new Map(
      Object.entries(unified.countries).map(([id, curve]) => [Number(id), strength(curve)]),
    );

    let excluded = 0;
    const raw = [...amplitudeById.entries()]
      .map((entry) => {
        const [id, amplitude] = entry;
        const neighborIds = neighborsByM49.get(id) ?? [];
        const neighborAmplitudes = neighborIds
          .map((n) => amplitudeById.get(n))
          .filter((v): v is number => v != null);
        if (!neighborAmplitudes.length) {
          excluded += 1;
          return null;
        }
        const coverage = neighborIds.length ? neighborAmplitudes.length / neighborIds.length : 0;
        return {
          name: nameById.get(id) || String(id),
          neighborMean: d3.mean(neighborAmplitudes) ?? 0,
          amplitude,
          donors: neighborAmplitudes.length,
          totalNeighbors: neighborIds.length,
          coverage,
        };
      })
      .filter((r): r is Omit<Row, "step"> => r !== null);

    // Bin by quantile so each legend step covers roughly the same number of countries,
    // not the same slice of the 0–100% coverage range.
    const { steps: coverageSteps, scale: coverageStepScale } = buildLegendSteps(
      raw.map((r) => r.coverage),
      N_STEPS,
      coverageInterpolator,
      fmtPlainPct,
    );
    const rows: Row[] = raw.map((r) => ({ ...r, step: coverageStepScale(r.coverage) }));

    // Region-level analog: only observed Admin-1 regions with a measured bordering donor
    // (partido rows have no boundary topology and can't enter a border calculation).
    const borderedRegions = (regions ?? []).filter(
      (r) => r.geo === "adm1" && r.measurement !== "climate-modeled",
    );
    const ampByKey = new Map(borderedRegions.map((r) => [r.key, strength(r.curve)]));
    const regionRows: RegionRow[] = borderedRegions
      .map((r): RegionRow | null => {
        const neighborKeys = regionNeighbors?.get(r.key) ?? [];
        const nb = neighborKeys.map((k) => ampByKey.get(k)).filter((v): v is number => v != null);
        if (!nb.length) return null;
        return {
          name: r.name,
          amplitude: strength(r.curve),
          neighborMean: d3.mean(nb) ?? 0,
          donors: nb.length,
          totalNeighbors: neighborKeys.length,
          // Share of bordering regions that report a curve — the region-level analog of the
          // country coverage, binned through the same quantile step scale so one legend and one
          // colour ramp describe both layers.
          coverage: neighborKeys.length ? nb.length / neighborKeys.length : 0,
          step: 0,
        };
      })
      .filter((r): r is RegionRow => r !== null)
      .map((r) => ({ ...r, step: coverageStepScale(r.coverage) }));

    const width = 420;
    const height = 260;
    const margin = { top: 16, right: 18, bottom: 42, left: 52 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const domainMax = Math.max(
      0.18,
      d3.max(rows, (d) => Math.max(d.amplitude, d.neighborMean)) || 0.18,
      d3.max(regionRows, (d) => Math.max(d.amplitude, d.neighborMean)) || 0.18,
    );
    const x = d3.scaleLinear().domain([0, domainMax]).nice().range([0, innerW]);
    const y = d3.scaleLinear().domain([0, domainMax]).nice().range([innerH, 0]);
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const rCountry = pearson(
      rows.map((d) => d.neighborMean),
      rows.map((d) => d.amplitude),
    );
    const rRegion = regionRows.length
      ? pearson(
          regionRows.map((d) => d.neighborMean),
          regionRows.map((d) => d.amplitude),
        )
      : null;
    const noteParts: string[] = [];
    if (showCountries && rCountry != null) noteParts.push(`countries r = ${rCountry.toFixed(2)}`);
    if (showRegions && rRegion != null) noteParts.push(`regions r = ${rRegion.toFixed(2)}`);
    if (noteParts.length) {
      g.append("text")
        .attr("class", "chart-note")
        .attr("x", 0)
        .attr("y", 4)
        .text(noteParts.join("  ·  "));
    }

    // Regions drawn under the country dots as hollow rings, coloured by the same coverage ramp
    // as the country dots (fill vs. hollow keeps the two layers distinguishable).
    if (showRegions) {
      g.selectAll("circle.region-pt")
        .data(regionRows)
        .join("circle")
        .attr("class", "region-pt")
        .attr("cx", (d) => x(d.neighborMean))
        .attr("cy", (d) => y(d.amplitude))
        .attr("r", 3)
        .attr("fill", "none")
        .attr("stroke", (d) => coverageSteps[d.step]?.color ?? "#8888aa")
        .attr("stroke-width", 1.3)
        .attr("opacity", 0.85)
        .style("cursor", "pointer")
        .on("pointermove", (event, d) =>
          showTooltip(
            `${d.name}: own ${fmtPlainPct(d.amplitude)}, neighbours ${fmtPlainPct(d.neighborMean)} · ` +
              `${d.donors}/${d.totalNeighbors} neighbours with data (${fmtPlainPct(d.coverage)})`,
            event.clientX,
            event.clientY,
          ),
        )
        .on("pointerleave", hideTooltip);
    }

    let points: d3.Selection<SVGCircleElement, Row, SVGGElement, unknown> | null = null;
    if (showCountries) {
      points = g
        .selectAll<SVGCircleElement, Row>("circle.country-pt")
        .data(rows)
        .join("circle")
        .attr("class", "country-pt chart-point")
        .attr("cx", (d) => x(d.neighborMean))
        .attr("cy", (d) => y(d.amplitude))
        .attr("r", 3.6)
        .style("fill", (d) => coverageSteps[d.step]?.color ?? "#8888aa")
        .style("cursor", "pointer")
        .on("pointermove", (event, d) =>
          showTooltip(
            `${d.name}: own ${fmtPlainPct(d.amplitude)}, neighbours ${fmtPlainPct(d.neighborMean)} · ` +
              `${d.donors}/${d.totalNeighbors} neighbours with data (${fmtPlainPct(d.coverage)})`,
            event.clientX,
            event.clientY,
          ),
        )
        .on("pointerleave", hideTooltip);
    }

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

    if (showCountries && excluded > 0) {
      svg
        .append("text")
        .attr("class", "chart-note")
        .attr("x", width - margin.right)
        .attr("y", 14)
        .attr("text-anchor", "end")
        .text(`${excluded} excluded — no bordering donor`);
    }

    // Both layers encode coverage with the same ramp, so the legend shows whenever either is
    // visible. Its hover-highlight + one-shot guided sweep act on the country dots, so they only
    // attach when countries are shown; a regions-only view gets the same static colour legend.
    const coverageLabel = "share of bordering neighbours with a curve";
    if (showCountries && points) {
      return renderGradientLegend(
        legendRef.current,
        coverageSteps,
        coverageLabel,
        [fmtPlainPct(0), fmtPlainPct(1)],
        points,
        {
          guidedSweep: {
            visibilityTarget: visualRef.current,
            hasPlayed: sweepPlayedRef,
            durationMs: 2200,
          },
        },
      );
    }
    if (showRegions) {
      const noPoints = g.selectAll<SVGCircleElement, Row>("circle.__none");
      return renderGradientLegend(
        legendRef.current,
        coverageSteps,
        coverageLabel,
        [fmtPlainPct(0), fmtPlainPct(1)],
        noPoints,
      );
    }
    d3.select(legendRef.current).selectAll("*").remove();
  }, [unified, features, neighborsByM49, regions, regionNeighbors, showCountries, showRegions]);

  return (
    <>
      <LayerToggle
        showCountries={showCountries}
        showRegions={showRegions}
        onShowCountries={setShowCountries}
        onShowRegions={setShowRegions}
      />
      <div className="guided-legend-visual" ref={visualRef}>
        <svg
          ref={svgRef}
          id="neighbour-scatter-chart"
          className="seasonality-chart"
          viewBox="0 0 420 260"
          role="img"
          aria-label="Scatter plot of each country's seasonal mortality amplitude against the mean amplitude of its bordering neighbours, coloured by the share of neighbours that report a curve in five steps, with measured regions overlaid as hollow dots; hovering a legend step highlights its dots"
        />
        <div
          className="chart-legend"
          ref={legendRef}
          id="neighbour-scatter-legend"
          aria-hidden="true"
        />
      </div>
    </>
  );
}
