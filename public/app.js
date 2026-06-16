/* global d3, topojson */
import * as THREE from "three";
import { OrbitControls } from "/vendor/OrbitControls.js";
import {
  earthVertexShader,
  earthFragmentShader,
  atmosphereVertexShader,
  atmosphereFragmentShader,
} from "shaders";
import { makePersona, initPersona } from "persona";

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
// map (north up, lon -180 at the left seam).
function lonLatToVec3(lon, lat, r) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
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

async function main() {
  const loaderEl = document.getElementById("loader");
  // Kick the IP geolocation off immediately so it overlaps asset loading and is
  // likely ready in time to center the very first rendered frame.
  const geoReady = fetch("/api/geo")
    .then((r) => r.json())
    .catch(() => null);

  let topo, grid, mortality;
  try {
    [topo, grid, mortality] = await Promise.all([
      d3.json("/data/countries-110m.json"),
      d3.json("/data/density-grid.json"),
      d3.json("/api/mortality"),
      // Real per-country age/sex/cause distributions for the deaths feed. Resolves
      // (with fallbacks) rather than rejecting, so it never blocks the globe.
      initPersona(),
    ]);
  } catch (err) {
    console.error("Failed to load data:", err);
    loaderEl?.classList.add("hidden"); // don't leave the spinner up forever
    return;
  }

  // Country display name by M49 id, for the deaths feed.
  const nameById = new Map(mortality.values.map((d) => [Number(d.id), d.name]));

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
  const START_ZOOM = 0.58; // initial distance as a fraction of the fit distance (tighter)
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, 3);
  // Direction the camera should ease toward to center the viewer's location (unit
  // vector), or null when idle / after the user takes over. Declared early so the
  // OrbitControls "start" handler below can clear it.
  let camTarget = null;

  // --- Realistic earth: day/night/clouds + atmosphere (Bruno Simon shaders) ---
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const loader = new THREE.TextureLoader();
  const loadTex = async (url, srgb) => {
    const t = await loader.loadAsync(url);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  };
  const dayColor = new THREE.Color(ATMOSPHERE_DAY_COLOR);
  const twilightColor = new THREE.Color(ATMOSPHERE_TWILIGHT_COLOR);
  const sunDirection = sunDirectionNow(new THREE.Vector3());

  // Wait for the earth textures up front so the globe is never revealed blank. If a
  // texture fails, don't leave the loader spinning forever — hide it and bail.
  let dayTexture, nightTexture, specularCloudsTexture;
  try {
    [dayTexture, nightTexture, specularCloudsTexture] = await Promise.all([
      loadTex("/earth/day.jpg", true),
      loadTex("/earth/night.jpg", true),
      loadTex("/earth/specularClouds.jpg", false),
    ]);
  } catch (err) {
    console.error("Failed to load earth textures:", err);
    loaderEl?.classList.add("hidden");
    return;
  }

  const earthGeometry = new THREE.SphereGeometry(GLOBE_R, 64, 64);
  const earthMaterial = new THREE.ShaderMaterial({
    vertexShader: earthVertexShader,
    fragmentShader: earthFragmentShader,
    uniforms: {
      uDayTexture: new THREE.Uniform(dayTexture),
      uNightTexture: new THREE.Uniform(nightTexture),
      uSpecularCloudsTexture: new THREE.Uniform(specularCloudsTexture),
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
  // North stays up: the globe is never rotated (its +Y pole = world up) and
  // OrbitControls keeps camera.up = +Y and never rolls, so any manual rotation
  // keeps the pole pointing up. We "center" by orbiting the camera, not the globe.
  controls.addEventListener("start", () => (camTarget = null)); // user takes over

  let didInitZoom = false;
  function resize() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight || Math.round(w * 0.6);
    // Track the device pixel ratio too (it can change when a window moves between
    // displays or the browser zoom changes), capped at 2 to spare the GPU.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h); // updates the canvas CSS size too (buffer scaled by pixelRatio)
    const aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    // Distance at which the whole globe just fits with margin in both dimensions.
    const fitDist =
      (GLOBE_R * FIT_MARGIN) /
      Math.tan((FOV * Math.PI) / 360) /
      Math.min(aspect, 1);
    const maxDist = fitDist * 1.25;
    controls.minDistance = GLOBE_R * 1.1;
    controls.maxDistance = maxDist;
    if (!didInitZoom) {
      // Start on a tighter zoom than the fit (bigger globe), only on first layout.
      camera.position.setLength(Math.max(fitDist * START_ZOOM, GLOBE_R * 1.15));
      didInitZoom = true;
    } else {
      // Preserve the user's zoom across resizes, but keep it within the new bounds
      // so an orientation change (e.g. landscape -> portrait) can't leave the globe
      // clipped or floating past the fit distance.
      const d = Math.min(Math.max(camera.position.length(), controls.minDistance), maxDist);
      camera.position.setLength(d);
    }
    controls.update();
  }
  resize();
  // Drive resizing from the container's actual box (handles orientation changes and
  // mobile browser-chrome show/hide better than window 'resize' alone), debounced to
  // one update per frame.
  let resizeQueued = false;
  const onResize = () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      resize();
    });
  };
  new ResizeObserver(onResize).observe(container);
  window.addEventListener("orientationchange", onResize);

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

  // --- "Last deaths" feed: a scrollable list of generated personas ----------
  // Each death appends one line (newest at the bottom). It auto-follows the newest
  // line, but pauses when the user scrolls or presses it: while paused, new lines
  // append below the viewport so the lines being read don't move. Following resumes
  // when the user scrolls back to the bottom.
  const FEED_SOFT_MAX = 60; // trimmed back to this while following
  const FEED_HARD_MAX = 200; // absolute cap, even when paused (with scroll compensation)
  const feedEl = document.getElementById("death-feed"); // scroll viewport
  const trackEl = document.getElementById("feed-track"); // transformed content
  const feedBottomBtn = document.getElementById("feed-bottom");
  let following = true;
  let smoothing = false; // a button-triggered smooth catch-up is animating

  // FLIP: after the new line is in place (stack already shifted up by `dy`), invert
  // the track by `dy` then animate to 0, so the whole stack glides up smoothly.
  function flipUp(dy) {
    if (!trackEl || !(dy > 0)) return;
    trackEl.style.transition = "none";
    trackEl.style.transform = `translateY(${dy}px)`;
    void trackEl.offsetHeight; // force reflow so the inverted start is committed
    trackEl.style.transition = "transform 0.35s ease-out";
    trackEl.style.transform = "translateY(0)";
  }

  function setFollowing(v) {
    following = v;
    feedBottomBtn?.classList.toggle("hidden", v); // show the jump button only while paused
  }
  function isAtBottom() {
    if (!feedEl) return true;
    return feedEl.scrollHeight - feedEl.clientHeight - feedEl.scrollTop <= 4;
  }
  function stickToBottom(smooth) {
    if (feedEl) feedEl.scrollTo({ top: feedEl.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }
  function scrollToNewest() {
    smoothing = true; // animate down, don't jump; keep button hidden until we arrive
    setFollowing(true);
    stickToBottom(true);
  }
  if (feedEl) {
    feedEl.addEventListener(
      "scroll",
      () => {
        const atBottom = isAtBottom();
        if (atBottom) smoothing = false;
        if (!smoothing) setFollowing(atBottom); // ignore intermediate smooth-scroll positions
      },
      { passive: true }
    );
    // Pressing / wheeling = the user takes manual control until they return to bottom.
    const pause = () => {
      smoothing = false;
      setFollowing(false);
    };
    feedEl.addEventListener("pointerdown", pause, { passive: true });
    feedEl.addEventListener("wheel", pause, { passive: true });
    feedEl.addEventListener("touchstart", pause, { passive: true });
  }
  feedBottomBtn?.addEventListener("click", scrollToNewest);

  function pushDeath(m49) {
    if (!feedEl || !trackEl) return;
    const country = nameById.get(m49) || "Unknown";
    const prevNewest = trackEl.lastElementChild;
    if (prevNewest) prevNewest.classList.remove("feed-new");
    const line = document.createElement("div");
    line.className = "feed-line feed-new";
    line.textContent = makePersona(m49, country).text;
    trackEl.appendChild(line);
    const gap = parseFloat(getComputedStyle(trackEl).rowGap) || 0;
    const dy = line.offsetHeight + gap; // one line's worth of upward shift

    if (following) {
      // Stick to the newest; trim oldest back to the soft cap (safe: we re-stick below).
      while (trackEl.childElementCount > FEED_SOFT_MAX && trackEl.firstElementChild) {
        trackEl.removeChild(trackEl.firstElementChild);
      }
      stickToBottom(smoothing); // smooth during a button catch-up, instant for the live tail
      if (!smoothing) flipUp(dy); // glide the stack up (button catch-up animates via scroll)
    } else if (trackEl.childElementCount > FEED_HARD_MAX && trackEl.firstElementChild) {
      // Paused but over the hard cap: drop the oldest and compensate scrollTop so the
      // lines being read stay put.
      const removed = trackEl.firstElementChild;
      const h = removed.offsetHeight + gap;
      trackEl.removeChild(removed);
      feedEl.scrollTop = Math.max(0, feedEl.scrollTop - h);
    }
  }

  const uBlastUv = earthMaterial.uniforms.uBlastUv.value;
  const uBlastProg = earthMaterial.uniforms.uBlastProg.value;

  // Point the camera at a lon/lat by orbiting (the globe is never rotated, so north
  // stays up). `instant` snaps now (for the initial centered reveal); otherwise it
  // sets camTarget and the frame loop eases there until the user takes over.
  function viewLonLat(lon, lat, instant) {
    const dir = lonLatToVec3(lon, lat, 1).normalize();
    if (instant) {
      camera.position.copy(dir.multiplyScalar(camera.position.length()));
      camera.up.set(0, 1, 0);
      controls.update();
      camTarget = null;
    } else {
      camTarget = dir;
    }
  }

  // Center on the viewer's IP location (best-effort). If it resolves before reveal,
  // snap so the first visible frame is already centered; if it arrives later (or the
  // lookup is slow/unavailable), don't hold up the reveal and ease in if it shows up.
  const geo = await Promise.race([
    geoReady,
    new Promise((res) => setTimeout(() => res(null), 1200)),
  ]);
  const hasGeo = (g) => g && Number.isFinite(g.lat) && Number.isFinite(g.lon);
  if (hasGeo(geo)) {
    viewLonLat(geo.lon, geo.lat, true);
  } else {
    geoReady.then((g) => hasGeo(g) && viewLonLat(g.lon, g.lat, false));
  }

  let revealed = false; // hide the loader once the first real frame is on screen
  const start = performance.now();

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

    // Ease the camera around to the viewer's location (preserving zoom), then
    // release. Keeping up = +Y means north stays up throughout.
    if (camTarget) {
      const dist = camera.position.length();
      const cur = camera.position.clone().normalize();
      if (cur.angleTo(camTarget) < 0.01) {
        camTarget = null;
      } else {
        camera.position.copy(cur.lerp(camTarget, 0.12).normalize().multiplyScalar(dist));
        camera.up.set(0, 1, 0);
      }
    }

    controls.update();
    renderer.render(scene, camera);

    // First real frame is on screen — fade the loader out.
    if (!revealed) {
      revealed = true;
      loaderEl?.classList.add("hidden");
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
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

main();
