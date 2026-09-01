"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { fmtPlainPct, pearson, strength } from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import SeriesChips from "./SeriesChips";
import {
  MARGINS,
  PROXY,
  appendAxisTitle,
  appendBaseline,
  niceMaxPercent,
  percentGridValues,
} from "./chartFrame";
import { labelRepresentatives, namedCountryOf, representatives } from "./representatives";
import { attachTapPicker } from "./touchPick";
import { figureHeight, useFigureWidth } from "./useFigureSize";
import partidoLatitudeData from "../../../data/argentina-partido-latitudes.json";
import { useDict } from "../I18nContext";
import type {
  Admin1Feature,
  CountryFeature,
  SeasonalityData,
  SubnationalSeasonalityRegion,
} from "../types";

interface CountryRow {
  name: string;
  absLat: number;
  amplitude: number;
}

interface RegionRow {
  name: string;
  country: string;
  absLat: number;
  amplitude: number;
}

interface LatitudeScatterProps {
  unified: SeasonalityData | null;
  features: CountryFeature[] | null;
  regions: SubnationalSeasonalityRegion[] | null;
  admin1Features: Admin1Feature[] | null;
}

// Aspect and bounds rather than a fixed size: the column is fluid, and a scatter that scaled would
// print its 9.5px labels at whatever the column happened to be.
const SHAPE = { aspect: 0.75, min: 250, max: 340 };
// The axis is fixed to the whole inhabited range rather than to the data, so the shape of the
// cloud is the finding — not an artefact of where this year's extremes happened to fall.
const X_MAX = 70;
// The two lines latitude actually draws on the planet, to the minute: the tropic and the polar
// circle are where the seasons themselves change character.
const GUIDES = [
  { lat: 23.44, label: "Tropic" },
  { lat: 66.56, label: "Polar Circle" },
];

const partidoLatitudes = partidoLatitudeData.latitudes as Record<string, number>;

