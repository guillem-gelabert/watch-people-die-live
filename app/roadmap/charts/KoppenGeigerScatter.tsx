"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import {
  KG_FAMILY_KEYS,
  correlationRatio,
  fmtPlainPct,
  kgFamilyName,
  strength,
} from "../chartHelpers";
import { labelRepresentatives, namedCountryOf, representatives } from "./representatives";
import { attachTapPicker } from "./touchPick";
import { figureHeight, useFigureWidth } from "./useFigureSize";
import { showTooltip, hideTooltip } from "../tooltip";
import SeriesChips from "./SeriesChips";
import {
  MARGINS,
  PROXY,
  appendAxisTitle,
  appendBaseline,
  hashJitter,
  niceMaxPercent,
  percentGridValues,
  quantileByRank,
} from "./chartFrame";
import { useDict } from "../I18nContext";
import type {
  CountryFeature,
  SeasonalityData,
  SeasonalityProxies,
  SubnationalSeasonalityRegion,
} from "../types";

interface Row {
  name: string;
  family: string;
  amplitude: number;
}

interface KoppenGeigerScatterProps {
  unified: SeasonalityData | null;
  proxies: SeasonalityProxies | null;
  features: CountryFeature[] | null;
  regions: SubnationalSeasonalityRegion[] | null;
}

// Bounded aspect rather than a fixed size, so the column can be fluid without the labels
// scaling with it.
const SHAPE = { aspect: 0.71, min: 250, max: 330 };

const etaByFamily = (rows: Row[]) => {
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    const arr = groups.get(row.family) ?? [];
    arr.push(row.amplitude);
    groups.set(row.family, arr);
  }
  return correlationRatio(groups);
};

