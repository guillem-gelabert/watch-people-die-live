/* global d3, topojson */

const WIDTH = 960;
const HEIGHT = 500;

// --- Blink frequency (real time, Poisson) --------------------------------
// Each flash = one real death. A country's real deaths per year are
//   deathsPerYear = CDR * population / 1000
// We no longer flash whole countries: each death is placed on the population
// grid, so a country's deaths are split across its cells in proportion to how
// many people live there (cell population). Denser cells therefore die far more
// often than empty ones, while every country's TOTAL deaths/year is preserved
// exactly (the per-cell rates sum back to the country rate). Each cell is its
// own Poisson process: gaps are exponentially distributed, so flashes cluster
// and spread out at random rather than on a fixed beat.
const MS_PER_YEAR_REAL = 365.25 * 24 * 3600 * 1000;
const FLASH_MS = 700; // each death flashes bright, then fades back to baseline
// Baseline grey of a cell, by population (log-scaled). The dim end sits just
// above the near-black background so the populated grid reads as a density map.
const BASE_MIN = 12;
const BASE_MAX = 92;
const BG = "#0a0c10";
// -------------------------------------------------------------------------

// Exponential inter-arrival time for a Poisson process with the given mean.
function expGap(mean) {
  return -Math.log(1 - Math.random()) * mean;
}

const statusEl = document.getElementById("status");
const bannerEl = document.getElementById("sample-banner");
const subtitleEl = document.getElementById("subtitle");
const tooltip = document.getElementById("tooltip");

