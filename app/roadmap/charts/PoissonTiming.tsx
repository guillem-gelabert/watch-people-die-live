const LAMBDA = 2;
const DAYS = 365;

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
  const limit = Math.exp(-LAMBDA);
  let product = 1;
  let count = 0;
  do {
    count += 1;
    product *= random();
  } while (product > limit);
  return count - 1;
}

const random = seededRandom(2000);
// Fixed display order for the day-blocks (5 stands for the "5+" bucket) — not a
// probability sort, just the arrangement the chart groups squares into.
const categoryOrder = [2, 3, 1, 0, 4, 5];
const samples = Array.from({ length: DAYS }, () => samplePoisson(random)).sort(
  (left, right) =>
    categoryOrder.indexOf(category(left)) - categoryOrder.indexOf(category(right)) || left - right,
);

function category(value: number) {
  return Math.min(value, 5);
}

export default function PoissonTiming() {
  return (
    <section className="chart-panel wide">
      <h4 className="chart-title">One Poisson-distributed year: deaths per day</h4>
      <p className="chart-copy">
        Each square is one of 365 days. With an average of λ = 2 deaths per day, a Poisson model
        draws a random daily count; the colour shows how many deaths landed on that day. The squares
        are grouped by block size — 2, 3, 1, 0, 4, then the rare 5+ block last — rather than shown
        as a chronological calendar.
      </p>
      <div
        className="poisson-calendar"
        role="img"
        aria-label="A simulated year of 365 days, sorted by the number of deaths per day from a Poisson distribution with a mean of two deaths per day"
      >
        {samples.map((sample, day) => (
          <span
            className={`poisson-day poisson-day-${category(sample)}`}
            key={day}
            title={`Day ${day + 1}: ${sample} deaths`}
          />
        ))}
      </div>
      <div className="poisson-legend" aria-label="Deaths-per-day color legend">
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
