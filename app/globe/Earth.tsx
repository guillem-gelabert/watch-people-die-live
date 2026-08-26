"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls } from "@react-three/drei";
import * as THREE from "three/webgpu";
import { utcYearPhase } from "@/lib/seasonal-curve";
import { createEarth, type EarthMaterials } from "./shaders";
import { sunDirectionNow, expGap, flashIntensity, lonLatToVec3, smoothstep } from "./helpers";
import {
  N_BLASTS,
  MS_PER_YEAR_REAL,
  FLASH_MS,
  SHOCK_MS,
  MAX_DOTS,
  CATCHUP_CAP,
  FLASH_R,
  GLOBE_R,
  ATMOSPHERE_DAY_COLOR,
  ATMOSPHERE_TWILIGHT_COLOR,
  CALIBRATION,
  FIT_MARGIN,
  HERO_FILL,
  START_ZOOM,
} from "./constants";
import type { GlobeData, GeoPayload, Sampler } from "./useGlobeData";

const PLANE_NORMAL = new THREE.Vector3(0, 0, 1); // PlaneGeometry faces +Z
const WORLD_UP = new THREE.Vector3(0, 1, 0);
// Scratch for the scroll tip-away, and the last non-degenerate axis it resolved to. Module scope
// because there is one globe on the page and this runs every frame.
const tipAxis = new THREE.Vector3();
const lastTipAxis = new THREE.Vector3(1, 0, 0);
// The color daylight map. Natural Earth's grayscale relief (GRAY_EARTH_URL) is the basemap for
// the flat roadmap maps only — pointing the globe at it renders the whole planet gray. Whatever
// goes here also has to stay inside WebGPU's portable 8192px dimension limit.
const GLOBE_DAY_TEXTURE_URL = "/earth/earth_day_4096.jpg";

type OrbitControlsRef = React.ComponentRef<typeof OrbitControls>;

interface Blast {
  t0: number;
  u: number;
  v: number;
  flash: THREE.Mesh | null;
  flashMat: THREE.MeshBasicMaterial;
}

interface Sim {
  sampler: Sampler;
  mean: number; // ms, global Poisson mean inter-arrival time
  seasonalDay: string;
  next: number;
  blasts: Blast[];
  flashTexture: THREE.CanvasTexture;
  flashGeo: THREE.PlaneGeometry;
}

function buildFlashTexture(): THREE.CanvasTexture {
  const size = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d") as CanvasRenderingContext2D;
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
}

function addCalibrationMarkers(group: THREE.Group) {
  const geo = new THREE.SphereGeometry(0.05, 16, 16);
  for (const [, lon, lat, color] of CALIBRATION) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
    m.position.copy(lonLatToVec3(lon, lat, GLOBE_R * 1.01));
    group.add(m);
  }
}

