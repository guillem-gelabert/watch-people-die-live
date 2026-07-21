"use client";

import { showTooltip, hideTooltip } from "../tooltip";

const ANNUAL_DEATHS = 61_600_000;
const SECONDS_PER_YEAR = 365.25 * 24 * 60 * 60;
const LAMBDA_PER_SECOND = ANNUAL_DEATHS / SECONDS_PER_YEAR;
const SAMPLE_SECONDS = 365;

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function samplePoisson(random: () => number) {
  const limit = Math.exp(-LAMBDA_PER_SECOND);
  let product = 1;
  let count = 0;
  do {
    count += 1;
    product *= random();
  } while (product > limit);
  return count - 1;
}

const random = seededRandom(2000);
// Fixed display order for the sample blocks (5 stands for the "5+" bucket) — not a
// probability sort, just the arrangement the chart groups squares into.
const categoryOrder = [2, 3, 1, 0, 4, 5];
const samples = Array.from({ length: SAMPLE_SECONDS }, () => samplePoisson(random)).sort(
  (left, right) =>
    categoryOrder.indexOf(category(left)) - categoryOrder.indexOf(category(right)) || left - right,
);

function category(value: number) {
  return Math.min(value, 5);
}

export default function PoissonTiming() {
  return (
    <section className="chart-panel wide">
      <h4 className="chart-title">365 sampled seconds: deaths per second</h4>
      <p className="chart-copy">
        An annual average of roughly 61.6 million deaths implies λ ≈ 1.95 deaths per second. Each
        square is one sampled one-second interval; the colour shows how many deaths the Poisson
        model placed in it. The squares are grouped by block size — 2, 3, 1, 0, 4, then the rare 5+
        block last — rather than shown chronologically.
      </p>
      <div
        className="poisson-calendar"
        role="img"
        aria-label="365 sampled one-second intervals, sorted by the number of deaths in each second from a Poisson distribution with a mean of approximately 1.95 deaths per second"
      >
        {samples.map((sample, index) => (
          <span
            className={`poisson-day poisson-day-${category(sample)}`}
            key={index}
            onPointerMove={(event) =>
              showTooltip(
                `${sample} ${sample === 1 ? "death" : "deaths"} in this simulated second`,
                event.clientX,
                event.clientY,
              )
            }
            onPointerLeave={hideTooltip}
          />
        ))}
      </div>
      <div className="poisson-legend" aria-label="Deaths-per-second color legend">
        {categoryOrder.map((label) => (
          <span key={label}>
            <i className={`poisson-day poisson-day-${label}`} />
            {label === 5 ? "5+" : label}
          </span>
        ))}
      </div>
    </section>
  );
}
