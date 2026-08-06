"use client";

import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import { fmtPlainPct, pearson } from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import {
  AMP_Y_DOMAIN,
  AMP_Y_TICKS,
  MARGINS,
  appendAxisTitle,
  fitAt,
  gdpAlphaScale,
  olsFit,
} from "./chartFrame";
import { figureHeight, useFigureWidth } from "./useFigureSize";
import { useSkin } from "../SkinContext";
import { proxyMarks } from "../palette";

export interface AmplitudePoint {
  name: string;
  // The proxy's value for this country, in whatever unit the proxy is measured in.
  value: number;
  // Seasonal amplitude as a fraction: 0.12 is a 12% swing around the country's annual mean.
  amplitude: number;
  // Carried as dot opacity, so income is legible as a second dimension without a second axis.
  gdpPerCapita?: number | null;
}

interface AmplitudeScatterProps {
  id: string;
  // Which proxy this chart argues for. Picks the colour family and, once the reader has ranked
  // them, which "Your #N" note the heading carries.
  proxyIndex: number;
  points: AmplitudePoint[];
  xLabel: string;
  xLog?: boolean;
  formatValue: (value: number) => string;
  formatTick?: (value: d3.NumberValue) => string;
  ariaLabel: string;
  // Extra remark for the corner — e.g. how many countries had to be excluded.
  footnote?: string;
  // An optional second series, drawn behind as rings: the region-level version of the same
  // relationship. Empty or omitted when the proxy only exists at country level.
  rings?: AmplitudePoint[];
  ringLabel?: string;
  // The fit and the coefficient describe the filled series only. With two clouds on one frame a
  // single line would be a fit to neither.
  onRingColor?: (color: string) => void;
}

// The three scatters share one shape as well as one frame, bounded so a fluid column widens the
// plot instead of magnifying the type.
const SHAPE = { aspect: 0.674, min: 240, max: 320 };

