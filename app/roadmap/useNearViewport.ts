"use client";

import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function reducedMotionSnapshot(): boolean {
  return window.matchMedia(REDUCED_MOTION).matches;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeToReducedMotion, reducedMotionSnapshot, () => false);
}

// Animation work only needs to start shortly before a figure can be seen. State changes at most
// twice during an ordinary pass (enter/leave), while the animation itself stays in refs and rAF.
export function useNearViewport<T extends Element>(
  ref: RefObject<T | null>,
  rootMargin = "50% 0px",
): boolean {
  const [near, setNear] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      const fallback = window.setTimeout(() => setNear(true), 0);
      return () => window.clearTimeout(fallback);
    }

    const observer = new IntersectionObserver(
      ([entry]) => setNear(entry?.isIntersecting ?? false),
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, rootMargin]);

  return near;
}
