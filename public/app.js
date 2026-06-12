/* global d3, topojson */

const WIDTH = 960;
const HEIGHT = 500;

// --- Death frequency (real time, Poisson) --------------------------------
// Each dot = one real death. A country's real deaths per year are
//   deathsPerYear = CDR * population / 1000
// so the MEAN interval between deaths is meanMs = MS_PER_YEAR_REAL / deathsPerYear.
// Deaths are modelled as a Poisson process: gaps are exponentially distributed
// with that mean, so dots appear at random (clustering and spacing out) rather
// than on a fixed beat. Populous countries emit a dot every few seconds; tiny
// ones almost never — and across the whole world it sums to ~2 deaths/second.
const MS_PER_YEAR_REAL = 365.25 * 24 * 3600 * 1000;
const DOT_MS = 3500; // lifetime of one death dot: appear, grow, fade, vanish
const DOT_MAX_R = 16; // max dot radius in the 960×500 viewBox units
const MAX_DOTS = 600; // safety cap on concurrent dots
const CATCHUP_CAP = DOT_MS; // events older than this (e.g. backgrounded tab) don't spawn
// -------------------------------------------------------------------------

// Exponential inter-arrival time for a Poisson process with the given mean.
function expGap(mean) {
  return -Math.log(1 - Math.random()) * mean;
}

const statusEl = document.getElementById("status");
const bannerEl = document.getElementById("sample-banner");
const subtitleEl = document.getElementById("subtitle");
const tooltip = document.getElementById("tooltip");

const NO_DATA_FILL = "#33384a";

