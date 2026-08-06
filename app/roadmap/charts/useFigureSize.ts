// The story's column is fluid between a min and a max, so a figure cannot be drawn at one fixed
// size and scaled to fit: a viewBox stretched from 393px to a 570px column takes a 9.5px axis label
// with it and prints it at 13.8px. Every figure that carries type therefore measures the width it
// actually got and draws at that width, in real pixels, so the type stays the size it was designed.
//
// Figures made only of marks (a raster close-up, say) are free to keep a fixed viewBox and scale —
// there is nothing in them whose size is a typographic decision.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// What the design was drawn at, and what a figure uses until it has been measured — one frame at
// most, and the right answer for the phone the design came from.
export const DESIGN_WIDTH = 393;

export function useFigureWidth<T extends Element>(): [
  ref: (node: T | null) => void,
  width: number,
] {
  const [width, setWidth] = useState(DESIGN_WIDTH);
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!node) return;
    const measure = () => {
      const next = Math.round(node.getBoundingClientRect().width);
      // A figure inside a collapsed or not-yet-laid-out container measures 0; keeping the previous
      // width avoids a divide-by-zero frame in every scale that depends on it.
      if (next > 0) setWidth(next);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return [ref, width];
}

// How many device pixels a canvas figure should draw per CSS pixel, capped at 2 the way the
// design caps it. The server renders at the cap so the markup it sends matches a retina phone;
// on a 1× display the client settles to 1 and halves the raster instead of drawing four times
// the pixels and letting the browser throw them away.
const CANVAS_SCALE_CAP = 2;

function subscribeToPixelRatio(onChange: () => void): () => void {
  // A media query bound to the current ratio fires when the window moves to a different
  // display — the one time this value changes without a reload.
  const query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useCanvasScale(): number {
  return useSyncExternalStore(
    subscribeToPixelRatio,
    () => Math.min(CANVAS_SCALE_CAP, window.devicePixelRatio || 1),
    () => CANVAS_SCALE_CAP,
  );
}

// A figure's height from its measured width. Aspect is what the design fixed, but a figure that
// simply kept its aspect would become a 400px-tall band of empty plot on a wide column, so the
// result is clamped: past the bounds the figure stops growing and the plot just gets wider.
export function figureHeight(
  width: number,
  { aspect, min, max }: { aspect: number; min: number; max: number },
): number {
  return Math.round(Math.min(max, Math.max(min, width * aspect)));
}
