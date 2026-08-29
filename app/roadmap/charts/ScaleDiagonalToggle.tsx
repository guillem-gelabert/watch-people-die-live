"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../storyMotion";
import { useDict } from "../I18nContext";

interface ScaleDiagonalToggleProps {
  id: string;
  logOn: boolean;
  onToggle: (logOn: boolean) => void;
}

// The log/linear switch, sitting on the map it controls rather than above it. One word, drawn the
// way the scale it names behaves: "Logarithmic" bends, "Linear" runs straight. Clicking it swaps
// both at once — the word changes as the curve straightens — so the control is never showing an
// option the map is not in. It used to show both states at once, split along the square's
// anti-diagonal, which made the reader work out which half was live.
//
// Both paths are cubics between the same two endpoints, differing only in their control points, so
// the bend is four numbers to interpolate rather than two incompatible shapes to cross-fade.
const START = "6,80";
const END = "84,8";
// A cubic's two control points, as [c1x, c1y, c2x, c2y].
type Controls = [number, number, number, number];
// The log curve: a slow start that whips up near the end, the shape of the scale itself.
const LOG_CONTROLS: Controls = [16, 34, 36, 16];
// The same cubic with its controls placed on the straight line at a third and two thirds, which is
// exactly a line and is interpolation-compatible with the curve above.
const LINEAR_CONTROLS: Controls = [32, 56, 58, 32];
const TWEEN_MS = 520;
// How far the bend travels past each end, as a fraction. The classic "back" constant, 1.70158,
// gives about a tenth either side: the curve first bows the wrong way, then swings through and
// past the target before settling onto it.
const BACK = 1.70158;

// Anticipation and overshoot, in and out. Below zero for the first stretch and above one for the
// last, which is what makes the word look sprung rather than driven: because `t` feeds straight
// into the control points, a negative t bows the curve away from where it is heading and a t past
// one bends it further than it will end up.
export function elasticBend(x: number): number {
  const c = BACK * 1.525;
  return x < 0.5
    ? ((2 * x) ** 2 * ((c + 1) * 2 * x - c)) / 2
    : ((2 * x - 2) ** 2 * ((c + 1) * (x * 2 - 2) + c) + 2) / 2;
}

// t = 0 is straight, t = 1 is fully bent. Deliberately unclamped: the easing above runs outside
// [0, 1] and the extrapolated control points are what draw the anticipation and the overshoot.
export function scalePathD(t: number): string {
  const lerp = (from: number, to: number) => Math.round((from + (to - from) * t) * 100) / 100;
  const [lx1, ly1, lx2, ly2] = LINEAR_CONTROLS;
  const [gx1, gy1, gx2, gy2] = LOG_CONTROLS;
  return (
    `M${START} C${lerp(lx1, gx1)},${lerp(ly1, gy1)} ` + `${lerp(lx2, gx2)},${lerp(ly2, gy2)} ${END}`
  );
}

export default function ScaleDiagonalToggle({ id, logOn, onToggle }: ScaleDiagonalToggleProps) {
  const t = useDict().charts.densityMap;
  const [bend, setBend] = useState(logOn ? 1 : 0);
  // Tracked separately from `logOn` so the word can change halfway through the bend rather than at
  // either end — the reader sees the new word straighten or curl into place, not a finished shape
  // suddenly relabelled.
  const [label, setLabel] = useState(logOn ? t.scaleLog : t.scaleLinear);
  const frameRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    const target = logOn ? 1 : 0;
    const word = logOn ? t.scaleLog : t.scaleLinear;

    // First render, and anyone who asked for less motion, get the end state directly.
    if (!mountedRef.current || prefersReducedMotion()) {
      mountedRef.current = true;
      setBend(target);
      setLabel(word);
      return;
    }

    const from = target === 1 ? 0 : 1;
    const started = performance.now();
    let swapped = false;

    const step = (now: number) => {
      const raw = Math.min(1, (now - started) / TWEEN_MS);
      const eased = elasticBend(raw);
      setBend(from + (target - from) * eased);
      if (!swapped && raw >= 0.5) {
        swapped = true;
        setLabel(word);
      }
      if (raw < 1) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [logOn, t.scaleLog, t.scaleLinear]);

  return (
    <button
      type="button"
      className="scale-diagonal"
      aria-pressed={logOn}
      onClick={() => onToggle(!logOn)}
    >
      <span className="sr-only">{t.scaleSpoken}</span>
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <defs>
          <path id={`${id}-path`} d={scalePathD(bend)} fill="none" />
        </defs>
        <text className="scale-diagonal-label">
          <textPath href={`#${id}-path`} startOffset="50%" textAnchor="middle">
            {label}
          </textPath>
        </text>
      </svg>
    </button>
  );
}
