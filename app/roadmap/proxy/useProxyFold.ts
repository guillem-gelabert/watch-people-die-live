// The scroll mechanic behind the proxy card: five full write-ups that collapse, one after another,
// into a five-row ranking as the reader scrolls past them. It is a reading device — you have to
// have read the cases before you can rank them — so it is driven straight off scroll position with
// no easing of its own, and it suspends whenever the modal or a drag has taken over.
import { useCallback, useEffect, useRef, useState } from "react";
import { smoothstep } from "../../globe/helpers";

// A folded strip is this tall: enough for one line of Bebas plus its rank number.
export const FOLDED_HEIGHT = 46;
// The fold runs slightly past the fifth strip so the last one finishes before the card unsticks.
const OVERSHOOT = 5.25;
// Past this much of a strip's own fold, its paragraph is gone and the title centres itself.
const PARAGRAPH_GONE = 0.55;

export interface FoldState {
  // Per strip, in DOM order: how far through its own collapse it is, 0 to 1.
  progress: number[];
  // True once every strip has folded — the point the ranking is legible as a ranking.
  complete: boolean;
}

interface Options {
  count: number;
  // Folding is a scroll effect; while the reader is dragging rows or reading the modal, scroll
  // belongs to them and the fold must hold still.
  suspended: boolean;
  onComplete: () => void;
}

export function useProxyFold({ count, suspended, onComplete }: Options) {
  const stackRef = useRef<HTMLDivElement | null>(null);
  const [fold, setFold] = useState<FoldState>(() => ({
    progress: Array.from({ length: count }, () => 0),
    complete: false,
  }));
  const completedRef = useRef(false);

  const measure = useCallback(() => {
    const stack = stackRef.current;
    if (!stack || suspended) return;
    const vh = window.innerHeight || 1;
    const rect = stack.getBoundingClientRect();
    // How far the sticky card has travelled through its own container, where the container is
    // deliberately taller than the card so there is room to travel.
    const travel = Math.max(1, rect.height - vh * 0.5);
    const raw = Math.min(1, Math.max(0, (12 - rect.top) / travel));
    const p = raw * OVERSHOOT;
    const progress = Array.from({ length: count }, (_, i) =>
      smoothstep(Math.min(1, Math.max(0, p - i))),
    );
    const complete = progress.every((v) => v > 0.995);
    setFold({ progress, complete });
    if (complete && !completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  }, [count, suspended, onComplete]);

  useEffect(() => {
    let queued = false;
    const handler = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        measure();
      });
    };
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler);
      window.removeEventListener("resize", handler);
    };
  }, [measure]);

  return { stackRef, fold };
}

// The geometry of one strip at a given point in its fold. Heights and paddings are interpolated
// rather than transitioned: the reader's scroll is the clock, and a CSS transition on top of it
// would lag behind the finger.
export function stripStyle(progress: number, naturalHeight: number, isFirst: boolean) {
  const e = progress;
  const open = 1 - e;
  return {
    height: `${FOLDED_HEIGHT + Math.max(0, naturalHeight - FOLDED_HEIGHT) * open}px`,
    paddingTop: `${10 + 6 * open}px`,
    paddingBottom: `${10 + 7 * open}px`,
    marginTop: isFirst ? "0px" : `${6 + 6 * open}px`,
  };
}

export function paragraphStyle(progress: number) {
  const opacity = 1 - Math.min(1, progress / PARAGRAPH_GONE);
  return {
    opacity,
    display: progress > PARAGRAPH_GONE ? ("none" as const) : undefined,
  };
}

export function isFolded(progress: number): boolean {
  return progress > PARAGRAPH_GONE;
}