async function main() {
  let topo, grid, mortality;
  try {
    [topo, grid, mortality] = await Promise.all([
      d3.json("/data/countries-110m.json"),
      d3.json("/data/density-grid.json"),
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
    `Each flash is one real death, placed on the population grid in real time: ` +
    `denser regions die more (~2 people worldwide every second).`;

  // Per-country names + real deaths/year (the country total we must preserve).
  const nameById = new Map(mortality.values.map((d) => [Number(d.id), d.name]));
  const deathsPerYearByCountry = new Map();
  for (const v of mortality.values) {
    if (!(v.value > 0) || !(v.population > 0)) continue;
    deathsPerYearByCountry.set(Number(v.id), (v.value * v.population) / 1000);
  }

  // Grid cells: [lon, lat, pop, m49] (lon/lat = south-west corner). Sum each
  // country's cell population so we can split its deaths by population share.
  const cells = grid.cells;
  const cs = grid.cellsize;
  const sumPopByCountry = new Map();
  for (const [, , pop, m49] of cells) {
    sumPopByCountry.set(m49, (sumPopByCountry.get(m49) || 0) + pop);
  }

  // --- Projection + per-cell screen geometry (computed once) ---------------
  const projection = d3.geoNaturalEarth1().fitSize([WIDTH, HEIGHT], { type: "Sphere" });
  const path = d3.geoPath(projection);

  let maxLogPop = 1;
  for (const c of cells) maxLogPop = Math.max(maxLogPop, Math.log10(c[2] + 1));

  // For each cell precompute its screen rect, baseline grey, and Poisson state.
  const n = cells.length;
  const cx = new Float32Array(n);
  const cyA = new Float32Array(n);
  const cw = new Float32Array(n);
  const ch = new Float32Array(n);
  const baseline = new Uint8Array(n);
  const state = new Array(n).fill(null);
  const cellByKey = new Map(); // for tooltip hit-testing
  const keyOf = (lon, lat) =>
    Math.round(Math.floor(lat / cs)) * 100000 + Math.round(Math.floor(lon / cs)) + 500000;

  for (let i = 0; i < n; i++) {
    const [lon, lat, pop, m49] = cells[i];
    const sw = projection([lon, lat]);
    const ne = projection([lon + cs, lat + cs]);
    if (!sw || !ne) continue;
    const x = Math.min(sw[0], ne[0]);
    const y = Math.min(sw[1], ne[1]);
    const w = Math.abs(ne[0] - sw[0]);
    const h = Math.abs(ne[1] - sw[1]);
    if (w > 60 || h > 60) continue; // antimeridian wrap-around guard
    // +0.6px overlap closes hairline seams between neighbouring cells.
    cx[i] = x - 0.3;
    cyA[i] = y - 0.3;
    cw[i] = w + 0.6;
    ch[i] = h + 0.6;
    baseline[i] = Math.round(BASE_MIN + (BASE_MAX - BASE_MIN) * (Math.log10(pop + 1) / maxLogPop));
    cellByKey.set(keyOf(lon, lat), i);

    // Death rate for this cell = country's deaths/yr * (cell pop / country pop).
    const countryDeaths = deathsPerYearByCountry.get(m49);
    const sumPop = sumPopByCountry.get(m49);
    if (countryDeaths > 0 && sumPop > 0) {
      const deathsPerYear = (countryDeaths * pop) / sumPop;
      const mean = MS_PER_YEAR_REAL / deathsPerYear;
      state[i] = { mean, flashStart: -Infinity, next: expGap(mean), deathsPerYear, m49, pop };
    }
  }

  // --- Two stacked canvases: static density map + dynamic flashes ----------
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const bg = setupCanvas(document.getElementById("map-bg"), dpr);
  const fg = setupCanvas(document.getElementById("map-fg"), dpr);

  // Background (drawn once): near-black field, the density cells, faint borders.
  bg.fillStyle = BG;
  bg.fillRect(0, 0, WIDTH, HEIGHT);
  for (let i = 0; i < n; i++) {
    if (!cw[i]) continue;
    const b = baseline[i];
    bg.fillStyle = `rgb(${b},${b},${b})`;
    bg.fillRect(cx[i], cyA[i], cw[i], ch[i]);
  }
  bg.strokeStyle = "rgba(120,132,156,0.16)";
  bg.lineWidth = 0.5;
  bg.beginPath();
  const ctxPath = d3.geoPath(projection, bg);
  ctxPath(topojson.mesh(topo, topo.objects.countries));
  bg.stroke();

  // Animation: advance every cell's Poisson clock each frame (cheap), but only
  // redraw the few cells currently flashing onto the transparent foreground.
  const start = performance.now();
  const active = new Uint8Array(n); // 1 while a cell's flash is on the fg layer

  function frame(now) {
    const t = now - start;
    for (let i = 0; i < n; i++) {
      const s = state[i];
      if (!s) continue;
      while (t >= s.next) {
        s.flashStart = s.next;
        s.next += expGap(s.mean);
      }
      const age = t - s.flashStart;
      if (age < FLASH_MS) {
        // Bright at the moment of death, fading back to the cell's baseline grey.
        const shade = Math.round(255 - (255 - baseline[i]) * (age / FLASH_MS));
        fg.clearRect(cx[i], cyA[i], cw[i], ch[i]);
        fg.fillStyle = `rgb(${shade},${shade},${shade})`;
        fg.fillRect(cx[i], cyA[i], cw[i], ch[i]);
        active[i] = 1;
      } else if (active[i]) {
        fg.clearRect(cx[i], cyA[i], cw[i], ch[i]);
        active[i] = 0;
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Tooltip: map the cursor back to a grid cell and report its local rate.
  const fgEl = document.getElementById("map-fg");
  fgEl.addEventListener("mousemove", (e) => {
    const r = fgEl.getBoundingClientRect();
    const lx = ((e.clientX - r.left) / r.width) * WIDTH;
    const ly = ((e.clientY - r.top) / r.height) * HEIGHT;
    const ll = projection.invert ? projection.invert([lx, ly]) : null;
    if (!ll || Number.isNaN(ll[0])) return hideTooltip();
    const i = cellByKey.get(keyOf(ll[0], ll[1]));
    if (i == null) return hideTooltip();
    showTooltip(e, i, cells[i], state[i], nameById, mortality);
  });
  fgEl.addEventListener("mouseleave", hideTooltip);

  drawLegend();
}

function setupCanvas(el, dpr) {
  el.width = WIDTH * dpr;
  el.height = HEIGHT * dpr;
  const ctx = el.getContext("2d");
  ctx.scale(dpr, dpr);
  return ctx;
}

function showTooltip(event, i, cell, s, nameById, mortality) {
  const m49 = cell[3];
  const name = nameById.get(m49) || "Unknown";
  tooltip.classList.remove("hidden");
  tooltip.innerHTML =
    `<div class="tt-name">${name}</div>` +
    `<div class="tt-value">${fmtDeaths(cell[2])} people here</div>` +
    (s
      ? `<div style="color:var(--muted)">${fmtDeaths(s.deathsPerYear)} deaths/yr in this cell · ` +
        `avg 1 / ${fmtInterval(s.mean)}</div>`
      : `<div style="color:var(--muted)">No mortality data · ${mortality.year}</div>`);
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
  const days = h / 24;
  if (days < 365) return `${days.toFixed(1)} days`;
  return `${(days / 365.25).toFixed(1)} yr`;
}

function drawLegend() {
  d3.select("#legend")
    .html("")
    .append("div")
    .html(
      `Brightness = population density. ` +
        `<span style="color:#fff">●</span> a death, placed at random in real time (Poisson) ` +
        `where people actually live. Hover the map for a cell's local rate.`
    );
}

main();