// Latitude against seasonal amplitude, countries and measured regions in one frame. The region
// layer is what makes it worth plotting: inside Russia and the US the higher-latitude regions are
// *less* seasonal, not more, so the neat cross-country slope hides a contradiction.
export default function LatitudeScatter({
  unified,
  features,
  regions,
  admin1Features,
}: LatitudeScatterProps) {
  const d = useDict();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [sizeRef, WIDTH] = useFigureWidth<SVGSVGElement>();
  const HEIGHT = figureHeight(WIDTH, SHAPE);
  const [showCountries, setShowCountries] = useState(true);
  const [showRegions, setShowRegions] = useState(true);

  // Two series, in this proxy's own colour: latitude is proxy 3, and every figure that argues
  // about latitude wears the same hue.
  const countryColor = `var(--proxy-mark-${PROXY.latitude}-0)`;
  const regionColor = `var(--proxy-mark-${PROXY.latitude}-1)`;

  useEffect(() => {
    if (!unified || !features || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const countryRows: CountryRow[] = Object.entries(unified.countries)
      .map(([id, curve]): CountryRow | null => {
        const feature = features.find((f) => Number(f.id) === Number(id));
        if (!feature) return null;
        return {
          name: feature.properties?.name ?? "Unknown",
          absLat: Math.abs(d3.geoCentroid(feature)[1]),
          amplitude: strength(curve),
        };
      })
      .filter((r): r is CountryRow => r !== null);

    const admin1ByCode = new Map((admin1Features ?? []).map((f) => [f.properties?.adm1_code, f]));
    const regionRows: RegionRow[] = (regions ?? [])
      .filter((r) => r.measurement !== "climate-modeled") // observed regions only
      .map((r) => {
        const lat =
          r.geo === "partido"
            ? partidoLatitudes[r.key]
            : admin1ByCode.get(r.key)?.properties?.latitude;
        if (lat == null) return null;
        return {
          name: r.name,
          country: r.country,
          absLat: Math.abs(lat),
          amplitude: strength(r.curve),
        };
      })
      .filter((r): r is RegionRow => r !== null);

    const m = MARGINS.latitude;
    const innerW = WIDTH - m.left - m.right;
    const innerH = HEIGHT - m.top - m.bottom;
    // Amplitude reads as a percentage swing around the annual mean.
    const pct = (amplitude: number) => amplitude * 100;
    const yMax = niceMaxPercent(
      Math.max(
        d3.max(countryRows, (d) => pct(d.amplitude)) ?? 10,
        showRegions ? (d3.max(regionRows, (d) => pct(d.amplitude)) ?? 10) : 10,
      ),
    );
    const x = d3.scaleLinear().domain([0, X_MAX]).range([0, innerW]);
    const y = d3.scaleLinear().domain([0, yMax]).range([innerH, 0]);
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    // Horizontal guides only, at whole percentage points, with their labels in the left margin.
    for (const v of percentGridValues(yMax)) {
      g.append("line")
        .attr("class", "chart-gridline")
        .attr("x1", 0)
        .attr("x2", innerW)
        .attr("y1", y(v))
        .attr("y2", y(v))
        .attr("opacity", 0.35);
      g.append("text")
        .attr("class", "chart-tick")
        .attr("x", -6)
        .attr("y", y(v) + 3)
        .attr("text-anchor", "end")
        .text(`${v}%`);
    }

    // The two climate boundaries, captioned above the plot where they cannot collide with data.
    for (const guide of GUIDES) {
      const px = x(guide.lat);
      g.append("line")
        .attr("class", "climate-band-boundary")
        .attr("x1", px)
        .attr("x2", px)
        .attr("y1", 0)
        .attr("y2", innerH);
      g.append("text")
        .attr("class", "chart-label")
        .attr("x", guide.lat > 60 ? px - 2 : px)
        .attr("y", -9)
        .attr("text-anchor", guide.lat > 60 ? "end" : "middle")
        .text(guide.label);
    }

    // Regions behind, as rings: there are four times as many of them, and filled dots that
    // numerous would bury the country layer they are supposed to be compared against.
    if (showRegions) {
      g.selectAll("circle.region-pt")
        .data(regionRows)
        .join("circle")
        .attr("class", "region-pt")
        .attr("cx", (d) => x(Math.min(X_MAX, d.absLat)))
        .attr("cy", (d) => y(pct(d.amplitude)))
        .attr("r", 3.1)
        .attr("fill", "none")
        .attr("stroke", regionColor)
        .attr("stroke-width", 1.2)
        .attr("opacity", 0.6)
        .style("cursor", "pointer")
        .on("pointermove", (event, d) =>
          showTooltip(
            `${d.name} (${d.country}): ${d.absLat.toFixed(1)}° lat, ${fmtPlainPct(d.amplitude)}`,
            event.clientX,
            event.clientY,
          ),
        )
        .on("pointerleave", hideTooltip);
    }

    if (showCountries) {
      g.selectAll("circle.country-pt")
        .data(countryRows)
        .join("circle")
        .attr("class", "country-pt")
        .attr("cx", (d) => x(Math.min(X_MAX, d.absLat)))
        .attr("cy", (d) => y(pct(d.amplitude)))
        .attr("r", 3.1)
        .attr("fill", countryColor)
        .style("cursor", "pointer")
        .on("pointermove", (event, d) =>
          showTooltip(
            `${d.name}: ${d.absLat.toFixed(1)}° lat, ${fmtPlainPct(d.amplitude)}`,
            event.clientX,
            event.clientY,
          ),
        )
        .on("pointerleave", hideTooltip);
    }

    // Fit quality for whichever layers are on, sitting above the plot in the top-left corner.
    const r2 = (r: number | null) => (r != null ? (r * r).toFixed(2) : "—");
    const rCountry = pearson(
      countryRows.map((d) => d.absLat),
      countryRows.map((d) => d.amplitude),
    );
    const rRegion = regionRows.length
      ? pearson(
          regionRows.map((d) => d.absLat),
          regionRows.map((d) => d.amplitude),
        )
      : null;
    const noteParts: string[] = [];
    if (showCountries) noteParts.push(`countries R² = ${r2(rCountry)}`);
    if (showRegions && rRegion != null) noteParts.push(`regions R² = ${r2(rRegion)}`);
    if (noteParts.length) {
      svg
        .append("text")
        .attr("class", "chart-note")
        .attr("x", m.left + 2)
        .attr("y", 13)
        .text(noteParts.join("  ·  "));
    }

    // A baseline and nothing else: the gridlines already carry the vertical scale.
    appendBaseline(g, 0, innerW, innerH);
    for (let v = 0; v <= X_MAX; v += 10) {
      g.append("text")
        .attr("class", "chart-tick")
        .attr("x", x(v))
        .attr("y", innerH + 14)
        .attr("text-anchor", "middle")
        .text(`${v}°`);
    }
    appendAxisTitle(g, { x: innerW / 2, y: innerH + 30, text: "absolute latitude" });

    // The phone's path into the two series, which need different rules: 87 countries at a mean of
    // 8 rivals inside a 44px target are tappable directly, and 229 regions at a mean of 28 are not.
    // So regions are reachable only through one labelled representative per country the prose
    // names, and a tap in open space falls through to the nearest of those. Only the series the
    // reader has switched on are offered.
    const countryCandidates = showCountries
      ? countryRows.map((d) => ({
          x: x(Math.min(X_MAX, d.absLat)),
          y: y(pct(d.amplitude)),
          text: `${d.name}: ${d.absLat.toFixed(1)}° lat, ${fmtPlainPct(d.amplitude)}`,
        }))
      : [];
    const regionCandidates = showRegions
      ? labelRepresentatives(g, {
          points: representatives(
            regionRows.map((d) => ({
              x: x(Math.min(X_MAX, d.absLat)),
              y: y(pct(d.amplitude)),
              text: `${d.name} (${d.country}): ${d.absLat.toFixed(1)}° lat, ${fmtPlainPct(d.amplitude)}`,
              country: d.country,
              amplitude: d.amplitude,
              reach: Infinity,
            })),
            // The region data keys on ISO3, so it has to be resolved to the name the prose uses.
            { countryOf: (d) => namedCountryOf(d.country) ?? "", rank: (d) => d.amplitude },
          ),
          text: (d) => namedCountryOf(d.country) ?? d.country,
          width: innerW,
          height: innerH,
        })
      : [];
    attachTapPicker(g, {
      width: innerW,
      height: innerH,
      candidates: [...countryCandidates, ...regionCandidates],
      describe: (d) => d.text,
    });
  }, [
    unified,
    features,
    regions,
    admin1Features,
    showCountries,
    showRegions,
    countryColor,
    regionColor,
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
        id="latitude-scatter-chart"
        className="story-figure"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={d.charts.latitudeScatter.aria}
      />
    </>
  );
}
