"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { Canvas, extend } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three/webgpu";
import Earth from "./Earth";
import Island from "./Island";
import { useGlobeData } from "./useGlobeData";
import { makePersona } from "./persona";
import { publishDeath } from "./stageState";
import { useDict } from "../roadmap/I18nContext";
import { FOV } from "./constants";
import "../globe.css";

// `extend`'s Catalogue overload wants Record<string, ConstructorRepresentation>; the
// "three/webgpu" namespace object also carries non-constructor exports (functions,
// enums), so TS can't infer the narrower overload structurally — this reproduces the
// call the JS version made and is safe at runtime (r3f only reads constructor entries).
extend(THREE as unknown as Record<string, new (...args: never[]) => object>);

type OrbitControlsRef = React.ComponentRef<typeof OrbitControls>;

interface GlobeStageProps {
  // Scroll progress out of the hero, 0..1, written every frame by the story's scroll
  // handler. Nothing here reads it during render — it is threaded straight to Earth's
  // useFrame — so the canvas subtree never re-renders on scroll.
  phaseRef: RefObject<number>;
}

// The opening screen of the story: the live globe, its loader, and the island. Deaths do
// not flow through React state here — Earth publishes them to the stage store and only the
// island subscribes, so a death (roughly twice a second) never re-renders the canvas.
function GlobeStage({ phaseRef }: GlobeStageProps) {
  const { data: globeData, geo } = useGlobeData();
  const d = useDict();
  const [loaded, setLoaded] = useState(false);
  // Direction the camera eases toward to center the viewer's location, or null when
  // idle / after the user takes over (cleared by OrbitControls' "start" event).
  const camTarget = useRef<THREE.Vector3 | null>(null);
  const controlsRef = useRef<OrbitControlsRef | null>(null);
  const pausedRef = useRef(false);
  const nameByIdRef = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    if (globeData && !globeData.error) nameByIdRef.current = globeData.nameById;
  }, [globeData]);

  const onPushDeath = useCallback(
    (m49: number, lon: number, lat: number) => {
      const country = nameByIdRef.current.get(m49) || d.charts.common.unknown;
      publishDeath({
        ...makePersona(m49, country, { ...d.globe, causes: d.causes }),
        lon,
        lat,
        at: performance.now(),
      });
    },
    [d],
  );

  const onPausedChange = useCallback((paused: boolean) => {
    pausedRef.current = paused;
  }, []);

  const onFirstFrame = useCallback(() => setLoaded(true), []);

  // r3f's <Canvas> re-runs `configure()` — and with it this `gl` factory — on every render of
  // this component, and its "create the renderer once" guard reads `state.gl` *before* awaiting
  // the factory. Since `WebGPURenderer.init()` is async, any re-render during that window (geo
  // resolving, globe data arriving) slips past the guard and builds a second renderer on the
  // same canvas. Two WebGPU devices then fight over the one GPUCanvasContext — the last
  // `configure()` wins it, so the renderer r3f actually kept draws into textures owned by the
  // other device and nothing ever presents (blank globe + "WebGPU Device Lost").
  // Caching the promise per canvas makes the factory idempotent: every call gets one renderer.
  const rendererRef = useRef<{
    canvas: unknown;
    renderer: Promise<THREE.WebGPURenderer>;
  } | null>(null);

  const createRenderer = useCallback((props: { canvas: unknown }) => {
    const cached = rendererRef.current;
    if (cached && cached.canvas === props.canvas) return cached.renderer;
    const renderer = (async () => {
      // `props` is typed for a generic (WebGL-shaped) canvas context — e.g. its
      // powerPreference includes "default", which WebGPURendererParameters doesn't
      // accept. WebGPURenderer ignores fields it doesn't recognize at runtime.
      const r = new THREE.WebGPURenderer({
        ...props,
        antialias: true,
      } as ConstructorParameters<typeof THREE.WebGPURenderer>[0]);
      await r.init();
      return r;
    })();
    rendererRef.current = { canvas: props.canvas, renderer };
    return renderer;
  }, []);

  // Same reason: stable prop identities so the repeated `configure()` calls have nothing to
  // re-apply, instead of handing it a fresh camera/scene/dpr descriptor several times a second.
  const cameraProps = useMemo(
    () => ({ fov: FOV, near: 0.1, far: 100, position: [0, 0, 3] as const }),
    [],
  );
  // Transparent: the story's sky shows through behind the globe as it scrolls away.
  const sceneProps = useMemo(() => ({ background: null }), []);
  const dpr = useMemo(() => [1, 2] as [number, number], []);

  return (
    <>
      <div id="loader" aria-hidden="true" className={loaded ? "hidden" : ""}>
        <div className="spinner" />
      </div>

      <div id="globe" aria-label="3D globe of real-time deaths">
        <Canvas
          camera={cameraProps}
          scene={sceneProps}
          dpr={dpr}
          gl={createRenderer}
          fallback={<div style={{ color: "#fff", padding: 24 }}>WebGL/WebGPU not supported.</div>}
        >
          {globeData && !globeData.error && (
            <Earth
              globeData={globeData}
              geo={geo}
              onFirstFrame={onFirstFrame}
              onPushDeath={onPushDeath}
              camTarget={camTarget}
              controlsRef={controlsRef}
              phaseRef={phaseRef}
              pausedRef={pausedRef}
            />
          )}
          {/* Rotation only. Zoom is off on every input: the opening framing is chosen (HERO_FILL
              puts the sphere at two thirds of the screen) and a reader who pinched or scrolled into
              it could not get back to it — and on a wheel the globe was swallowing the gesture the
              page needed for scrolling. Two-finger touch is left as ROTATE rather than DOLLY_PAN so
              a second finger does not zoom either. */}
          <OrbitControls
            ref={controlsRef}
            enableDamping
            enablePan={false}
            enableZoom={false}
            touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.ROTATE }}
            onStart={() => (camTarget.current = null)}
          />
        </Canvas>
      </div>

      <Island onPausedChange={onPausedChange} />
    </>
  );
}

// Memoised, and it has to be. The story re-renders whenever the section in view changes the sky —
// about ten times over the page — and its only prop here is a ref, so every one of those renders
// was re-rendering this subtree for nothing. That is not free: <Canvas> re-runs `configure()` on
// each render (see createRenderer above), and each sky change cost a ~100ms stall — a visible jolt
// in the globe at the exact moment the background began to cross-fade.
export default memo(GlobeStage);
