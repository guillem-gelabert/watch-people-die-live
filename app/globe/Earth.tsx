"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls } from "@react-three/drei";
import * as THREE from "three/webgpu";
import { createEarth, type EarthMaterials } from "./shaders";
import { sunDirectionNow, expGap, flashIntensity, lonLatToVec3 } from "./helpers";
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
  START_ZOOM,
} from "./constants";
import type { GlobeData, GeoPayload, Sampler } from "./useGlobeData";

const PLANE_NORMAL = new THREE.Vector3(0, 0, 1); // PlaneGeometry faces +Z

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
  curMonth: number;
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
  onPushDeath: (m49: number) => void;
  camTarget: RefObject<THREE.Vector3 | null>;
  controlsRef: RefObject<OrbitControlsRef | null>;
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

  const calibrate = useMemo(
    () => typeof window !== "undefined" && /[?&]calibrate\b/.test(window.location.search),
    [],
  );

  // Load earth textures + build the TSL materials once.
  useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    Promise.all([
      loadTexture(loader, "/maps/gray-earth.jpg", true),
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

    const curMonth = new Date().getUTCMonth();
    const sampler = buildSampler(curMonth);
    const mean = MS_PER_YEAR_REAL / sampler.total;

    sim.current = {
      sampler,
      mean,
      curMonth,
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
        perspCamera.position.setLength(Math.max(fitDist * START_ZOOM, GLOBE_R * 1.15));
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

  // Use an off-axis camera to make room for the landscape feed and keep the globe
  // above the viewport midpoint. The projected silhouette is also exposed to CSS so
  // persona text can disappear behind the globe instead of drawing across its face.
  useEffect(() => {
    const feedEl = document.getElementById("death-feed");
    const projectedCenter = new THREE.Vector3();
    const projectedEdge = new THREE.Vector3();
    const cameraRight = new THREE.Vector3();

    function syncPersonaMask(w: number, h: number) {
      if (!feedEl) return;
      perspCamera.updateMatrixWorld();
      projectedCenter.set(0, 0, 0).project(perspCamera);
      cameraRight.setFromMatrixColumn(perspCamera.matrixWorld, 0).multiplyScalar(GLOBE_R);
      projectedEdge.copy(cameraRight).project(perspCamera);

      const centerX = ((projectedCenter.x + 1) / 2) * w;
      const centerY = ((1 - projectedCenter.y) / 2) * h;
      const flatRadius = Math.hypot(
        ((projectedEdge.x - projectedCenter.x) / 2) * w,
        ((projectedEdge.y - projectedCenter.y) / 2) * h,
      );
      const distance = perspCamera.position.length();
      const silhouetteScale = distance / Math.sqrt(distance * distance - GLOBE_R * GLOBE_R);
      const feedRect = feedEl.getBoundingClientRect();

      feedEl.style.setProperty("--globe-x", `${centerX - feedRect.left}px`);
      feedEl.style.setProperty("--globe-y", `${centerY - feedRect.top}px`);
      feedEl.style.setProperty("--globe-screen-r", `${flatRadius * silhouetteScale}px`);
    }

    function updateProjection() {
      const w = gl.domElement.clientWidth || window.innerWidth;
      const h = gl.domElement.clientHeight || window.innerHeight;
      const isSplitView = window.matchMedia("(orientation: landscape)").matches;
      const listW = isSplitView ? (feedEl?.getBoundingClientRect().width ?? 0) : 0;
      const topShift = Math.min(h * (isSplitView ? 0.06 : 0.09), 96);
      perspCamera.setViewOffset(w + listW, h, 0, topShift, w, h);
      syncPersonaMask(w, h);
    }
    updateProjection();
    const controls = controlsRef.current;
    controls?.addEventListener("change", updateProjection);
    window.addEventListener("resize", updateProjection);
    window.addEventListener("orientationchange", updateProjection);
    return () => {
      controls?.removeEventListener("change", updateProjection);
      window.removeEventListener("resize", updateProjection);
      window.removeEventListener("orientationchange", updateProjection);
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
    const curMonth = new Date().getUTCMonth();

    // The seasonal multiplier shifts weight between countries every month, so both the
    // per-cell distribution AND the global total (hence the Poisson mean) change. The
    // already-scheduled `next` carries over unchanged across the rebuild.
    if (curMonth !== s.curMonth && globeData && !globeData.error) {
      s.sampler = globeData.buildSampler(curMonth);
      s.mean = MS_PER_YEAR_REAL / s.sampler.total;
      s.curMonth = curMonth;
    }

    while (t >= s.next) {
      if (t - s.next <= CATCHUP_CAP && s.blasts.length < MAX_DOTS) {
        const [lon, lat, m49] = s.sampler.sampleCell();
        spawnBlast(lon, lat, s.next);
        onPushDeath(m49);
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