async function main() {
  let topo, mortality;
  try {
    [topo, mortality] = await Promise.all([
      d3.json("/data/countries-110m.json"),
      d3.json("/api/mortality"),
    ]);
  } catch (err) {
    statusEl.textContent = "Failed to load data. Please try again later.";
    console.error(err);
    return;
  }

  statusEl.classList.add("hidden");

  if (mortality.source === "sample") {
    bannerEl.classList.remove("hidden");
    bannerEl.textContent =
      "⚠ Showing bundled sample data — the live World Bank API was unreachable from the server. " +
      "On a deployment with open internet (e.g. Railway) this shows real data.";
  }

  subtitleEl.textContent =
    `${mortality.indicator} — latest available (≤ ${mortality.year}). ` +
    `Each dot is one real death, in real time (~2 people die worldwide every second).`;

  // Maps keyed by M49 numeric id.
  const valueById = new Map(mortality.values.map((d) => [Number(d.id), d.value]));
  const nameById = new Map(mortality.values.map((d) => [Number(d.id), d.name]));
  const yearById = new Map(mortality.values.map((d) => [Number(d.id), d.year]));

  // Per-country death stats: mean interval (ms) between deaths. Needs CDR + pop.
  const blinkById = new Map();
  for (const v of mortality.values) {
    const id = Number(v.id);
    const cdr = v.value;
    const pop = v.population;
    if (!(cdr > 0) || !(pop > 0)) continue;
    const deathsPerYear = (cdr * pop) / 1000;
    blinkById.set(id, { meanMs: MS_PER_YEAR_REAL / deathsPerYear, deathsPerYear });
  }

  const countries = topojson.feature(topo, topo.objects.countries).features;

  const projection = d3.geoNaturalEarth1().fitSize([WIDTH, HEIGHT], { type: "Sphere" });
  const path = d3.geoPath(projection);

  const svg = d3
    .select("#map")
    .attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  svg.append("path").attr("class", "sphere").attr("d", path({ type: "Sphere" }));

  svg
    .append("g")
    .selectAll("path")
    .data(countries)
    .join("path")
    .attr("class", "country")
    .attr("d", path)
    .attr("fill", (d) => (blinkById.has(Number(d.id)) ? "#fff" : NO_DATA_FILL))
    .on("mousemove", (event, d) =>
      showTooltip(event, d, valueById, nameById, yearById, blinkById, mortality)
    )
    .on("mouseleave", hideTooltip);

  // Dots render above the land, and don't intercept pointer events (see CSS) so
  // country hover/tooltip still works.
  const dotLayer = svg.append("g").attr("class", "dots");

  // Pick a random screen point that lies inside the country, by rejection sampling
  // over its projected bounding box and testing membership with d3.geoContains on
  // the inverse-projected lon/lat. Falls back to the centroid for thin/tiny shapes.
  function randomPointInCountry(feature, bounds) {
    const [[x0, y0], [x1, y1]] = bounds;
    for (let i = 0; i < 30; i++) {
      const x = x0 + Math.random() * (x1 - x0);
      const y = y0 + Math.random() * (y1 - y0);
      const ll = projection.invert([x, y]);
      if (ll && d3.geoContains(feature, ll)) return [x, y];
    }
    return path.centroid(feature);
  }

  // Animation loop: each death (Poisson event) spawns a red dot at a random point
  // inside the country; the dot grows and fades over DOT_MS, then is removed.
  // `next` is the scheduled time of the upcoming death; on firing we draw the next gap.
  const state = countries
    .filter((d) => blinkById.has(Number(d.id)))
    .map((feature) => {
      const mean = blinkById.get(Number(feature.id)).meanMs;
      return { feature, bounds: path.bounds(feature), mean, next: expGap(mean) };
    });
  const dots = [];
  const start = performance.now();

  function frame(now) {
    const t = now - start;
    for (const s of state) {
      while (t >= s.next) {
        // Skip events too far in the past (e.g. after a backgrounded tab) so we
        // don't spawn a burst; recent events spawn a dot.
        if (t - s.next <= CATCHUP_CAP && dots.length < MAX_DOTS) {
          const [x, y] = randomPointInCountry(s.feature, s.bounds);
          const el = dotLayer.append("circle").attr("class", "death-dot").attr("cx", x).attr("cy", y).attr("r", 0).node();
          dots.push({ el, t0: s.next });
        }
        s.next += expGap(s.mean);
      }
    }
    // Grow + fade the active dots; remove once their lifetime is spent.
    for (let i = dots.length - 1; i >= 0; i--) {
      const p = (t - dots[i].t0) / DOT_MS;
      if (p >= 1) {
        dots[i].el.remove();
        dots.splice(i, 1);
        continue;
      }
      // Grows steadily across the whole lifetime while fading out.
      dots[i].el.setAttribute("r", DOT_MAX_R * p);
      dots[i].el.setAttribute("opacity", 1 - p);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  drawLegend();
}

function showTooltip(event, d, valueById, nameById, yearById, blinkById, mortality) {
  const id = Number(d.id);
  const v = valueById.get(id);
  const name = nameById.get(id) || (d.properties && d.properties.name) || "Unknown";
  const year = yearById.get(id) || mortality.year;
  const blink = blinkById.get(id);
  tooltip.classList.remove("hidden");
  tooltip.innerHTML =
    `<div class="tt-name">${name}</div>` +
    (v == null
      ? `<div class="tt-value">No data</div>`
      : `<div class="tt-value">${v.toFixed(1)} deaths / 1,000</div>` +
        (blink
          ? `<div style="color:var(--muted)">${fmtDeaths(blink.deathsPerYear)} deaths/yr · ` +
            `avg 1 / ${fmtInterval(blink.meanMs)} · ${year}</div>`
          : `<div style="color:var(--muted)">${year}</div>`));
  const pad = 14;
  let x = event.clientX + pad;
  let y = event.clientY + pad;
  const r = tooltip.getBoundingClientRect();
  if (x + r.width > window.innerWidth) x = event.clientX - r.width - pad;
  if (y + r.height > window.innerHeight) y = event.clientY - r.height - pad;
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function hideTooltip() {
  tooltip.classList.add("hidden");
}

function fmtDeaths(perYear) {
  return d3.format(",.0f")(perYear);
}

// Human-readable average interval between deaths.
function fmtInterval(ms) {
  const s = ms / 1000;
  if (s < 90) return `${s.toFixed(1)}s`;
  const m = s / 60;
  if (m < 90) return `${m.toFixed(1)} min`;
  const h = m / 60;
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} days`;
}

function drawLegend() {
  d3.select("#legend")
    .html("")
    .append("div")
    .html(
      `<span style="color:var(--accent)">●</span> each dot is a death, ` +
        `at a random place in that country, in real time (Poisson). ` +
        `Hover a country for its rate.`
    );
}

main();
