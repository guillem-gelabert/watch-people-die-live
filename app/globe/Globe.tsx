"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, extend } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three/webgpu";
import Earth from "./Earth";
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

export default function Globe() {
  const { data: globeData, geo } = useGlobeData();
  const [loaded, setLoaded] = useState(false);
  // Direction the camera eases toward to center the viewer's location, or null when
  // idle / after the user takes over (cleared by OrbitControls' "start" event).
  const camTarget = useRef<THREE.Vector3 | null>(null);
  const controlsRef = useRef<OrbitControlsRef | null>(null);

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

  return (
    <div>
      <div id="loader" aria-hidden="true" className={loaded ? "hidden" : ""}>
        <div className="spinner" />
      </div>

      <div id="globe" aria-label="3D globe of real-time deaths">
        <Canvas
          camera={{ fov: FOV, near: 0.1, far: 100, position: [0, 0, 3] }}
          scene={{ background: new THREE.Color(0x000011) }}
          dpr={[1, 2]}
          gl={async (props) => {
            // `props` is typed for a generic (WebGL-shaped) canvas context — e.g. its
            // powerPreference includes "default", which WebGPURendererParameters doesn't
            // accept. WebGPURenderer ignores fields it doesn't recognize at runtime.
            const renderer = new THREE.WebGPURenderer({
              ...props,
              antialias: true,
            } as ConstructorParameters<typeof THREE.WebGPURenderer>[0]);
            await renderer.init();
            return renderer;
          }}
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
    </div>
  );
}
