/* global d3, topojson */
import * as THREE from "three";
import { OrbitControls } from "/vendor/OrbitControls.js";

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
const DOT_MAX_R = 0.028; // max dot radius in globe units (earth radius = 1)
const MAX_DOTS = 600; // safety cap on concurrent dots
const CATCHUP_CAP = DOT_MS; // events older than this (e.g. backgrounded tab) don't spawn

// Globe / texture.
const GLOBE_R = 1;
const TEX_W = 2048;
const TEX_H = 1024;
const OCEAN_FILL = "#11151c";
const NO_DATA_FILL = "#33384a";
const DOT_COLOR = 0xff5252;
// -------------------------------------------------------------------------

// Exponential inter-arrival time for a Poisson process with the given mean.
function expGap(mean) {
  return -Math.log(1 - Math.random()) * mean;
}

// lon/lat (degrees) -> point on a sphere textured with a standard equirectangular
// map (north up, lon -180 at the left seam). Inverse is vec3ToLonLat below.
function lonLatToVec3(lon, lat, r) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

function vec3ToLonLat(p) {
  const r = p.length();
  const lat = 90 - (Math.acos(p.y / r) * 180) / Math.PI;
  let lon = (Math.atan2(p.z, -p.x) * 180) / Math.PI - 180;
  while (lon < -180) lon += 360;
  while (lon > 180) lon -= 360;
  return [lon, lat];
}

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

  // --- Base map: draw the world once into a canvas, used as a sphere texture ---
  const canvas = document.createElement("canvas");
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext("2d");
  const projection = d3
    .geoEquirectangular()
    .scale(TEX_W / (2 * Math.PI))
    .translate([TEX_W / 2, TEX_H / 2]);
  const geoPathStr = d3.geoPath(projection); // returns an SVG path string (no context)
  ctx.fillStyle = OCEAN_FILL;
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  for (const f of countries) {
    ctx.fillStyle = blinkById.has(Number(f.id)) ? "#ffffff" : NO_DATA_FILL;
    ctx.fill(new Path2D(geoPathStr(f)));
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  // --- three.js scene ---
  const container = document.getElementById("globe");
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x808080); // 50% gray background
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 3);

  const globe = new THREE.Group();
  scene.add(globe);
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_R, 64, 64),
    new THREE.MeshBasicMaterial({ map: texture })
  );
  globe.add(earth);
  const dotsGroup = new THREE.Group();
  globe.add(dotsGroup); // dots rotate with the earth

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; // momentum
  controls.enablePan = false;
  controls.minDistance = 1.25;
  controls.maxDistance = 6;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight || Math.round(w * 0.6);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  // --- Death dots (3D spheres intersecting the surface) ---
  const dotGeo = new THREE.SphereGeometry(1, 12, 12);

  // Random lon/lat inside a country via rejection sampling over its geographic
  // bounds; falls back to the centroid for thin/tiny shapes.
  function randomLonLat(feature, bounds) {
    const [[lon0, lat0], [lon1, lat1]] = bounds;
    for (let i = 0; i < 30; i++) {
      const lon = lon0 + Math.random() * (lon1 - lon0);
      const lat = lat0 + Math.random() * (lat1 - lat0);
      if (d3.geoContains(feature, [lon, lat])) return [lon, lat];
    }
    return d3.geoCentroid(feature);
  }

  const state = countries
    .filter((d) => blinkById.has(Number(d.id)))
    .map((feature) => {
      const mean = blinkById.get(Number(feature.id)).meanMs;
      return { feature, bounds: d3.geoBounds(feature), mean, next: expGap(mean) };
    });
  const dots = [];
  const start = performance.now();

  function spawnDot(lon, lat, t0) {
    const mat = new THREE.MeshBasicMaterial({ color: DOT_COLOR, transparent: true });
    const m = new THREE.Mesh(dotGeo, mat);
    m.position.copy(lonLatToVec3(lon, lat, GLOBE_R)); // centered on surface -> straddles it
    m.scale.setScalar(1e-4);
    dotsGroup.add(m);
    dots.push({ m, mat, t0 });
  }

  function frame(now) {
    const t = now - start;
    for (const s of state) {
      while (t >= s.next) {
        // Skip events too far in the past (e.g. backgrounded tab) to avoid a burst.
        if (t - s.next <= CATCHUP_CAP && dots.length < MAX_DOTS) {
          const [lon, lat] = randomLonLat(s.feature, s.bounds);
          spawnDot(lon, lat, s.next);
        }
        s.next += expGap(s.mean);
      }
    }
    // Grow + fade active dots; remove once their lifetime is spent.
    for (let i = dots.length - 1; i >= 0; i--) {
      const p = (t - dots[i].t0) / DOT_MS;
      if (p >= 1) {
        dotsGroup.remove(dots[i].m);
        dots[i].mat.dispose();
        dots.splice(i, 1);
        continue;
      }
      dots[i].m.scale.setScalar(Math.max(DOT_MAX_R * p, 1e-4));
      dots[i].mat.opacity = 1 - p;
    }
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // --- Hover tooltip: raycast the globe, map the hit point back to a country ---
  const raycaster = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  renderer.domElement.addEventListener("mousemove", (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    ptr.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    ptr.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ptr, camera);
    const hit = raycaster.intersectObject(earth, false)[0];
    if (!hit) return hideTooltip();
    const [lon, lat] = vec3ToLonLat(earth.worldToLocal(hit.point.clone()));
    const feature = countries.find((f) => d3.geoContains(f, [lon, lat]));
    if (!feature) return hideTooltip();
    showTooltip(event, feature, valueById, nameById, yearById, blinkById, mortality);
  });
  renderer.domElement.addEventListener("mouseleave", hideTooltip);

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
        `Drag to rotate · scroll/pinch to zoom · hover a country for its rate.`
    );
}

main();
