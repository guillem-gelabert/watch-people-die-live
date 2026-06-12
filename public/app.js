/* global d3, topojson */

const WIDTH = 960;
const HEIGHT = 500;

// --- Blink frequency (real time) -----------------------------------------
// Each flash = one real death. A country's real deaths per year are
//   deathsPerYear = CDR * population / 1000
// so the average real interval between deaths is
//   interval_ms = MS_PER_YEAR_REAL / deathsPerYear
// Populous countries flash every few seconds; tiny ones almost never — and
// across the whole world it sums to ~2 deaths/second.
const MS_PER_YEAR_REAL = 365.25 * 24 * 3600 * 1000;
const FLASH_MS = 700; // each death flashes to black, fades back to white
// -------------------------------------------------------------------------

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
    `Each flash is one real death, in real time (~2 people die worldwide every second).`;

  // Maps keyed by M49 numeric id.
  const valueById = new Map(mortality.values.map((d) => [Number(d.id), d.value]));
  const nameById = new Map(mortality.values.map((d) => [Number(d.id), d.name]));
  const yearById = new Map(mortality.values.map((d) => [Number(d.id), d.year]));

  // Per-country blink parameters: real average interval between deaths and a
  // random phase so countries don't flash in unison. Needs CDR and population.
  const blinkById = new Map();
  for (const v of mortality.values) {
    const id = Number(v.id);
    const cdr = v.value;
    const pop = v.population;
    if (!(cdr > 0) || !(pop > 0)) continue;
    const deathsPerYear = (cdr * pop) / 1000;
    const period = Math.max(MS_PER_YEAR_REAL / deathsPerYear, FLASH_MS * 1.1);
    blinkById.set(id, { period, phase: Math.random() * period, deathsPerYear });
  }

  const countries = topojson.feature(topo, topo.objects.countries).features;

  const projection = d3.geoNaturalEarth1().fitSize([WIDTH, HEIGHT], { type: "Sphere" });
  const path = d3.geoPath(projection);

  const svg = d3
    .select("#map")
    .attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  svg.append("path").attr("class", "sphere").attr("d", path({ type: "Sphere" }));

  const paths = svg
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

  // Animation loop: a country is white, then flashes to black at t % period and
  // eases back to white over FLASH_MS.
  const nodes = paths.nodes();
  const data = nodes.map((n) => blinkById.get(Number(n.__data__.id)) || null);
  const start = performance.now();
  let prev = nodes.map(() => -1);

  function frame(now) {
    const t = now - start;
    for (let i = 0; i < nodes.length; i++) {
      const b = data[i];
      if (!b) continue;
      const pos = (t + b.phase) % b.period;
      // 0 at flash start (black) -> 255 white at FLASH_MS; white for the rest.
      const shade = pos < FLASH_MS ? Math.round(255 * (pos / FLASH_MS)) : 255;
      if (shade !== prev[i]) {
        nodes[i].setAttribute("fill", `rgb(${shade},${shade},${shade})`);
        prev[i] = shade;
      }
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
            `1 flash / ${fmtInterval(blink.period)} · ${year}</div>`
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
      `<span style="color:#fff">○</span> alive &nbsp;→&nbsp; ` +
        `<span style="color:#000;background:#fff;padding:0 3px;border-radius:2px">●</span> a death, ` +
        `in real time. Hover a country for its rate.`
    );
}

main();