async function loadTexture(loader: THREE.TextureLoader, url: string, srgb: boolean) {
  const t = await loader.loadAsync(url);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

interface EarthProps {
  globeData: GlobeData | { error: true } | null;
  geo: GeoPayload | null;
  onFirstFrame: () => void;
  onPushDeath: (m49: number, lon: number, lat: number, cellIndex: number) => void;
  camTarget: RefObject<THREE.Vector3 | null>;
  controlsRef: RefObject<OrbitControlsRef | null>;
  // Scroll progress out of the hero, 0..1. A ref rather than a prop value because the
  // story's scroll handler updates it every frame — as state it would re-render the whole
  // canvas subtree on each one.
  phaseRef: RefObject<number>;
  // Set while the island is expanded: the clock keeps running but no new deaths spawn, so
  // the persona on screen stays the one being read.
  pausedRef: RefObject<boolean>;
}

// Owns the whole per-frame death simulation: a single global Poisson process sampling
// the combined rate grid (density x country-rate, seasonally reweighted), blast flashes
// + shader ripple uniforms, sun tracking, and camera easing to the viewer's location.
export default function Earth({
  globeData,
  geo,
  onFirstFrame,
  onPushDeath,
  camTarget,
  controlsRef,
  phaseRef,
  pausedRef,
}: EarthProps) {
  const { camera, gl } = useThree();
  const perspCamera = camera as THREE.PerspectiveCamera;
  const groupRef = useRef<THREE.Group>(null);
  const dotsGroupRef = useRef<THREE.Group>(null);
  const sunLightRef = useRef<THREE.DirectionalLight>(null);

  const sunDirection = useMemo(() => sunDirectionNow(new THREE.Vector3()), []);
  const [earth, setEarth] = useState<EarthMaterials | null>(null);

  // Mutable simulation state (avoids re-renders on every spawned death).
  const sim = useRef<Sim | null>(null);
  const didInitZoom = useRef(false);
  const previousFitDistance = useRef<number | null>(null);
  const revealed = useRef(false);
  const startRef = useRef<number | null>(null);
  const centeredOnce = useRef(false);
  // Whether the reader has asked for reduced motion. Held in a ref and read in the frame loop
  // so flipping the setting takes effect without re-rendering the canvas subtree.
  const stillRef = useRef(false);

  const calibrate = useMemo(
    () => typeof window !== "undefined" && /[?&]calibrate\b/.test(window.location.search),
    [],
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => (stillRef.current = query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // Load earth textures + build the TSL materials once.
  useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    Promise.all([
      loadTexture(loader, GLOBE_DAY_TEXTURE_URL, true),
      loadTexture(loader, "/earth/earth_night_4096.jpg", true),
      loadTexture(loader, "/earth/earth_bump_roughness_clouds_4096.jpg", false),
    ])
      .then(([dayTexture, nightTexture, bumpRoughnessCloudsTexture]) => {
        if (cancelled) return;
        setEarth(
          createEarth({
            dayTexture,
            nightTexture,
            bumpRoughnessCloudsTexture,
            sunDirection,
            atmosphereDayColor: ATMOSPHERE_DAY_COLOR,
            atmosphereTwilightColor: ATMOSPHERE_TWILIGHT_COLOR,
            nBlasts: N_BLASTS,
            blastMaxR: 0.1,
            blastWidth: 0.009,
            blastAmp: 0.004,
          }),
        );
      })
      .catch((err) => console.error("Failed to load earth textures:", err));
    return () => {
      cancelled = true;
    };
  }, [sunDirection]);

  // Build the global sampler + Poisson state once globe data + earth materials exist.
  useEffect(() => {
    if (!globeData || globeData.error || !earth) return;
    const { buildSampler } = globeData;

    const date = new Date();
    const seasonalDay = date.toISOString().slice(0, 10);
    const sampler = buildSampler(utcYearPhase(date));
    const mean = MS_PER_YEAR_REAL / sampler.total;

    sim.current = {
      sampler,
      mean,
      seasonalDay,
      next: expGap(mean),
      blasts: [],
      flashTexture: buildFlashTexture(),
      flashGeo: new THREE.PlaneGeometry(1, 1),
    };
    startRef.current = performance.now();
  }, [globeData, earth]);

  // Calibration markers (debug mode).
  useEffect(() => {
    if (calibrate && groupRef.current) addCalibrationMarkers(groupRef.current);
  }, [calibrate]);

  // Sun position updates every 60s (long session drift), not every frame.
  useEffect(() => {
    const id = setInterval(() => {
      sunDirectionNow(sunDirection);
      if (earth) earth.sunDir.value.copy(sunDirection);
      if (sunLightRef.current) sunLightRef.current.position.copy(sunDirection).multiplyScalar(10);
    }, 60000);
    return () => clearInterval(id);
  }, [earth, sunDirection]);

  // Resize / fit distance. Keep the user's zoom as a ratio of the viewport fit so
  // the globe grows and shrinks with the viewport instead of retaining a fixed
  // on-screen size after the first render.
  useEffect(() => {
    const FOV = perspCamera.fov;
    function resize() {
      const w = gl.domElement.clientWidth || window.innerWidth;
      const h = gl.domElement.clientHeight || window.innerHeight || Math.round(w * 0.6);
      const aspect = w / h;
      const fitDist =
        (GLOBE_R * FIT_MARGIN) / Math.tan((FOV * Math.PI) / 360) / Math.min(aspect, 1);
      const maxDist = fitDist * 1.25;
      if (controlsRef.current) {
        controlsRef.current.minDistance = GLOBE_R * 1.1;
        controlsRef.current.maxDistance = maxDist;
      }
      if (!didInitZoom.current) {
        // Framed off the height alone, so the framing holds at any aspect: a wide window shows more
        // sky left and right rather than a bigger or smaller planet.
        //
        // Solved in pixels rather than in angle. A perspective camera maps angle to pixels through
        // a tangent, so treating HERO_FILL as a fraction of the FOV — as this did — leaves the
        // silhouette several percent off the fraction of the screen it is supposed to cover. The
        // silhouette is the ring of rays tangent to the sphere, at asin(R/d) off-axis, and a ray at
        // angle t lands at (h/2)·tan(t)/tan(FOV/2) pixels from centre. Setting that to the half
        // height we want and solving for d is the two lines below.
        const halfFov = (FOV * Math.PI) / 360;
        const tangentAngle = Math.atan(HERO_FILL * Math.tan(halfFov));
        const fillDist = GLOBE_R / Math.sin(tangentAngle);
        perspCamera.position.setLength(Math.max(fillDist, GLOBE_R * 1.15));
        didInitZoom.current = true;
      } else {
        const zoomRatio = previousFitDistance.current
          ? perspCamera.position.length() / previousFitDistance.current
          : START_ZOOM;
        const d = Math.min(Math.max(fitDist * zoomRatio, GLOBE_R * 1.1), maxDist);
        perspCamera.position.setLength(d);
      }
      previousFitDistance.current = fitDist;
      controlsRef.current?.update();
    }
    resize();
    let queued = false;
    const onResize = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        resize();
      });
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(gl.domElement.parentElement || gl.domElement);
    window.addEventListener("orientationchange", onResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", onResize);
    };
  }, [perspCamera, gl, controlsRef]);

  // Center on the viewer's IP location once geo resolves (best-effort, non-blocking).
  useEffect(() => {
    if (centeredOnce.current) return;
    const hasGeo = geo && Number.isFinite(geo.lat) && Number.isFinite(geo.lon);
    if (!hasGeo) return;
    centeredOnce.current = true;
    const dir = lonLatToVec3(geo.lon as number, geo.lat as number, 1).normalize();
    if (!revealed.current) {
      perspCamera.position.copy(dir.multiplyScalar(perspCamera.position.length()));
      perspCamera.up.set(0, 1, 0);
      controlsRef.current?.update();
    } else {
      camTarget.current = dir;
    }
  }, [geo, perspCamera, controlsRef, camTarget]);

  function spawnBlast(lon: number, lat: number, t0: number) {
    const s = sim.current as Sim;
    const mat = new THREE.MeshBasicMaterial({
      map: s.flashTexture,
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      opacity: 0,
    });
    const flash = new THREE.Mesh(s.flashGeo, mat);
    const normal = lonLatToVec3(lon, lat, 1);
    flash.position.copy(normal).multiplyScalar(GLOBE_R * 1.002);
    flash.quaternion.setFromUnitVectors(PLANE_NORMAL, normal);
    flash.scale.setScalar(1e-4);
    dotsGroupRef.current?.add(flash);
    const u = (lon + 180) / 360;
    const v = (lat + 90) / 180;
    s.blasts.push({ t0, u, v, flash, flashMat: mat });
  }

  useFrame(() => {
    const s = sim.current;
    if (!s || !earth || startRef.current == null) return;

    const now = performance.now();
    const t = now - startRef.current;
    const date = new Date();
    const seasonalDay = date.toISOString().slice(0, 10);

    // The continuous seasonal multiplier shifts weight between countries through the year, so both the
    // per-cell distribution AND the global total (hence the Poisson mean) change. The
    // already-scheduled `next` carries over unchanged across the rebuild.
    if (seasonalDay !== s.seasonalDay && globeData && !globeData.error) {
      s.sampler = globeData.buildSampler(utcYearPhase(date));
      s.mean = MS_PER_YEAR_REAL / s.sampler.total;
      s.seasonalDay = seasonalDay;
    }

    // Paused (island expanded) still advances the schedule, exactly like the existing
    // catch-up cap does — the clock is wall-time, so resuming must not fire a backlog. Being
    // scrolled away counts as paused: once the globe is most of the way out there is nothing
    // to watch, and every blast is still a shader write and a persona draw. So does asking
    // for reduced motion, which leaves the globe a still photograph of the same data.
    const paused = pausedRef.current || phaseRef.current > 0.4 || stillRef.current;
    while (t >= s.next) {
      if (!paused && t - s.next <= CATCHUP_CAP && s.blasts.length < MAX_DOTS) {
        const [lon, lat, m49, cellIndex] = s.sampler.sampleCell();
        spawnBlast(lon, lat, s.next);
        onPushDeath(m49, lon, lat, cellIndex);
      }
      s.next += expGap(s.mean);
    }

    let nBlasts = 0;
    for (let i = s.blasts.length - 1; i >= 0; i--) {
      const b = s.blasts[i] as Blast;
      const age = t - b.t0;
      const fp = age / FLASH_MS;
      const rp = age / SHOCK_MS;

      if (fp >= 1 && b.flash) {
        dotsGroupRef.current?.remove(b.flash);
        b.flashMat.dispose();
        b.flash = null;
      } else if (b.flash) {
        const grow = 0.4 + 0.6 * Math.min(age / 460, 1);
        b.flash.scale.setScalar(Math.max(FLASH_R * grow, 1e-4));
        b.flashMat.opacity = flashIntensity(age);
      }

      if (fp >= 1 && rp >= 1) {
        s.blasts.splice(i, 1);
        continue;
      }
      if (rp < 1 && nBlasts < N_BLASTS) {
        (earth.blastUv.array[nBlasts] as THREE.Vector2).set(b.u, b.v);
        (earth.blastProg.array as number[])[nBlasts] = rp;
        nBlasts++;
      }
    }
    earth.blastCount.value = nBlasts;

    // Scroll exit: the globe keeps its place and its size and scrolls away with the page, so the
    // whole exit is this one rotation — tipping the north pole away until the reader is looking over
    // the south pole.
    //
    // The axis has to be derived from where the camera actually is, not hard-coded to world X. The
    // camera is eased to the viewer's own latitude and longitude and can be dragged anywhere after
    // that, and a fixed axis only reads as "tipping back" from the one viewpoint it was picked for
    // — from anywhere else the same rotation looks like a roll. `up × camDir` is the screen-
    // horizontal axis for the current viewpoint, so tipping about it always reads as tipping back.
    // Written every frame, including at e = 0, so scrolling back to the top restores the opening
    // pose instead of stranding the globe wherever the reader turned around.
    const e = smoothstep(phaseRef.current);
    if (groupRef.current) {
      tipAxis.crossVectors(WORLD_UP, perspCamera.position).normalize();
      // Degenerate only when the camera is directly over a pole, where every axis is a roll and
      // there is no "back" to tip toward; keeping the last good axis avoids a snap.
      if (tipAxis.lengthSq() > 0.5) lastTipAxis.copy(tipAxis);
      groupRef.current.quaternion.setFromAxisAngle(lastTipAxis, -e * 1.25);
    }

    if (camTarget.current) {
      const dist = perspCamera.position.length();
      const cur = perspCamera.position.clone().normalize();
      if (cur.angleTo(camTarget.current) < 0.01) {
        camTarget.current = null;
      } else {
        cur.lerp(camTarget.current, 0.12).normalize();
        perspCamera.position.copy(cur.multiplyScalar(dist));
        perspCamera.up.set(0, 1, 0);
      }
    }

    if (!revealed.current) {
      revealed.current = true;
      onFirstFrame();
    }
  });

  return (
    <group ref={groupRef}>
      {earth && (
        <>
          <directionalLight
            ref={sunLightRef}
            color={0xffffff}
            intensity={2}
            position={sunDirection.clone().multiplyScalar(10).toArray()}
          />
          <mesh material={earth.globeMaterial}>
            <sphereGeometry args={[GLOBE_R, 64, 64]} />
          </mesh>
          <mesh material={earth.atmosphereMaterial} scale={1.02}>
            <sphereGeometry args={[GLOBE_R, 64, 64]} />
          </mesh>
        </>
      )}
      <group ref={dotsGroupRef} />
    </group>
  );
}
