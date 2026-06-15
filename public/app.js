/* global d3, topojson */
import * as THREE from "three";
import { OrbitControls } from "/vendor/OrbitControls.js";
import {
  earthVertexShader,
  earthFragmentShader,
  atmosphereVertexShader,
  atmosphereFragmentShader,
} from "./shaders.js";
import { makePersona, initPersona } from "./persona.js";

// --- Death frequency (real time, Poisson) --------------------------------
// Each dot = one real death. A country's real deaths per year are
//   deathsPerYear = CDR * population / 1000
// so the MEAN interval between deaths is meanMs = MS_PER_YEAR_REAL / deathsPerYear.
// Deaths are modelled as a Poisson process: gaps are exponentially distributed
// with that mean, so dots appear at random (clustering and spacing out) rather
// than on a fixed beat. Populous countries emit a dot every few seconds; tiny
// ones almost never — and across the whole world it sums to ~2 deaths/second.
const MS_PER_YEAR_REAL = 365.25 * 24 * 3600 * 1000;
// Each death is an "atomic blast seen from space": a brief diffuse white flash,
// then a single subtle shockwave that refracts the surface (in the earth shader)
// and dissipates.
// The flash is the atomic "double flash": a near-instant first pulse, a brief
// dark minimum, then a longer, brighter second pulse that slowly fades (the
// bhangmeter signature). The real first pulse is ~1ms — sub-frame at 60fps — so
// it's scaled up here to stay perceptible while keeping the character.
const FLASH_MS = 2200; // full double-flash lifetime: pulse, dark, second flash, fade
const SHOCK_MS = 2600; // surface shockwave ripple: expand outward and dissipate
const BLAST_MS = Math.max(FLASH_MS, SHOCK_MS); // total blast lifetime
const FLASH_R = 0.1; // flash sprite radius in globe units (earth radius = 1)
const N_BLASTS = 16; // max concurrent ripples; MUST match N_BLASTS in shaders.js
const MAX_DOTS = 600; // safety cap on concurrent blasts
const CATCHUP_CAP = BLAST_MS; // events older than this (e.g. backgrounded tab) don't spawn

// Globe.
const GLOBE_R = 1;
const ATMOSPHERE_DAY_COLOR = "#00aaff";
const ATMOSPHERE_TWILIGHT_COLOR = "#ff6600";
// -------------------------------------------------------------------------

// Direction to the sun, as a unit vector in the same frame as the earth texture:
// it points at the subsolar point (where the sun is overhead right now). The
// subsolar longitude tracks UTC (15°/hour, 0° ≈ noon UTC at Greenwich); the
// latitude is the solar declination for the day of year. Equation-of-time is
// omitted (≤ ~4° / 16 min error), which is plenty for a day/night mask.
function sunDirectionNow(out) {
  const now = new Date();
  const hours =
    now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  const lon = -15 * (hours - 12);
  const yearStart = Date.UTC(now.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - yearStart) / 86400000);
  const decl = 23.44 * Math.sin((2 * Math.PI * (284 + dayOfYear)) / 365);
  return out.copy(lonLatToVec3(lon, decl, 1)).normalize();
}

// Exponential inter-arrival time for a Poisson process with the given mean.
function expGap(mean) {
  return -Math.log(1 - Math.random()) * mean;
}

