// The scroll mechanic behind the proxy card: five full write-ups that collapse, one after another,
// into a five-row ranking as the reader scrolls past them. It is a reading device — you have to
// have read the cases before you can rank them — so it is driven straight off scroll position with
// no easing of its own, and it suspends whenever the modal or a drag has taken over.
import { useCallback, useEffect, useRef, useState } from "react";
import { smoothstep } from "../../globe/helpers";

// A folded strip is this tall: enough for one line of Bebas plus its rank number.
export const FOLDED_HEIGHT = 46;
// The gap between folded strips — the value stripStyle's marginTop collapses to, shared so the
// interpolation and foldedBoxesHeight cannot drift apart.
export const FOLDED_GAP = 6;
// Scroll distance over which one strip folds, in viewport heights. Chosen to preserve the shipped
// pacing exactly: the old container gave the fold (2.97 − 0.5)vh of travel across an overshoot of
// 5.25 strips, i.e. 0.4705vh per strip. The old SCREENS_PER_STRIP = 0.55 was nominal only.
export const STRIP_TRAVEL = 0.47;
// Where the sticky card pins. Must match `.proxy-card { top: 12px }` in roadmap.css.
const STICKY_TOP = 12;

// What a fully folded .proxy-boxes actually measures: five strips at FOLDED_HEIGHT (border-box,
// so padding is inside) plus the gaps between them. The first strip has no top margin. 254 for
// five — not FOLDED_HEIGHT * 5 = 230, which is what the modal placeholder used to assume.
export function foldedBoxesHeight(count: number): number {
  return count * FOLDED_HEIGHT + (count - 1) * FOLDED_GAP;
}

// Strips' worth of scroll past the sticky pin. Computed from where the stack's top is,
// deliberately NOT from the stack's height — so the container can be sized to end where the fold
// ends (s02) without that resize changing the fold's pacing. Unclamped above: it keeps growing
// after the card releases, and the per-strip clamp in foldProgress handles it.
export function foldUnits(rectTop: number, vh: number): number {
  return Math.max(0, STICKY_TOP - rectTop) / Math.max(1, vh * STRIP_TRAVEL);
}

export function foldProgress(p: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => smoothstep(Math.min(1, Math.max(0, p - i))));
}

// The auto-open must be the reader's own scroll arriving at the finished ranking — never a reload,
// an anchor jump, or the browser restoring scroll after hydration. A "first measure is
// calibration" rule is not enough for that: Next restores scroll asynchronously relative to first
// effects, and the stack is 0px tall on its first frame, so the restore can land as measure #2 or
// #3 in one giant jump. Continuity is the real signal of a human scroll: arm only when the
// PREVIOUS frame already had the last strip more than half folded.
export function completionArmed(prevP: number | null, count: number): boolean {
  return prevP !== null && prevP >= count - 0.5;
}

// The once-latch. Any completion latches — the session's auto-open is spent whether or not it
// fired, so a reader who arrived past the fold is in the same "already seen" state as one who
// scrolled through it. Only an armed completion fires. Nothing ever resets the latch: a dismissed
// modal does not re-arm, and the way back in is the card's button.
export function completionEvent(
  alreadyCompleted: boolean,
  complete: boolean,
  armed: boolean,
): { completed: boolean; fire: boolean } {
  if (alreadyCompleted || !complete) return { completed: alreadyCompleted, fire: false };
  return { completed: true, fire: armed };
}

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
  // Last frame's fold units; null until the first unsuspended measure. Null is the calibration
  // flag — completionArmed treats it as "no continuity yet", so the first frame can never fire.
  const lastPRef = useRef<number | null>(null);

  const measure = useCallback(() => {
    const stack = stackRef.current;
    // Returning before lastPRef is touched matters: the modal's close re-runs this effect with an
    // immediate measure, and the pre-modal p must still be the frame it is compared against.
    if (!stack || suspended) return;
    const vh = window.innerHeight || 1;
    const p = foldUnits(stack.getBoundingClientRect().top, vh);
    const progress = foldProgress(p, count);
    const complete = progress.every((v) => v > 0.995);
    setFold({ progress, complete });
    const armed = completionArmed(lastPRef.current, count);
    lastPRef.current = p;
    const next = completionEvent(completedRef.current, complete, armed);
    completedRef.current = next.completed;
    if (next.fire) onComplete();
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
    marginTop: isFirst ? "0px" : `${FOLDED_GAP + 6 * open}px`,
  };
}

// The container height that ends exactly where the fold ends: the folded card (its measured
// chrome plus the deterministic folded boxes) plus one strip's travel per strip. The fold
// completes at ~4.96 strips of travel and the card releases at 5.0 — a deliberate ~0.02vh lead so
// `complete` is robustly reachable while the card is still pinned. The old RUN_OUT constant, and
// the dead scroll it created after the fold finished, are gone.
export function stackHeightFor(cardChrome: number, vh: number, count: number): number {
  return Math.round(cardChrome + foldedBoxesHeight(count) + vh * STRIP_TRAVEL * count);
}
