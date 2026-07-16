"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { MONTHS, TEMPERATURE_PICKS, styleAxis } from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import type { CountryFeature, SeasonalityData, TemperatureCurves } from "../types";

interface TemperatureVsMortalityProps {
  seasonality: SeasonalityData | null; // measured mortality curves (unified || seasonality)
  temperatureCurves: TemperatureCurves | null;
  features: CountryFeature[] | null;
}

const MORTALITY_COLOR = "#ff6b6b"; // deaths — the seasonal multiplier, left axis
const TEMPERATURE_COLOR = "#38bdf8"; // temperature — °C, right axis

// Step 5, temperature-as-proxy: overlay a country's seasonal mortality curve on its
// population-weighted monthly temperature. Mortality peaks when temperature bottoms out —
// in January for the northern picks, July–August for the southern ones — so the two lines
// read as mirror images regardless of hemisphere. Pick a country from the dropdown.
export default function TemperatureVsMortality({
  seasonality,
  temperatureCurves,
  features,
}: TemperatureVsMortalityProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [selectedId, setSelectedId] = useState<number>(TEMPERATURE_PICKS[0]!.id);

  const nameById = useMemo(
    () => new Map((features ?? []).map((f) => [Number(f.id), f.properties?.name ?? ""])),
    [features],
  );

  const selectedName =
    TEMPERATURE_PICKS.find((p) => p.id === selectedId)?.name ??
    nameById.get(selectedId) ??
    String(selectedId);

  useEffect(() => {
    if (!seasonality || !temperatureCurves || !svgRef.current) return;
    const mortality = seasonality.countries[String(selectedId)];
    const temperature = temperatureCurves.byM49[String(selectedId)];
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    if (!mortality || !temperature) return;

    const width = 700;
    const height = 300;
    const margin = { top: 16, right: 56, bottom: 38, left: 52 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const fmtFactor = d3.format(".2f");
    const fmtTemp = (d: number) => `${d > 0 ? "+" : ""}${d.toFixed(0)}°`;

    const x = d3.scalePoint().domain(MONTHS).range([0, innerW]).padding(0.35);

    // Both curves are drawn on a shared normalized frame: each series' own mean sits on the
    // baseline and its own peak reaches the top. Temperature is anchored by its COLDEST month
    // (deaths crest when it's coldest), which also inverts it — cold on top. This makes the
    // comparison about *timing* rather than the raw size of each swing, so a near-flat
    // equatorial country is judged on whether its peaks line up, not on magnified noise. The
    // scales stay linear in real units (× and °C), so the true ranges still read off the axes.
    const meanM = d3.mean(mortality) ?? 1;
    const maxM = d3.max(mortality) ?? meanM;
    const meanT = d3.mean(temperature) ?? 0;
    const minT = d3.min(temperature) ?? meanT;
    const spanM = maxM - meanM || 1; // mean → 0, peak → +1
    const spanT = meanT - minT || 1; // mean → 0, coldest → +1
    const normM = mortality.map((v) => (v - meanM) / spanM);
    const normT = temperature.map((v) => (meanT - v) / spanT);
    const lo = Math.min(0, d3.min(normM) ?? 0, d3.min(normT) ?? 0);
    const pad = 0.08 * (1 - lo);
    // norm = lo-pad → bottom, norm = 1+pad → top, identically for both curves.
    const yMort = d3
      .scaleLinear()
      .domain([meanM + (lo - pad) * spanM, meanM + (1 + pad) * spanM])
      .range([innerH, 0]);
    const yTemp = d3
      .scaleLinear()
      .domain([meanT - (lo - pad) * spanT, meanT - (1 + pad) * spanT])
      .range([innerH, 0]);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Shared baseline: both curves' means land here (mortality's ≈1×, temperature's annual mean).
    g.append("line")
      .attr("class", "chart-gridline")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", yMort(meanM))
      .attr("y2", yMort(meanM));

    const lineFor = (scale: d3.ScaleLinear<number, number>) =>
      d3
        .line<number>()
        .x((_, i) => x(MONTHS[i]!) ?? 0)
        .y((d) => scale(d))
        .curve(d3.curveMonotoneX);

    g.append("path")
      .attr("fill", "none")
      .attr("stroke", TEMPERATURE_COLOR)
      .attr("stroke-width", 2.2)
      .attr("d", lineFor(yTemp)(temperature));
    g.append("path")
      .attr("fill", "none")
      .attr("stroke", MORTALITY_COLOR)
      .attr("stroke-width", 2.4)
      .attr("d", lineFor(yMort)(mortality));

    // Axes: months (bottom), mortality multiplier (left), temperature °C (right).
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickSizeOuter(0))
      .call(styleAxis);
    g.append("g")
      .call(
        d3
          .axisLeft(yMort)
          .ticks(5)
          .tickFormat((d) => fmtFactor(Number(d))),
      )
      .call(styleAxis);
    g.append("g")
      .attr("transform", `translate(${innerW},0)`)
      .call(
        d3
          .axisRight(yTemp)
          .ticks(5)
          .tickFormat((d) => `${Number(d).toFixed(0)}°`),
      )
      .call(styleAxis);

    // Shared vertical hover: nearest month, both values at once.
    const focus = g.append("g").style("display", "none");
    focus
      .append("line")
      .attr("class", "chart-gridline")
      .attr("y1", 0)
      .attr("y2", innerH)
      .style("stroke-dasharray", "none");
    const dotMort = focus.append("circle").attr("r", 3.6).attr("fill", MORTALITY_COLOR);
    const dotTemp = focus.append("circle").attr("r", 3.6).attr("fill", TEMPERATURE_COLOR);

    const step = innerW / (MONTHS.length - 1);
    g.append("rect")
      .attr("width", innerW)
      .attr("height", innerH)
      .attr("fill", "none")
      .attr("pointer-events", "all")
      .on("pointerenter", () => focus.style("display", null))
      .on("pointerleave", () => {
        focus.style("display", "none");
        hideTooltip();
      })
      .on("pointermove", (event) => {
        const [px] = d3.pointer(event, g.node());
        const i = Math.max(0, Math.min(MONTHS.length - 1, Math.round(px / step)));
        const mx = x(MONTHS[i]!) ?? 0;
        focus.select("line").attr("x1", mx).attr("x2", mx);
        dotMort.attr("cx", mx).attr("cy", yMort(mortality[i]!));
        dotTemp.attr("cx", mx).attr("cy", yTemp(temperature[i]!));
        showTooltip(
          `${MONTHS[i]}: ${fmtFactor(mortality[i]!)}× deaths, ${fmtTemp(temperature[i]!)}C`,
          event.clientX,
          event.clientY,
        );
      });
  }, [seasonality, temperatureCurves, selectedId]);

  return (
    <section className="chart-panel wide">
      <h4 className="chart-title">Temperature vs. Seasonal Mortality</h4>
      <p className="chart-copy">
        A country&apos;s seasonal mortality (red, left axis) against its population-weighted monthly
        temperature (blue, right axis). Each curve is scaled to its own mean and peak, and the
        temperature axis is <em>inverted</em> — cold on top — so the comparison is about{" "}
        <em>timing</em>: where the two lines rise and fall together, deaths are tracking the cold.
        The match holds through the northern winter and, six months out of phase, the southern one,
        then falls apart near the equator (Ecuador), where deaths follow the wet season rather than
        temperature. The real size of each swing still reads off the axis ranges. That timing match
        is what makes temperature a candidate proxy for countries without a measured curve.
      </p>

      <div className="cc-combobox">
        <label className="cc-label" htmlFor="temperature-country-select">
          Country
        </label>
        <select
          id="temperature-country-select"
          className="cc-select"
          value={selectedId}
          onChange={(e) => setSelectedId(Number(e.target.value))}
        >
          {TEMPERATURE_PICKS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.lat})
            </option>
          ))}
        </select>
      </div>

      <svg
        ref={svgRef}
        id="temperature-vs-mortality-chart"
        className="seasonality-chart"
        viewBox="0 0 700 300"
        role="img"
        aria-label={`Dual-axis line chart overlaying ${selectedName}'s seasonal mortality multiplier on its monthly mean temperature`}
      />

      <div className="chart-legend">
        <span>
          <span className="swatch" style={{ color: MORTALITY_COLOR }} /> Mortality (× annual
          average)
        </span>
        <span>
          <span className="swatch" style={{ color: TEMPERATURE_COLOR }} /> Temperature (°C,
          inverted)
        </span>
      </div>
    </section>
  );
}
