"use client";

import { useId, useMemo, useState } from "react";
import type {
  SmoothingDemoData,
  SmoothingDemoHarmonicOrder,
  SmoothingDemoModeKey,
  SmoothingDemoPoint,
} from "../types";
import { MONTHS } from "../chartHelpers";
import { selectSmoothingSeries, smoothingMode, SMOOTHING_MODES } from "./smoothingDemo";

const WIDTH = 760;
const HEIGHT = 330;
const MARGIN = { top: 24, right: 24, bottom: 38, left: 54 };

function coordinates(point: SmoothingDemoPoint, yDomain: [number, number]): [number, number] {
  const [phase, value] = point;
  const x = MARGIN.left + phase * (WIDTH - MARGIN.left - MARGIN.right);
  const y =
    MARGIN.top +
    ((yDomain[1] - value) / (yDomain[1] - yDomain[0])) * (HEIGHT - MARGIN.top - MARGIN.bottom);
  return [x, y];
}

function linePath(
  points: SmoothingDemoPoint[],
  stepped: boolean,
  yDomain: [number, number],
): string {
  if (!points.length) return "";
  const coords = points.map((point) => coordinates(point, yDomain));
  if (!stepped) return coords.map(([x, y], index) => `${index ? "L" : "M"}${x},${y}`).join(" ");
  return coords
    .map(([x, y], index) => {
      if (index === 0) return `M${MARGIN.left},${y} L${x},${y}`;
      const previous = coords[index - 1]!;
      const boundary = (previous[0] + x) / 2;
      return `L${boundary},${previous[1]} L${boundary},${y} L${x},${y}`;
    })
    .join(" ");
}

function yTicks([low, high]: [number, number]): number[] {
  return [...new Set([low, 1, high])]
    .filter((tick) => tick >= low && tick <= high)
    .sort((a, b) => a - b);
}

export default function SmoothingExplainer({ data }: { data: SmoothingDemoData | null }) {
  const [selected, setSelected] = useState<SmoothingDemoModeKey>("harmonic");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [order, setOrder] = useState<SmoothingDemoHarmonicOrder>(4);
  const explanationId = useId();
  const chartId = useId();
  const countryControlId = useId();

  const countryCode =
    data && data.countries[selectedCountry] ? selectedCountry : (data?.meta.defaultCountry ?? "");
  const country = data?.countries[countryCode];
  const countries = useMemo(
    () => (data ? Object.values(data.countries).sort((a, b) => a.name.localeCompare(b.name)) : []),
    [data],
  );
  const mode = smoothingMode(selected, order);
  const series = useMemo(
    () => (data && countryCode ? selectSmoothingSeries(data, countryCode, selected, order) : null),
    [countryCode, data, order, selected],
  );

  if (!data || !country || !series) {
    return <p className="chart-status">Loading the smoothing comparison…</p>;
  }

  const yDomain = country.yDomain;
  const path = linePath(series.line, series.stepped, yDomain);
  return (
    <section className="chart-panel wide smoothing-demo" aria-labelledby={`${chartId}-title`}>
      <div className="smoothing-heading">
        <div>
          <h4 className="chart-title" id={`${chartId}-title`}>
            One series, many resolutions
          </h4>
          <p className="chart-copy">
            Every view uses the same complete non-COVID weekly observations and the same mean-1
            scale.
          </p>
        </div>
        <label className="smoothing-country" htmlFor={countryControlId}>
          <span>Country</span>
          <select
            id={countryControlId}
            value={countryCode}
            onChange={(event) => setSelectedCountry(event.target.value)}
          >
            {countries.map((candidate) => (
              <option value={candidate.iso3} key={candidate.iso3}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        className="smoothing-controls"
        role="group"
        aria-label="Observation cadence and smoothing method"
      >
        {SMOOTHING_MODES.map((candidate) => (
          <button
            type="button"
            key={candidate.key}
            className={`smoothing-control${candidate.key === selected ? " active" : ""}`}
            aria-pressed={candidate.key === selected}
            aria-controls={`${chartId} ${explanationId}`}
            onClick={() => setSelected(candidate.key)}
          >
            {candidate.label}
          </button>
        ))}
      </div>

      {selected === "harmonic" ? (
        <div className="smoothing-order" role="group" aria-label="Harmonic order">
          <span>Order</span>
          {data.meta.harmonicOrders.map((candidate) => (
            <button
              type="button"
              key={candidate}
              className={`smoothing-order-control${candidate === order ? " active" : ""}`}
              aria-pressed={candidate === order}
              aria-controls={`${chartId} ${explanationId}`}
              onClick={() => setOrder(candidate)}
            >
              {candidate}
            </button>
          ))}
        </div>
      ) : null}

      <svg
        id={chartId}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="story-figure smoothing-chart"
        role="img"
        aria-label={`${mode.label} view of ${country.name}'s seasonal mortality multiplier. Values range from ${yDomain[0]} to ${yDomain[1]}, with annual average at 1.`}
      >
        {yTicks(yDomain).map((tick) => {
          const [, y] = coordinates([0, tick], yDomain);
          return (
            <g key={tick}>
              <line
                className="smoothing-grid"
                x1={MARGIN.left}
                x2={WIDTH - MARGIN.right}
                y1={y}
                y2={y}
              />
              <text className="chart-tick" x={MARGIN.left - 9} y={y + 4} textAnchor="end">
                {tick.toFixed(2).replace(/0$/, "")}×
              </text>
            </g>
          );
        })}
        {MONTHS.filter((_, index) => index % 3 === 0).map((month, index) => {
          const phase = (index * 3 + 0.5) / 12;
          const [x] = coordinates([phase, 1], yDomain);
          return (
            <text key={month} className="chart-tick" x={x} y={HEIGHT - 12} textAnchor="middle">
              {month}
            </text>
          );
        })}
        <path className="smoothing-line" d={path} />
        <g aria-hidden="true">
          {series.observations.map((point, index) => {
            const [x, y] = coordinates(point, yDomain);
            return (
              <circle
                className="smoothing-point"
                cx={x}
                cy={y}
                r={2.7}
                key={`${point[0]}-${index}`}
              />
            );
          })}
        </g>
      </svg>

      <dl className="smoothing-copy" id={explanationId} aria-live="polite">
        <div>
          <dt>How it works</dt>
          <dd>{mode.how}</dd>
        </div>
        <div>
          <dt>Good for</dt>
          <dd>{mode.goodFor}</dd>
        </div>
        <div>
          <dt>Watch out</dt>
          <dd>{mode.watchOut}</dd>
        </div>
      </dl>
      <p className="smoothing-source">
        {data.meta.source}. {country.name}: {country.years[0]}–{country.years.at(-1)}; 2020–2022
        excluded.
      </p>
    </section>
  );
}