// One frame for all three "amplitude against a proxy" scatters. They are meant to be compared
// with each other, so they share a fixed y-domain, a fixed dot size and one fit line: whichever
// cloud slopes hardest is the proxy that explains the most, and that has to be visible at a glance
// rather than reconstructed from three different axes.
export default function AmplitudeScatter({
  id,
  proxyIndex,
  points,
  xLabel,
  xLog = false,
  formatValue,
  formatTick,
  ariaLabel,
  footnote,
  rings,
  ringLabel,
  onRingColor,
}: AmplitudeScatterProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [sizeRef, WIDTH] = useFigureWidth<SVGSVGElement>();
  const HEIGHT = figureHeight(WIDTH, SHAPE);
  const { sky } = useSkin();
  // Four colours from this proxy's own anchor: dots, fit, and two in reserve for the reading.
  const cols = useMemo(() => proxyMarks(proxyIndex, 4, sky), [proxyIndex, sky]);
  const dotColor = cols[0] as string;
  const fitColor = cols[1] as string;
  const ringColor = cols[2] as string;

  // Hand the ring colour back so the caller's layer switch can wear it.
  useEffect(() => onRingColor?.(ringColor), [ringColor, onRingColor]);

  useEffect(() => {
    if (!svgRef.current || !points.length) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const m = MARGINS.amp;
    const innerW = WIDTH - m.left - m.right;
    const innerH = HEIGHT - m.top - m.bottom;
    const pct = (amplitude: number) => amplitude * 100;

    const values = [...points, ...(rings ?? [])].map((p) => p.value);
    const [vMin, vMax] = d3.extent(values) as [number, number];
    const x = xLog
      ? d3
          .scaleLog()
          .domain([Math.max(1, vMin) * 0.9, vMax * 1.1])
          .range([0, innerW])
      : d3.scaleLinear().domain([vMin, vMax]).range([0, innerW]);
    const y = d3.scaleLinear().domain(AMP_Y_DOMAIN).range([innerH, 0]);
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    for (const v of AMP_Y_TICKS) {
      g.append("line")
        .attr("class", "chart-gridline")
        .attr("x1", 0)
        .attr("x2", innerW)
        .attr("y1", y(v))
        .attr("y2", y(v));
      g.append("text")
        .attr("class", "chart-tick")
        .attr("x", -6)
        .attr("y", y(v) + 3)
        .attr("text-anchor", "end")
        .text(`${v}%`);
    }

    // The least-squares line through the cloud. The coefficient alone tells the reader how strong
    // the relationship is; the line tells them which way it goes and how much scatter it is
    // hiding, which is the part that decides whether the proxy is usable.
    const fitPoints: [number, number][] = points.map((p) => [
      xLog ? Math.log10(p.value) : p.value,
      pct(p.amplitude),
    ]);
    const fit = olsFit(fitPoints);
    if (fit) {
      const x0 = xLog ? Math.log10(Math.max(1, vMin)) : vMin;
      const x1 = xLog ? Math.log10(vMax) : vMax;
      g.append("line")
        .attr("class", "chart-fit")
        .attr("x1", x(vMin))
        .attr("x2", x(vMax))
        .attr("y1", y(Math.max(AMP_Y_DOMAIN[0], Math.min(AMP_Y_DOMAIN[1], fitAt(fit, x0)))))
        .attr("y2", y(Math.max(AMP_Y_DOMAIN[0], Math.min(AMP_Y_DOMAIN[1], fitAt(fit, x1)))))
        .attr("stroke", fitColor);
    }

    // Rings first, behind: there are more of them, and they are the context for the filled series.
    if (rings?.length) {
      g.selectAll("circle.ring-pt")
        .data(rings)
        .join("circle")
        .attr("class", "ring-pt")
        .attr("cx", (d) => x(d.value))
        .attr("cy", (d) => y(pct(d.amplitude)))
        .attr("r", 2.8)
        .attr("fill", "none")
        .attr("stroke", ringColor)
        .attr("stroke-width", 1.1)
        .attr("opacity", 0.5)
        .style("cursor", "pointer")
        .on("pointermove", (event, d) =>
          showTooltip(
            `${d.name}: ${formatValue(d.value)}, ${fmtPlainPct(d.amplitude)}`,
            event.clientX,
            event.clientY,
          ),
        )
        .on("pointerleave", hideTooltip);
    }

    const alphaOf = gdpAlphaScale(points.map((p) => p.gdpPerCapita));
    // Scoped to its own class: an unqualified selectAll("circle") would bind to the rings appended
    // above and repaint those instead of adding the filled series.
    g.selectAll("circle.dot-pt")
      .data(points)
      .join("circle")
      .attr("class", "dot-pt")
      .attr("cx", (d) => x(d.value))
      .attr("cy", (d) => y(pct(d.amplitude)))
      .attr("r", 3.2)
      .attr("fill", dotColor)
      .attr("fill-opacity", (d) => alphaOf(d.gdpPerCapita))
      .style("cursor", "pointer")
      .on("pointermove", (event, d) =>
        showTooltip(
          `${d.name}: ${formatValue(d.value)}, ${fmtPlainPct(d.amplitude)}`,
          event.clientX,
          event.clientY,
        ),
      )
      .on("pointerleave", hideTooltip);

    // Correlated on the same scale the axis is drawn in, so the number describes the line above it.
    const r = pearson(
      fitPoints.map((p) => p[0]),
      fitPoints.map((p) => p[1]),
    );
    if (r != null) {
      g.append("text")
        .attr("class", "chart-coefficient")
        .attr("x", innerW)
        .attr("y", 11)
        .attr("text-anchor", "end")
        .attr("fill", fitColor)
        .text(`r = ${r.toFixed(2)}`);
    }

    // An L: this chart keeps its y-spine, because a fit line running off the left edge needs
    // something to run into.
    g.append("path")
      .attr("class", "chart-axis")
      .attr("fill", "none")
      .attr("d", `M0,0 V${innerH} H${innerW}`);

    const ticks = xLog
      ? d3
          .range(Math.floor(Math.log10(Math.max(1, vMin))), Math.ceil(Math.log10(vMax)) + 1)
          .map((p) => 10 ** p)
      : (x.ticks(5) as number[]);
    for (const v of ticks) {
      if (v < (x.domain() as number[])[0]! || v > (x.domain() as number[])[1]!) continue;
      g.append("text")
        .attr("class", "chart-tick")
        .attr("x", x(v))
        .attr("y", innerH + 14)
        .attr("text-anchor", "middle")
        .text(formatTick ? formatTick(v) : String(v));
    }
    appendAxisTitle(g, { x: innerW / 2, y: innerH + 28, text: xLabel });
    // 12px from the svg's own left edge, which is outside this group's translated origin.
    appendAxisTitle(g, { x: 12 - m.left, y: innerH / 2, text: "Amplitude", rotate: true });
  }, [
    points,
    rings,
    xLabel,
    xLog,
    formatValue,
    formatTick,
    dotColor,
    fitColor,
    ringColor,
    WIDTH,
    HEIGHT,
  ]);

  return (
    <>
      <svg
        ref={(node) => {
          svgRef.current = node;
          sizeRef(node);
        }}
        id={id}
        className="story-figure"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={ariaLabel}
      />
      {footnote ? <p className="chart-note-copy">{footnote}</p> : null}
      {ringLabel && rings?.length ? <p className="chart-note-copy">{ringLabel}</p> : null}
    </>
  );
}
