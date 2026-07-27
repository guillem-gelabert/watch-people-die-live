"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Canvas, extend } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three/webgpu";
import Earth from "./Earth";
import RoadmapClient from "../roadmap/RoadmapClient";
import { useGlobeData } from "./useGlobeData";
import { makePersona } from "./persona";
import { GLOBE_R, FOV } from "./constants";
import "../globe.css";

// `extend`'s Catalogue overload wants Record<string, ConstructorRepresentation>; the
// "three/webgpu" namespace object also carries non-constructor exports (functions,
// enums), so TS can't infer the narrower overload structurally — this reproduces the
// call the JS version made and is safe at runtime (r3f only reads constructor entries).
extend(THREE as unknown as Record<string, new (...args: never[]) => object>);

type OrbitControlsRef = React.ComponentRef<typeof OrbitControls>;

interface FeedLine {
  id: number;
  text: string;
}

const FEED_SOFT_MAX = 60; // trimmed back to this while following
const FEED_HARD_MAX = 200; // absolute cap, even when paused

let feedIdCounter = 0;

interface GlobeProps {
  roadmapMarkdown: string;
}

export default function Globe({ roadmapMarkdown }: GlobeProps) {
  const { data: globeData, geo } = useGlobeData();
  const [loaded, setLoaded] = useState(false);
  // Direction the camera eases toward to center the viewer's location, or null when
  // idle / after the user takes over (cleared by OrbitControls' "start" event).
  const camTarget = useRef<THREE.Vector3 | null>(null);
  const controlsRef = useRef<OrbitControlsRef | null>(null);

  // --- Roadmap overlay -------------------------------------------------------
  // The roadmap is prerendered as a full-viewport overlay clipped behind the globe, then
  // revealed with a growing circular clip-path. Mounting is deferred until after the globe's
  // first frame (during idle) so its heavy data + chart work doesn't fight the globe's startup
  // — and, crucially, so by the time the info button is pressed the content is already painted
  // and the clip-path animation runs on a quiet main thread.
  const [mountRoadmap, setMountRoadmap] = useState(false);
  const [roadmapOpen, setRoadmapOpen] = useState(false);
  const revealElRef = useRef<HTMLDivElement>(null);
  const infoButtonRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!loaded || mountRoadmap) return;
    const id = requestIdleCallback(() => setMountRoadmap(true));
    return () => cancelIdleCallback(id);
  }, [loaded, mountRoadmap]);

  const openRoadmap = useCallback(() => {
    const el = revealElRef.current;
    const btn = infoButtonRef.current;
    if (el && btn) {
      // Grow the circle from the button's center out to whichever viewport corner is farthest,
      // so the reveal exactly clears the screen over the full duration (no off-screen tail) and
      // self-corrects if the button sits elsewhere (e.g. landscape).
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const r = Math.max(
        Math.hypot(cx, cy),
        Math.hypot(w - cx, cy),
        Math.hypot(cx, h - cy),
        Math.hypot(w - cx, h - cy),
      );
      el.style.setProperty("--reveal-origin", `${cx}px ${cy}px`);
      el.style.setProperty("--reveal-r", `${r}px`);
      el.scrollTop = 0; // always reveal from the top of the roadmap
    }
    setRoadmapOpen(true);
    // Reflect the overlay in the URL so browser Back closes it and the address is shareable
    // (a fresh load of /roadmap hits the standalone route instead).
    window.history.pushState({ roadmap: true }, "", "/roadmap");
  }, []);

  const closeRoadmap = useCallback(() => {
    // Unwind the pushed entry so the popstate handler closes us and the URL restores to "/".
    if (window.history.state?.roadmap) window.history.back();
    else setRoadmapOpen(false);
  }, []);

  // Browser Back (popstate) and Escape both close the overlay; the in-overlay "back" control
  // routes through closeRoadmap → history.back → popstate, so all three share one path.
  useEffect(() => {
    const onPopState = () => setRoadmapOpen(false);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRoadmap();
    };
    window.addEventListener("popstate", onPopState);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeRoadmap]);

  // --- Death feed state ------------------------------------------------------
  const [lines, setLines] = useState<FeedLine[]>([]);
  const followingRef = useRef(true);
  const [following, setFollowingState] = useState(true);
  const smoothingRef = useRef(false);
  const feedElRef = useRef<HTMLDivElement>(null);
  const trackElRef = useRef<HTMLDivElement>(null);
  const nameByIdRef = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    if (globeData && !globeData.error) nameByIdRef.current = globeData.nameById;
  }, [globeData]);

  const setFollowing = useCallback((v: boolean) => {
    followingRef.current = v;
    setFollowingState(v);
  }, []);

  const isAtBottom = useCallback(() => {
    const el = feedElRef.current;
    if (!el) return true;
    return el.scrollHeight - el.clientHeight - el.scrollTop <= 4;
  }, []);

  const stickToBottom = useCallback((smooth: boolean) => {
    const el = feedElRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const scrollToNewest = useCallback(() => {
    smoothingRef.current = true;
    setFollowing(true);
    stickToBottom(true);
  }, [setFollowing, stickToBottom]);

  useEffect(() => {
    const el = feedElRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = isAtBottom();
      if (atBottom) smoothingRef.current = false;
      if (!smoothingRef.current) setFollowing(atBottom);
    };
    const pause = () => {
      smoothingRef.current = false;
      setFollowing(false);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("pointerdown", pause, { passive: true });
    el.addEventListener("wheel", pause, { passive: true });
    el.addEventListener("touchstart", pause, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("pointerdown", pause);
      el.removeEventListener("wheel", pause);
      el.removeEventListener("touchstart", pause);
    };
  }, [isAtBottom, setFollowing]);

  // FLIP: measure the new line's height post-render, then glide the stack up.
  const pendingFlip = useRef<{ smooth: boolean } | null>(null);
  useEffect(() => {
    const track = trackElRef.current;
    if (!track || !pendingFlip.current) return;
    const { smooth } = pendingFlip.current;
    pendingFlip.current = null;
    if (smooth) return; // button catch-up animates via scroll, not FLIP
    const last = track.lastElementChild as HTMLElement | null;
    if (!last) return;
    const gap = parseFloat(getComputedStyle(track).rowGap) || 0;
    const dy = last.offsetHeight + gap;
    if (!(dy > 0)) return;
    track.style.transition = "none";
    track.style.transform = `translateY(${dy}px)`;
    void track.offsetHeight; // force reflow so the inverted start is committed
    track.style.transition = "transform 0.35s ease-out";
    track.style.transform = "translateY(0)";
  }, [lines]);

  const onPushDeath = useCallback(
    (m49: number) => {
      const country = nameByIdRef.current.get(m49) || "Unknown";
      const persona = makePersona(m49, country);
      const smooth = smoothingRef.current;
      pendingFlip.current = { smooth };
      setLines((prev) => {
        let next = [...prev, { id: ++feedIdCounter, text: persona.text }];
        if (followingRef.current) {
          if (next.length > FEED_SOFT_MAX) next = next.slice(next.length - FEED_SOFT_MAX);
        } else if (next.length > FEED_HARD_MAX) {
          // Paused but over the hard cap: drop the oldest and compensate scrollTop so
          // the lines being read stay put.
          const el = feedElRef.current;
          const track = trackElRef.current;
          const removed = track?.firstElementChild as HTMLElement | null;
          if (removed && el) {
            const gap = parseFloat(getComputedStyle(track as HTMLElement).rowGap) || 0;
            const h = removed.offsetHeight + gap;
            requestAnimationFrame(() => {
              el.scrollTop = Math.max(0, el.scrollTop - h);
            });
          }
          next = next.slice(next.length - FEED_HARD_MAX);
        }
        return next;
      });
      requestAnimationFrame(() => {
        if (followingRef.current) stickToBottom(smoothingRef.current);
      });
    },
    [stickToBottom],
  );

  const onFirstFrame = useCallback(() => setLoaded(true), []);

  // r3f's <Canvas> re-runs `configure()` — and with it this `gl` factory — on every render of
  // this component, and its "create the renderer once" guard reads `state.gl` *before* awaiting
  // the factory. Since `WebGPURenderer.init()` is async, any re-render during that window (geo
  // resolving, globe data arriving, the first feed line) slips past the guard and builds a second
  // renderer on the same canvas. Two WebGPU devices then fight over the one GPUCanvasContext —
  // the last `configure()` wins it, so the renderer r3f actually kept draws into textures owned
  // by the other device and nothing ever presents (blank globe + "WebGPU Device Lost").
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
  const sceneProps = useMemo(() => ({ background: new THREE.Color(0x000011) }), []);
  const dpr = useMemo(() => [1, 2] as [number, number], []);

  // Globe re-renders on every death-feed line (several/second). Memoize the roadmap subtree so
  // those re-renders don't re-parse the markdown or reconcile all 16 charts — keeping the feed
  // cheap and, critically, keeping the re-render off the reveal animation's frames.
  const roadmapContent = useMemo(
    () => <RoadmapClient markdown={roadmapMarkdown} onClose={closeRoadmap} />,
    [roadmapMarkdown, closeRoadmap],
  );

  return (
    <div>
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
            />
          )}
          <OrbitControls
            ref={controlsRef}
            enableDamping
            enablePan={false}
            minDistance={GLOBE_R * 1.1}
            maxDistance={6}
            touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
            onStart={() => (camTarget.current = null)}
          />
        </Canvas>
      </div>

      <div id="death-feed" aria-live="polite" aria-label="Most recent deaths" ref={feedElRef}>
        <div id="feed-track" ref={trackElRef}>
          {lines.map((line, i) => (
            <div
              key={line.id}
              className={i === lines.length - 1 ? "feed-line feed-new" : "feed-line"}
            >
              {line.text}
            </div>
          ))}
        </div>
      </div>
      <button
        id="feed-bottom"
        className={following ? "hidden" : ""}
        aria-label="Scroll to newest"
        onClick={scrollToNewest}
      >
        ↓
      </button>
      <Link
        id="info-button"
        href="/roadmap"
        aria-label="View project roadmap"
        ref={infoButtonRef}
        onClick={(e) => {
          // Once the overlay is warm, intercept and play the smooth in-page reveal. Before then
          // (brief idle window after first frame), fall through to real navigation to /roadmap.
          if (mountRoadmap) {
            e.preventDefault();
            openRoadmap();
          }
        }}
      >
        i
      </Link>

      {mountRoadmap && (
        <div
          className={roadmapOpen ? "reveal is-open" : "reveal"}
          ref={revealElRef}
          inert={!roadmapOpen}
        >
          {roadmapContent}
        </div>
      )}
    </div>
  );
}
