"use client";

import { useEffect, useRef } from "react";

// How far the reader has to keep pulling before the page goes back to the globe. Short enough
// to discover by accident, long enough that the last paragraph can still be scrolled to
// comfortably without triggering it.
const THRESHOLD = 104;
// The bar is drawn at a fixed width rather than a percentage so it reads as a gauge filling up
// rather than a layout that stretches.
const BAR_WIDTH = 118;
// A mouse wheel arrives in discrete deltas with no "end" event, so an idle gap stands in for
// letting go. Just longer than the gap between two flicks of the same gesture.
const WHEEL_DECAY_MS = 320;

// The end of the story: an upward pull at the very bottom fills a bar and sends the reader back
// to the globe they started on. Touch and wheel share one progress value so a trackpad gets the
// same gesture as a thumb.
export default function PullToGlobe() {
  const hintRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const arrowRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const hint = hintRef.current;
    if (!hint) return;

    let pull = 0;
    let startY: number | null = null;
    let fired = false;
    let decay: ReturnType<typeof setTimeout> | undefined;
    let releaseTimer: ReturnType<typeof setTimeout> | undefined;

    const atEnd = () =>
      window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 2;

    const paint = (k: number) => {
      hint.style.transform = `translateY(${(-16 * k).toFixed(1)}px)`;
      hint.style.setProperty("--pull-strength", k.toFixed(3));
      if (barRef.current) barRef.current.style.width = `${Math.round(k * BAR_WIDTH)}px`;
      if (arrowRef.current) {
        arrowRef.current.style.transform = `translateY(${(-6 * k).toFixed(1)}px) scale(${(1 + 0.25 * k).toFixed(2)})`;
      }
      if (labelRef.current) {
        labelRef.current.textContent = k >= 1 ? "Release for the globe" : "Pull up for the globe";
      }
    };

    const fire = () => {
      if (fired) return;
      fired = true;
      pull = 0;
      paint(1);
      releaseTimer = setTimeout(() => {
        paint(0);
        fired = false;
      }, 700);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0]?.clientY ?? null;
      pull = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (startY == null || fired || y == null) return;
      // Positive means the finger travelled up, which is the direction that would scroll past
      // the end of the page.
      const travelled = startY - y;
      if (!atEnd() || travelled <= 0) {
        startY = y;
        pull = 0;
        paint(0);
        return;
      }
      pull = travelled;
      paint(Math.min(1, pull / THRESHOLD));
    };

    const onTouchEnd = () => {
      if (pull >= THRESHOLD) fire();
      else paint(0);
      startY = null;
      pull = 0;
    };

    const onWheel = (e: WheelEvent) => {
      if (fired || !atEnd() || e.deltaY <= 0) return;
      pull = Math.min(THRESHOLD * 1.4, pull + e.deltaY);
      paint(Math.min(1, pull / THRESHOLD));
      clearTimeout(decay);
      if (pull >= THRESHOLD) {
        fire();
        return;
      }
      decay = setTimeout(() => {
        pull = 0;
        paint(0);
      }, WHEEL_DECAY_MS);
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("wheel", onWheel);
      clearTimeout(decay);
      clearTimeout(releaseTimer);
    };
  }, []);

  return (
    <div id="pull-hint" ref={hintRef}>
      {/* The gesture is a shortcut, not the only way back: the button does the same thing for
          anyone using a keyboard, a screen reader, or a mouse without a wheel. It wraps the whole
          stack — arrow, label and track — so the three sit at one gap, as they do in the design,
          rather than the track falling outside the control at a second one. */}
      <button type="button" id="pull-button" onClick={() => window.scrollTo({ top: 0 })}>
        <span id="pull-arrow" ref={arrowRef} aria-hidden="true">
          ↑
        </span>
        <span id="pull-label" ref={labelRef}>
          Pull up for the globe
        </span>
        <span id="pull-track" aria-hidden="true">
          <span id="pull-bar" ref={barRef} />
        </span>
      </button>
    </div>
  );
}
