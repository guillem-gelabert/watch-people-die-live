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

// A square root keeps the *area* of a dot proportional to its fatalities. The scale tops out at
// a high percentile rather than at the single worst cell: Ukraine's peak is three orders of
// magnitude above the median, and scaled against it every other conflict would be a dot.
const MAX_R = 6.5;
const SCALE_QUANTILE = 0.97;

// Cells below this many deaths a year are not drawn. A single fatal event anywhere in a year
// puts a cell on the map, and there are enough of those to lay a grey wash over every populated
// continent — which would say "conflict is everywhere" where the data says the opposite. The
// floor is stated under the figure, because dropping data quietly is its own kind of lie.
const FLOOR = 5;

// How many clusters get a name. Past half a dozen the labels collide more than they inform.
const LABELLED = 6;
// A label is skipped when its box would touch one already placed.
const LABEL_CLEARANCE = 4;

// What share of the window's fatalities survive the floor, to one decimal.
function sharePlotted(cells: ConflictsPayload["cells"]): string {
  const all = cells.reduce((sum, c) => sum + c[2], 0);
  if (!(all > 0)) return "0";
  const kept = cells.reduce((sum, c) => (c[2] >= FLOOR ? sum + c[2] : sum), 0);
  return ((kept / all) * 100).toFixed(1);
}

// Where the trailing year's conflict fatalities actually are. Every cell here fires on top of
// its ordinary mortality, so this is the layer that puts a war into the feed without touching
// the crude death rate underneath it.
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

    const cells = (conflicts?.cells ?? []).filter((c) => c[2] >= FLOOR);
    if (!cells.length) return;

    const ceiling = d3.quantile(cells.map((c) => c[2]).sort(d3.ascending), SCALE_QUANTILE) ?? 1;
    const r = d3.scaleSqrt().domain([0, ceiling]).range([0, MAX_R]).clamp(true);
    const ink = "var(--red)";

    // Heaviest last, so a big cell is never buried under the scatter of small ones around it.
    const dots = svg.append("g");
    for (const [lon, lat, fatalities] of [...cells].sort((a, b) => a[2] - b[2])) {
      const xy = projection([lon, lat]);
      if (!insideViewport(xy, width, height)) continue;
      dots
        .append("circle")
        .attr("cx", xy![0])
        .attr("cy", xy![1])
        .attr("r", Math.max(0.5, r(fatalities)))
        .attr("fill", ink)
        // Cells overlap where a conflict is dense, and the pile-up is the point — so they are
        // drawn translucent and allowed to sum rather than being deduplicated away.
        .attr("fill-opacity", 0.55)
        .on("pointerenter", (event: PointerEvent) =>
          showTooltip(
            `${Math.round(fatalities).toLocaleString()} deaths a year at this cell`,
            event.clientX,
            event.clientY,
          ),
        )
        .on("pointerleave", hideTooltip);
    }

    // Names for the handful of countries carrying the window, placed at the centroid of their
    // own cells rather than the country's, so the label sits on the fighting.
    const top = (conflicts?.byCountry ?? []).slice(0, LABELLED);
    const labels = svg.append("g");
    const placed: DOMRect[] = [];
    for (const { country, fatalities } of top) {
      const feature = features.find((f) => f.properties?.name === country);
      if (!feature) continue;
      const xy = projection(d3.geoCentroid(feature));
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

  const cells = conflicts?.cells ?? [];
  const drawn = cells.filter((c) => c[2] >= FLOOR).length;
  const note = cells.length
    ? fill(t.note, {
        events: conflicts!.eventCount.toLocaleString(),
        days: conflicts!.window.days,
        drawn: drawn.toLocaleString(),
        total: cells.length.toLocaleString(),
        floor: FLOOR,
        share: sharePlotted(cells),
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