// Amplitude by dominant Köppen–Geiger climate family: a jittered strip scatter, one dot per
// country (filled) and, when enabled, one hollow dot per measured Admin-1 region, grouped by the
// family that covers most of its population.
export default function KoppenGeigerScatter({
  unified,
  proxies,
  features,
  regions,
}: KoppenGeigerScatterProps) {
  const d = useDict();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [sizeRef, WIDTH] = useFigureWidth<SVGSVGElement>();
  const HEIGHT = figureHeight(WIDTH, SHAPE);
  const [showCountries, setShowCountries] = useState(true);
  const [showRegions, setShowRegions] = useState(true);

  // Climate is proxy 2, so three colours from its own split-complementary. Colour now encodes the
  // *layer* — countries, regions, mean — not the family: the families are already named along the
  // axis, and spending five hues on them left nothing to separate the two layers with.
  const countryColor = `var(--proxy-mark-${PROXY.climate}-0)`;
  const regionColor = `var(--proxy-mark-${PROXY.climate}-1)`;
  const meanColor = `var(--proxy-mark-${PROXY.climate}-2)`;

  useEffect(() => {
    if (!unified || !proxies || !features || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const nameById = new Map(features.map((f) => [Number(f.id), f.properties?.name ?? ""]));
    const countryRows: Row[] = Object.entries(unified.countries)
      .map(([id, curve]): Row | null => {
        const row = proxies.byM49[id];
        if (!row || !row.kgFamily) return null;
        return {
          name: nameById.get(Number(id)) || id,
          family: row.kgFamily,
          amplitude: strength(curve),
        };
      })
      .filter((r): r is Row => r !== null);

    // Region dots use their own centroid-sampled Köppen family; climate-modeled estimates are
    // not measurements and are excluded, matching the other measured-region charts.
    const regionRows: Row[] = (regions ?? [])
      .filter((r) => r.measurement !== "climate-modeled" && r.kgFamily)
      .map((r) => ({
        name: `${r.name} (${r.country})`,
        family: r.kgFamily as string,
        amplitude: strength(r.curve),
      }));

    const m = MARGINS.koppen;
    const innerW = WIDTH - m.left - m.right;
    const innerH = HEIGHT - m.top - m.bottom;
    const pct = (amplitude: number) => amplitude * 100;
    const yMax = niceMaxPercent(
      Math.max(
        d3.max(countryRows, (d) => pct(d.amplitude)) ?? 10,
        showRegions ? (d3.max(regionRows, (d) => pct(d.amplitude)) ?? 10) : 10,
      ),
    );

    const x = d3
      .scaleBand<string>()
      .domain(KG_FAMILY_KEYS.map((f) => f.key))
      .range([0, innerW])
      .padding(0.35);
    const y = d3.scaleLinear().domain([0, yMax]).range([innerH, 0]);
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
    const bw = x.bandwidth();

    for (const v of percentGridValues(yMax)) {
      g.append("line")
        .attr("class", "chart-gridline")
        .attr("x1", 0)
        .attr("x2", innerW)
        .attr("y1", y(v))
        .attr("y2", y(v))
        .attr("opacity", 0.32);
      g.append("text")
        .attr("class", "chart-tick")
        .attr("x", -6)
        .attr("y", y(v) + 3)
        .attr("text-anchor", "end")
        .text(`${v}%`);
    }

    // The spread behind each column is the whole argument of the figure: a tight column means the
    // climate family predicts amplitude, a tall one means it does not. A 10th-90th percentile band
    // says that better than a standard deviation, because these distributions are not symmetric —
    // and it is drawn from whichever layers are on, so the reader is never shown a spread for a
    // series they have hidden.
    for (const family of KG_FAMILY_KEYS) {
      const group = [
        ...(showCountries ? countryRows : []),
        ...(showRegions ? regionRows : []),
      ].filter((r) => r.family === family.key);
      if (group.length < 3) continue;
      const sorted = group.map((r) => pct(r.amplitude)).sort(d3.ascending);
      const lo = quantileByRank(sorted, 0.1);
      const hi = quantileByRank(sorted, 0.9);
      const cx = (x(family.key) ?? 0) + bw / 2;
      g.append("rect")
        .attr("class", "chart-band")
        .attr("x", cx - bw * 0.34)
        .attr("width", bw * 0.68)
        .attr("y", y(hi))
        .attr("height", Math.max(3, y(lo) - y(hi)))
        .attr("rx", 6)
        .attr("fill", countryColor);
      const mean = d3.mean(sorted) ?? 0;
      g.append("line")
        .attr("x1", cx - bw * 0.34)
        .attr("x2", cx + bw * 0.34)
        .attr("y1", y(mean))
        .attr("y2", y(mean))
        .attr("stroke", meanColor)
        .attr("stroke-width", 1.8);
    }

    if (showRegions) {
      g.selectAll("circle.region-pt")
        .data(regionRows)
        .join("circle")
        .attr("class", "region-pt")
        .attr("cx", (d, i) => (x(d.family) ?? 0) + bw / 2 + hashJitter(i + 1, 7.13) * bw * 0.24)
        .attr("cy", (d) => y(pct(d.amplitude)))
        .attr("r", 2.5)
        .attr("fill", "none")
        .attr("stroke", regionColor)
        .attr("stroke-width", 1.1)
        .attr("opacity", 0.42)
        .style("cursor", "pointer")
        .on("pointermove", (event, d) =>
          showTooltip(`${d.name}: ${fmtPlainPct(d.amplitude)}`, event.clientX, event.clientY),
        )
        .on("pointerleave", hideTooltip);
    }

    if (showCountries) {
      g.selectAll("circle.country-pt")
        .data(countryRows)
        .join("circle")
        .attr("class", "country-pt")
        .attr("cx", (d, i) => (x(d.family) ?? 0) + bw / 2 + hashJitter(i + 1, 4.91) * bw * 0.2)
        .attr("cy", (d) => y(pct(d.amplitude)))
        .attr("r", 2.7)
        .attr("fill", countryColor)
        .style("cursor", "pointer")
        .on("pointermove", (event, d) =>
          showTooltip(`${d.name}: ${fmtPlainPct(d.amplitude)}`, event.clientX, event.clientY),
        )
        .on("pointerleave", hideTooltip);
    }

    // Climate family is categorical, so Pearson r is undefined — use the correlation ratio η
    // (share of amplitude variance explained by the family means) instead, per visible layer.
    const etaCountry = etaByFamily(countryRows);
    const etaRegion = regionRows.length ? etaByFamily(regionRows) : null;
    const noteParts: string[] = [];
    if (showCountries && etaCountry != null)
      noteParts.push(`countries η = ${etaCountry.toFixed(2)}`);
    if (showRegions && etaRegion != null) noteParts.push(`regions η = ${etaRegion.toFixed(2)}`);
    if (noteParts.length) {
      svg
        .append("text")
        .attr("class", "chart-note")
        .attr("x", m.left + 2)
        .attr("y", 13)
        .text(noteParts.join("  ·  "));
    }

    appendBaseline(g, 0, innerW, innerH);
    for (const family of KG_FAMILY_KEYS) {
      g.append("text")
        .attr("class", "chart-zone")
        .attr("x", (x(family.key) ?? 0) + bw / 2)
        .attr("y", innerH + 15)
        .attr("text-anchor", "middle")
        .text(kgFamilyName(d, family.key));
    }
    appendAxisTitle(g, { x: innerW / 2, y: innerH + 33, text: d.charts.koppenScatter.axisTitle });

    // The phone's path in. 87 countries at a mean of 13.5 rivals inside a 44px target are tappable
    // directly; 228 jittered regions at a mean of 54.5 are not, so they are reached through one
    // labelled representative per country the prose names. The candidate positions reproduce each
    // series' own jitter, or a tap would ring a point where nothing is drawn.
    const countryCandidates = showCountries
      ? countryRows.map((row, i) => ({
          x: (x(row.family) ?? 0) + bw / 2 + hashJitter(i + 1, 4.91) * bw * 0.2,
          y: y(pct(row.amplitude)),
          text: `${row.name}: ${fmtPlainPct(row.amplitude)}`,
        }))
      : [];
    const regionCandidates = showRegions
      ? labelRepresentatives(g, {
          points: representatives(
            regionRows.map((row, i) => ({
              x: (x(row.family) ?? 0) + bw / 2 + hashJitter(i + 1, 7.13) * bw * 0.24,
              y: y(pct(row.amplitude)),
              text: `${row.name}: ${fmtPlainPct(row.amplitude)}`,
              // Region names arrive as "Region (ISO3)", so the code has to come back out of them.
              country: namedCountryOf(row.name.replace(/^.*\((.*)\)$/, "$1")) ?? "",
              amplitude: row.amplitude,
              reach: Infinity,
            })),
            { countryOf: (row) => row.country, rank: (row) => row.amplitude },
          ),
          text: (row) => row.country,
          width: innerW,
          height: innerH,
        })
      : [];
    attachTapPicker(g, {
      width: innerW,
      height: innerH,
      candidates: [...countryCandidates, ...regionCandidates],
      describe: (row) => row.text,
    });
  }, [
    d,
    unified,
    proxies,
    features,
    regions,
    showCountries,
    showRegions,
    countryColor,
    regionColor,
    meanColor,
    WIDTH,
    HEIGHT,
  ]);

  return (
    <>
      <SeriesChips
        series={[
          {
            key: "countries",
            label: d.charts.common.countries,
            color: countryColor,
            on: showCountries,
          },
          { key: "regions", label: d.charts.common.regions, color: regionColor, on: showRegions },
        ]}
        onToggle={(key, on) => (key === "countries" ? setShowCountries(on) : setShowRegions(on))}
      />
      <svg
        ref={(node) => {
          svgRef.current = node;
          sizeRef(node);
        }}
        id="koppen-geiger-scatter-chart"
        className="story-figure"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={d.charts.koppenScatter.aria}
      />
    </>
  );
}
