/* global d3, topojson */

const WIDTH = 960;
const HEIGHT = 500;

const statusEl = document.getElementById("status");
const bannerEl = document.getElementById("sample-banner");
const subtitleEl = document.getElementById("subtitle");
const tooltip = document.getElementById("tooltip");

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

  subtitleEl.textContent = `${mortality.indicator} — latest available (≤ ${mortality.year})`;

  // Maps keyed by M49 numeric id.
  const valueById = new Map(mortality.values.map((d) => [Number(d.id), d.value]));
  const nameById = new Map(mortality.values.map((d) => [Number(d.id), d.name]));
  const yearById = new Map(mortality.values.map((d) => [Number(d.id), d.year]));

  const countries = topojson.feature(topo, topo.objects.countries).features;

  const values = mortality.values.map((d) => d.value);
  const color = d3
    .scaleSequential(d3.interpolateReds)
    .domain([d3.min(values), d3.max(values)]);

  const projection = d3
    .geoNaturalEarth1()
    .fitSize([WIDTH, HEIGHT], { type: "Sphere" });
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
    .attr("fill", (d) => {
      const v = valueById.get(Number(d.id));
      return v == null ? "var(--no-data)" : color(v);
    })
    .on("mousemove", (event, d) =>
      showTooltip(event, d, valueById, nameById, yearById, mortality)
    )
    .on("mouseleave", hideTooltip);

  drawLegend(color, d3.extent(values), mortality.indicator);
}

function showTooltip(event, d, valueById, nameById, yearById, mortality) {
  const id = Number(d.id);
  const v = valueById.get(id);
  const name = nameById.get(id) || (d.properties && d.properties.name) || "Unknown";
  const year = yearById.get(id) || mortality.year;
  tooltip.classList.remove("hidden");
  tooltip.innerHTML =
    `<div class="tt-name">${name}</div>` +
    (v == null
      ? `<div class="tt-value">No data</div>`
      : `<div class="tt-value">${v.toFixed(1)} deaths / 1,000</div>` +
        `<div style="color:var(--muted)">${year}</div>`);
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

function drawLegend(color, [min, max], label) {
  const w = 280;
  const h = 12;
  const legend = d3.select("#legend").html("");

  const svg = legend.append("svg").attr("width", w).attr("height", h + 24);

  const defs = svg.append("defs");
  const grad = defs
    .append("linearGradient")
    .attr("id", "legend-grad")
    .attr("x1", "0%")
    .attr("x2", "100%");
  const stops = 10;
  for (let i = 0; i <= stops; i++) {
    const t = i / stops;
    grad
      .append("stop")
      .attr("offset", `${t * 100}%`)
      .attr("stop-color", color(min + t * (max - min)));
  }

  svg
    .append("rect")
    .attr("width", w)
    .attr("height", h)
    .attr("rx", 3)
    .attr("fill", "url(#legend-grad)");

  const x = d3.scaleLinear().domain([min, max]).range([0, w]);
  const axis = d3.axisBottom(x).ticks(5).tickSize(4).tickFormat(d3.format(".0f"));
  svg
    .append("g")
    .attr("transform", `translate(0,${h})`)
    .call(axis)
    .call((g) => g.select(".domain").remove())
    .selectAll("text")
    .attr("fill", "var(--muted)");

  legend.append("div").text(`${label} (lower → higher)`);
}

main();
