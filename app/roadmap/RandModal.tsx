"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import {
  clearRand,
  closeRand,
  getRandState,
  getServerRandState,
  openRand,
  subscribeRand,
} from "./randExplainer";
import { useDict } from "./I18nContext";

// How much of the viewport the opened sheet takes, matching the design's 8% top inset and
// 80% height.
const TOP = 0.08;
const HEIGHT = 0.8;
const SIDE = 16;
// The genie takes this long to travel; the contents fade in behind it and out ahead of it.
const TRAVEL_MS = 600;

// The word in the prose that owns the aside. It is a real button inside the sentence, so the
// question ("what do you mean, randomly?") is asked exactly where the reader thinks it.
export function RandPill({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button
      type="button"
      className="rand-pill"
      ref={ref}
      onClick={() => {
        const r = ref.current?.getBoundingClientRect();
        if (r) openRand({ left: r.left, top: r.top, width: r.width, height: r.height });
      }}
    >
      {children}
    </button>
  );
}

// The aside itself: a sheet that grows out of the pill and shrinks back into it, so the reader
// never loses the sentence they left. Everything inside is authored in ROADMAP.md.
export default function RandModal({ children }: { children: ReactNode }) {
  const { origin, open } = useSyncExternalStore(subscribeRand, getRandState, getServerRandState);
  const innerRef = useRef<HTMLDivElement>(null);
  const d = useDict();

  // Once it has shrunk back into the pill, take it out of the DOM.
  useEffect(() => {
    if (!origin || open) return;
    const id = setTimeout(clearRand, TRAVEL_MS);
    return () => clearTimeout(id);
  }, [origin, open]);

  // Every opening starts at the top of the aside, not where the last one was left.
  useEffect(() => {
    if (open && innerRef.current) innerRef.current.scrollTop = 0;
  }, [open]);

  // While the sheet is up it owns the screen: the story behind it must not scroll away.
  useEffect(() => {
    if (!origin) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRand();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [origin]);

  if (!origin) return null;

  // Open: the sheet fills the screen bar a margin. Closed: it is exactly the pill it came from.
  const box = open
    ? {
        left: SIDE,
        top: Math.round(window.innerHeight * TOP),
        width: window.innerWidth - SIDE * 2,
        height: Math.round(window.innerHeight * HEIGHT),
      }
    : origin;

  return (
    <>
      <div className="rand-scrim" data-open={open ? "1" : "0"} onClick={closeRand} />
      <div
        className="rand-sheet"
        data-open={open ? "1" : "0"}
        role="dialog"
        aria-modal="true"
        aria-label={d.rand.label}
        style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
      >
        <div className="rand-inner" ref={innerRef}>
          {children}
          <button type="button" className="rand-close" onClick={closeRand}>
            {d.rand.close}
          </button>
        </div>
      </div>
    </>
  );
}