// Atomic "double flash" brightness over the flash lifetime (age in ms): a sharp,
// near-instant first pulse, a brief dark minimum, then a more prolonged (slightly
// dimmer) second pulse that slowly fades. Each pulse is an asymmetric Gaussian
// (fast rise, slower fall); the gap between them dips to ~0 = the dark minimum.
function flashIntensity(age) {
  const bump = (a, peak, riseW, fallW) => {
    const x = (a - peak) / (a < peak ? riseW : fallW);
    return Math.exp(-x * x);
  };
  const first = bump(age, 12, 9, 26); //   ~instant initial pulse (scaled from ~1ms)
  const second = bump(age, 460, 190, 720); // prolonged second flash, hundreds of ms
  return Math.min(first * 1.0 + second * 0.8, 1.0);
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

// Visual calibration: load with ?calibrate to drop fixed coloured markers on known
// cities, so you can rotate the globe and confirm each sits on the right spot.
const CALIBRATION = [
  ["Null Island (0°,0°)", 0, 0, 0xffffff],
  ["London", -0.13, 51.5, 0x00ff00],
  ["New York", -74.0, 40.7, 0xffff00],
  ["Tokyo", 139.7, 35.7, 0x00ffff],
  ["Sydney", 151.2, -33.9, 0xff00ff],
  ["Cape Town", 18.4, -33.9, 0xff8800],
  ["São Paulo", -46.6, -23.5, 0x4488ff],
];

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
      // Loads the real per-country age/sex/cause distributions for personas. Resolves
      // (with fallbacks) rather than rejecting, so it never blocks the globe.
      initPersona(),
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
    `Each dot is one real death, placed where people actually live (denser regions ` +
    `die more), in real time (~2 people die worldwide every second).`;

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

  // --- Population-density placement -----------------------------------------
  // The per-country death RATE (blinkById) is unchanged, so each country's total
  // deaths/year is preserved exactly. We only change WHERE a death lands: instead
  // of a uniform-random point in the country, sample one of its population-grid
  // cells with probability proportional to the people living there, then jitter
  // within that cell. Denser cells therefore receive far more dots.
  const cs = grid.cellsize;
  const cellsByCountry = new Map(); // m49 -> { lon[], lat[], cum: Float64Array, total }
  for (const [lon, lat, pop, m49] of grid.cells) {
    let c = cellsByCountry.get(m49);
    if (!c) {
      c = { lon: [], lat: [], pop: [] };
      cellsByCountry.set(m49, c);
    }
    c.lon.push(lon);
    c.lat.push(lat);
    c.pop.push(pop);
  }
  for (const c of cellsByCountry.values()) {
    c.cum = new Float64Array(c.pop.length);
    let sum = 0;
    for (let i = 0; i < c.pop.length; i++) {
      sum += c.pop[i];
      c.cum[i] = sum;
    }
    c.total = sum;
  }

  // Pick a lon/lat for a death in country `m49`, weighted by cell population.
  // Returns null if we have no grid cells for that country (caller falls back).
  function densityLonLat(m49) {
    const c = cellsByCountry.get(m49);
    if (!c || !(c.total > 0)) return null;
    const r = Math.random() * c.total;
    let lo = 0;
    let hi = c.cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (c.cum[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    return [c.lon[lo] + Math.random() * cs, c.lat[lo] + Math.random() * cs];
  }

  // --- three.js scene ---
  const container = document.getElementById("globe");
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000011); // deep space
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const FOV = 45;
  const FIT_MARGIN = 1.5; // > 1 leaves breathing room (atmosphere extends past the globe)
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, 3);

  // --- Realistic earth: day/night/clouds + atmosphere (Bruno Simon shaders) ---
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const loader = new THREE.TextureLoader();
  const loadTex = (url, srgb) => {
    const t = loader.load(url);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  };
  const dayColor = new THREE.Color(ATMOSPHERE_DAY_COLOR);
  const twilightColor = new THREE.Color(ATMOSPHERE_TWILIGHT_COLOR);
  const sunDirection = sunDirectionNow(new THREE.Vector3());

  const earthGeometry = new THREE.SphereGeometry(GLOBE_R, 64, 64);
  const earthMaterial = new THREE.ShaderMaterial({
    vertexShader: earthVertexShader,
    fragmentShader: earthFragmentShader,
    uniforms: {
      uDayTexture: new THREE.Uniform(loadTex("/earth/day.jpg", true)),
      uNightTexture: new THREE.Uniform(loadTex("/earth/night.jpg", true)),
      uSpecularCloudsTexture: new THREE.Uniform(loadTex("/earth/specularClouds.jpg", false)),
      uSunDirection: new THREE.Uniform(sunDirection.clone()),
      uAtmosphereDayColor: new THREE.Uniform(dayColor),
      uAtmosphereTwilightColor: new THREE.Uniform(twilightColor),
      // Active death shockwaves (filled each frame). Centres in texture UV; the
      // shader refracts the surface around each as an expanding ripple.
      uBlastCount: { value: 0 },
      uBlastUv: { value: Array.from({ length: N_BLASTS }, () => new THREE.Vector2()) },
      uBlastProg: { value: new Array(N_BLASTS).fill(0) },
    },
  });

  const globe = new THREE.Group();
  scene.add(globe);
  const earth = new THREE.Mesh(earthGeometry, earthMaterial);
  globe.add(earth);

  const atmosphereMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    vertexShader: atmosphereVertexShader,
    fragmentShader: atmosphereFragmentShader,
    uniforms: {
      uSunDirection: new THREE.Uniform(sunDirection.clone()),
      uAtmosphereDayColor: new THREE.Uniform(dayColor),
      uAtmosphereTwilightColor: new THREE.Uniform(twilightColor),
    },
  });
  const atmosphere = new THREE.Mesh(earthGeometry, atmosphereMaterial);
  atmosphere.scale.setScalar(1.04);
  globe.add(atmosphere);

  // Keep the terminator matching wall-clock time as a long session runs (the
  // subsolar point drifts 15°/hour). Recompute periodically — no need per frame.
  function updateSun() {
    sunDirectionNow(sunDirection);
    earthMaterial.uniforms.uSunDirection.value.copy(sunDirection);
    atmosphereMaterial.uniforms.uSunDirection.value.copy(sunDirection);
  }
  setInterval(updateSun, 60000);

  const dotsGroup = new THREE.Group();
  globe.add(dotsGroup); // dots rotate with the earth

  const calibrate = /[?&]calibrate\b/.test(location.search);
  if (calibrate) addCalibrationMarkers(globe);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; // momentum
  controls.enablePan = false;
  controls.minDistance = GLOBE_R * 1.1; // refined per-viewport in resize()
  controls.maxDistance = 6;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight || Math.round(w * 0.6);
    renderer.setSize(w, h); // updates the canvas CSS size too (buffer scaled by pixelRatio)
    const aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    // Distance so the whole globe fits with margin in BOTH dimensions. The camera
    // FOV is vertical; on portrait (aspect < 1) the horizontal FOV is the binding
    // constraint, so divide by aspect. Keeps the earth centered and not too big.
    const dist =
      (GLOBE_R * FIT_MARGIN) /
      Math.tan((FOV * Math.PI) / 360) /
      Math.min(aspect, 1);
    camera.position.setLength(dist);
    // Zoom range: allow getting right down near the surface (a fixed close limit,
    // independent of viewport), but don't let the globe shrink much past its
    // fit-to-view size when zooming out.
    controls.minDistance = GLOBE_R * 1.1;
    controls.maxDistance = dist * 1.25;
    controls.update();
  }
  resize();
  window.addEventListener("resize", resize);

  // --- Death blasts: a white flash sprite + a shader-driven surface ripple ---
  // Soft radial white gradient (bright centre -> transparent) for the flash,
  // generated procedurally so there's no asset to ship.
  const flashTexture = (() => {
    const size = 128;
    const cv = document.createElement("canvas");
    cv.width = cv.height = size;
    const ctx = cv.getContext("2d");
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0.0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.85)");
    g.addColorStop(0.55, "rgba(255,255,255,0.25)");
    g.addColorStop(1.0, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();
  // The flash is a flat disc lying tangent to the surface (not a camera-facing
  // billboard), so it reads as a 2D flash on the ground, foreshortens near the
  // limb, and stays contained under the atmosphere shell.
  const flashGeo = new THREE.PlaneGeometry(1, 1);
  const PLANE_NORMAL = new THREE.Vector3(0, 0, 1); // PlaneGeometry faces +Z

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
  const blasts = [];
  const start = performance.now();

  // Spawn one death blast: a camera-facing additive white flash at the surface
  // point, plus the data the earth shader needs to draw an expanding ripple
  // there. The ripple itself is rendered by the shader (no mesh) from blast.u/v.
  function spawnBlast(lon, lat, t0) {
    const mat = new THREE.MeshBasicMaterial({
      map: flashTexture,
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false, // additive: don't occlude later flashes
      depthTest: true, //  but let the globe hide far-side flashes
      side: THREE.DoubleSide,
      opacity: 0,
    });
    const flash = new THREE.Mesh(flashGeo, mat);
    const normal = lonLatToVec3(lon, lat, 1); // unit surface normal
    flash.position.copy(normal).multiplyScalar(GLOBE_R * 1.002); // just above surface
    flash.quaternion.setFromUnitVectors(PLANE_NORMAL, normal); // lie tangent to surface
    flash.scale.setScalar(1e-4);
    dotsGroup.add(flash);
    // Texture UV of the detonation (equirectangular day map). vUv.y runs south->
    // north like latitude, so v = (lat+90)/180; u = (lon+180)/360.
    const u = (lon + 180) / 360;
    const v = (lat + 90) / 180;
    blasts.push({ t0, u, v, flash, flashMat: mat });
  }

  // --- "Last deaths" feed: a generated persona per death, newest 6 kept. ----
  const FEED_MAX = 6;
  const feedEl = document.getElementById("death-feed");
  const feed = []; // newest first

  function pushDeath(m49) {
    const country = nameById.get(m49) || "Unknown";
    feed.unshift(makePersona(m49, country).text);
    if (feed.length > FEED_MAX) feed.length = FEED_MAX;
    renderFeed();
  }

  function renderFeed() {
    if (!feedEl) return;
    // feed[0] is newest: brightest, and (via column-reverse CSS) sits at the bottom;
    // older lines rise and dim.
    feedEl.innerHTML = feed
      .map((text, i) => {
        const opacity = (1 - i / FEED_MAX).toFixed(2);
        const cls = i === 0 ? ' class="feed-new"' : "";
        return `<div class="feed-line"${cls} style="opacity:${opacity}">${escapeHtml(
          text
        )}</div>`;
      })
      .join("");
  }

  const uBlastUv = earthMaterial.uniforms.uBlastUv.value;
  const uBlastProg = earthMaterial.uniforms.uBlastProg.value;

  // Rotate the globe so a lon/lat faces the camera (+Z), keeping north roughly up.
  // Set as a tween target; the frame loop eases the globe toward it once.
  let centerTarget = null;
  function centerOn(lon, lat) {
    const v = lonLatToVec3(lon, lat, 1).normalize();
    const toCamera = new THREE.Vector3(0, 0, 1);
    const q1 = new THREE.Quaternion().setFromUnitVectors(v, toCamera);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q1); // north pole after q1
    const roll = Math.atan2(up.x, up.y); // bring north to screen-up
    const q2 = new THREE.Quaternion().setFromAxisAngle(toCamera, -roll);
    centerTarget = q2.multiply(q1);
  }

  // Best-effort: center on the viewer's approximate IP location (see /api/geo).
  fetch("/api/geo")
    .then((r) => r.json())
    .then((geo) => {
      if (geo && Number.isFinite(geo.lat) && Number.isFinite(geo.lon)) {
        centerOn(geo.lon, geo.lat);
      }
    })
    .catch(() => {});

  function frame(now) {
    const t = now - start;
    for (const s of state) {
      while (t >= s.next) {
        // Skip events too far in the past (e.g. backgrounded tab) to avoid a burst.
        if (t - s.next <= CATCHUP_CAP && blasts.length < MAX_DOTS) {
          const [lon, lat] =
            densityLonLat(Number(s.feature.id)) || randomLonLat(s.feature, s.bounds);
          spawnBlast(lon, lat, s.next);
          pushDeath(Number(s.feature.id));
        }
        s.next += expGap(s.mean);
      }
    }

    // Update each blast: the flash sprite (short) and the ripple progress (longer).
    // Drop a blast once both phases are done; feed the newest live ripples to the
    // earth shader (capped at N_BLASTS).
    let nBlasts = 0;
    for (let i = blasts.length - 1; i >= 0; i--) {
      const b = blasts[i];
      const age = t - b.t0;
      const fp = age / FLASH_MS; // flash progress
      const rp = age / SHOCK_MS; // ripple progress

      if (fp >= 1 && b.flash) {
        dotsGroup.remove(b.flash);
        b.flashMat.dispose();
        b.flash = null;
      } else if (b.flash) {
        // Double-flash brightness; a tight bright point first, then a larger bloom
        // (the fireball grows) for the second, prolonged flash.
        const grow = 0.4 + 0.6 * Math.min(age / 460, 1);
        b.flash.scale.setScalar(Math.max(FLASH_R * grow, 1e-4));
        b.flashMat.opacity = flashIntensity(age);
      }

      if (fp >= 1 && rp >= 1) {
        blasts.splice(i, 1);
        continue;
      }
      // Newest ripples win the limited shader slots.
      if (rp < 1 && nBlasts < N_BLASTS) {
        uBlastUv[nBlasts].set(b.u, b.v);
        uBlastProg[nBlasts] = rp;
        nBlasts++;
      }
    }
    earthMaterial.uniforms.uBlastCount.value = nBlasts;

    // Ease the globe toward the viewer's location, then release control.
    if (centerTarget) {
      globe.quaternion.slerp(centerTarget, 0.12);
      if (globe.quaternion.angleTo(centerTarget) < 0.001) centerTarget = null;
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

  if (calibrate) drawCalibrationLegend();
  else drawLegend();
}

// Fixed, non-fading markers at known cities (see CALIBRATION). Each should sit on
// its real location once the globe is rotated to face it.
function addCalibrationMarkers(group) {
  const geo = new THREE.SphereGeometry(0.05, 16, 16);
  for (const [, lon, lat, color] of CALIBRATION) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
    m.position.copy(lonLatToVec3(lon, lat, GLOBE_R * 1.01)); // just above the surface
    group.add(m);
  }
}

function drawCalibrationLegend() {
  d3.select("#legend")
    .html("")
    .append("div")
    .html(
      "Calibration: each marker should sit on its city — " +
        CALIBRATION.map(
          ([name, , , color]) =>
            `<span style="color:#${color.toString(16).padStart(6, "0")}">●</span> ${name}`
        ).join(" · ")
    );
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

function escapeHtml(s) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
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
      `<span style="color:var(--accent)">●</span> each flash is a death, ` +
        `placed where people live (denser regions die more), in real time (Poisson). ` +
        `Drag to rotate · scroll/pinch to zoom · hover a country for its rate.`
    );
}

main();
