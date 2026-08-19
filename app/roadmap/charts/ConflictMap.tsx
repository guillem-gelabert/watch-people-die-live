"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { fitProjection, insideViewport, type Bbox } from "./basemap";
import { useFigureWidth, figureHeight } from "./useFigureSize";
import { showTooltip, hideTooltip } from "../tooltip";
import type { ConflictsPayload, CountryFeature } from "../types";
import { useDict } from "../I18nContext";
import { fill } from "@/lib/i18n/fill";

interface ConflictMapProps {
  conflicts: ConflictsPayload | null;
  features: CountryFeature[] | null;
}

// The inhabited world without the poles: conflict cells cluster well inside these bounds, and
// cropping the ice buys back most of the panel.
const BBOX: Bbox = [
  [-170, -56],
  [180, 76],
];

const ASPECT = 0.52;
const MIN_HEIGHT = 180;
const MAX_HEIGHT = 320;

// A square root keeps the *area* of an Admin-1 centroid proportional to its fatalities. The
// scale tops out at a high percentile so one extreme region does not flatten the rest.
const MAX_R = 6.5;
const SCALE_QUANTILE = 0.97;

// How many clusters get a name. Past half a dozen the labels collide more than they inform.
const LABELLED = 6;
// A label is skipped when its box would touch one already placed.
const LABEL_CLEARANCE = 4;

// The map shows the disclosed spatial precision of the source: one centroid per Admin-1 region,
// not the locations of individual events. The globe separately uses each region's nearest
// populated same-country rate-grid cell.
export default function ConflictMap({ conflicts, features }: ConflictMapProps) {
  const t = useDict().charts.conflictMap;
  const ref = useRef<SVGSVGElement | null>(null);
  const [sizeRef, width] = useFigureWidth<HTMLDivElement>();
  const height = figureHeight(width, { aspect: ASPECT, min: MIN_HEIGHT, max: MAX_HEIGHT });

  useEffect(() => {
    const node = ref.current;
    if (!node || !features) return;
    const svg = d3.select(node);
    svg.selectAll("*").remove();

    const projection = fitProjection(d3.geoNaturalEarth1(), BBOX, width, height, 4);
    const path = d3.geoPath(projection);

    // The land is a quiet plate in the section's own paper; only the fatalities are inked.
    svg
      .append("path")
      .attr("d", path({ type: "Sphere" }) ?? "")
      .attr("fill", "var(--tile-muted)");
    const landG = svg.append("g");
    for (const f of features) {
      landG
        .append("path")
        .attr("d", path(f) ?? "")
        .attr("fill", "var(--tile)")
        .attr("stroke", "var(--rule)")
        .attr("stroke-width", 0.5);
    }

    const regions = conflicts?.regions ?? [];
    if (!regions.length) return;

    const ceiling =
      d3.quantile(regions.map((region) => region.fatalities).sort(d3.ascending), SCALE_QUANTILE) ??
      1;
    const r = d3.scaleSqrt().domain([0, ceiling]).range([0, MAX_R]).clamp(true);
    const ink = "var(--red)";

    // Heaviest last, so a major region is never buried under nearby smaller ones.
    const dots = svg.append("g");
    for (const region of [...regions].sort((a, b) => a.fatalities - b.fatalities)) {
      const xy = projection([region.longitude, region.latitude]);
      if (!insideViewport(xy, width, height)) continue;
      dots
        .append("circle")
        .attr("cx", xy![0])
        .attr("cy", xy![1])
        .attr("r", Math.max(0.6, r(region.fatalities)))
        .attr("fill", ink)
        .attr("fill-opacity", 0.55)
        .on("pointerenter", (event: PointerEvent) =>
          showTooltip(
            fill(t.regionTooltip, {
              region: region.admin1,
              country: region.country,
              n: Math.round(region.fatalities).toLocaleString(),
            }),
            event.clientX,
            event.clientY,
          ),
        )
        .on("pointerleave", hideTooltip);
    }

    // Names for the handful of countries carrying the window, placed at the fatality-weighted
    // centroid of their reported Admin-1 regions so the label sits on the observed concentration.
    const top = (conflicts?.byCountry ?? []).slice(0, LABELLED);
    const labels = svg.append("g");
    const placed: DOMRect[] = [];
    for (const { country, fatalities } of top) {
      const countryRegions = regions.filter((region) => region.country === country);
      const denominator = countryRegions.reduce((sum, region) => sum + region.fatalities, 0);
      if (!(denominator > 0)) continue;
      const longitude =
        countryRegions.reduce((sum, region) => sum + region.longitude * region.fatalities, 0) /
        denominator;
      const latitude =
        countryRegions.reduce((sum, region) => sum + region.latitude * region.fatalities, 0) /
        denominator;
      const xy = projection([longitude, latitude]);
      if (!insideViewport(xy, width, height)) continue;
      const text = labels
        .append("text")
        .attr("class", "conflict-label")
        .attr("x", xy![0])
        .attr("y", xy![1] - 9)
        .attr("text-anchor", "middle")
        .text(country);

      // Neighbouring wars put their labels on top of each other — Syria over Palestine over
      // Sudan. The bigger conflict is placed first, and a smaller one that would collide with
      // it keeps its dots and loses only its name.
      const box = (text.node() as SVGTextElement).getBBox();
      const collides = placed.some(
        (p) =>
          box.x < p.x + p.width + LABEL_CLEARANCE &&
          box.x + box.width + LABEL_CLEARANCE > p.x &&
          box.y < p.y + p.height + LABEL_CLEARANCE &&
          box.y + box.height + LABEL_CLEARANCE > p.y,
      );
      if (collides) {
        text.remove();
        continue;
      }
      placed.push(box);

      // A paper backing, sized off the rendered label, so a name stays readable over a dense
      // cluster of dots.
      labels
        .insert("rect", () => text.node())
        .attr("x", box.x - 3)
        .attr("y", box.y - 1)
        .attr("width", box.width + 6)
        .attr("height", box.height + 2)
        .attr("rx", 3)
        .attr("fill", "var(--paper)")
        .attr("fill-opacity", 0.85);
      text.append("title").text(fill(t.plateTitle, { n: fatalities.toLocaleString() }));
    }
  }, [conflicts, features, width, height, t]);

  const regions = conflicts?.regions ?? [];
  const note = regions.length
    ? fill(t.note, {
        fatalities: Math.round(conflicts!.totalFatalities).toLocaleString(),
        weeks: conflicts!.window.weeks,
        regions: regions.length.toLocaleString(),
        through: conflicts!.commonThrough,
      })
    : t.noData;

  return (
    <div ref={sizeRef}>
      <svg
        ref={ref}
        className="story-figure"
        width={width}
        height={height}
        role="img"
        aria-label={fill(t.aria, { note })}
      />
      <p className="chart-note-copy">
        {t.lead} {note}
      </p>
    </div>
  );
}
