// Pins the two behaviours whose failure was silent enough to ship: the modal opening on a reload
// that landed past the fold, and the placeholder assuming folded boxes are 230px when they are 254.
import { describe, expect, it } from "vitest";
import {
  completionArmed,
  completionEvent,
  FOLDED_GAP,
  FOLDED_HEIGHT,
  foldedBoxesHeight,
  foldProgress,
  foldUnits,
  stackHeightFor,
  stripStyle,
} from "./useProxyFold";

const COUNT = 5;

describe("completionArmed", () => {
  it("is never armed on the calibration frame — the reload bug", () => {
    expect(completionArmed(null, COUNT)).toBe(false);
  });

  it("arms when the previous frame had the last strip more than half folded", () => {
    expect(completionArmed(4.7, COUNT)).toBe(true);
    expect(completionArmed(4.5, COUNT)).toBe(true);
  });

  it("does not arm across a teleport — scroll restore or an anchor jump", () => {
    expect(completionArmed(1.2, COUNT)).toBe(false);
    expect(completionArmed(4.49, COUNT)).toBe(false);
  });
});

describe("completionEvent", () => {
  it("fires exactly once on a genuine armed scroll-in", () => {
    expect(completionEvent(false, true, true)).toEqual({ completed: true, fire: true });
  });

  it("latches silently when completion arrives unarmed — a reload past the fold", () => {
    expect(completionEvent(false, true, false)).toEqual({ completed: true, fire: false });
  });

  it("never refires once latched — the suspended-flip remount path", () => {
    expect(completionEvent(true, true, true)).toEqual({ completed: true, fire: false });
  });

  it("is a no-op while incomplete, and scrolling back up cannot unlatch", () => {
    expect(completionEvent(false, false, true)).toEqual({ completed: false, fire: false });
    expect(completionEvent(true, false, false)).toEqual({ completed: true, fire: false });
  });
});

describe("foldUnits and foldProgress", () => {
  const vh = 740;

  it("is zero at the pin and clamps above it", () => {
    expect(foldUnits(12, vh)).toBe(0);
    expect(foldUnits(500, vh)).toBe(0);
    expect(foldProgress(0, COUNT)).toEqual([0, 0, 0, 0, 0]);
  });

  it("leaves strip i untouched until p reaches i — per-strip pacing", () => {
    const progress = foldProgress(2.5, COUNT);
    expect(progress[0]).toBe(1);
    expect(progress[1]).toBe(1);
    expect(progress[2]).toBeGreaterThan(0);
    expect(progress[2]).toBeLessThan(1);
    expect(progress[3]).toBe(0);
    expect(progress[4]).toBe(0);
  });

  it("completes before the card releases at p = count", () => {
    const complete = (p: number) => foldProgress(p, COUNT).every((v) => v > 0.995);
    expect(complete(4.9)).toBe(false);
    expect(complete(4.96)).toBe(true);
  });

  it("is stable after release", () => {
    expect(foldProgress(7, COUNT)).toEqual([1, 1, 1, 1, 1]);
  });
});

describe("folded geometry", () => {
  it("foldedBoxesHeight(5) is 254 — not the 230 the old placeholder assumed", () => {
    expect(foldedBoxesHeight(5)).toBe(254);
    expect(foldedBoxesHeight(5)).toBe(5 * FOLDED_HEIGHT + 4 * FOLDED_GAP);
  });

  it("agrees with what stripStyle actually renders when folded", () => {
    const folded = stripStyle(1, 210, false);
    expect(folded.height).toBe(`${FOLDED_HEIGHT}px`);
    expect(folded.marginTop).toBe(`${FOLDED_GAP}px`);
    expect(stripStyle(1, 210, true).marginTop).toBe("0px");
  });
});

describe("stackHeightFor", () => {
  it("is chrome + folded boxes + one strip's travel per strip", () => {
    expect(stackHeightFor(156, 740, COUNT)).toBe(Math.round(156 + 254 + 740 * 0.47 * COUNT));
  });

  it("is shorter than the old vh * 2.97 container — the run-out is gone", () => {
    const vh = 740;
    expect(stackHeightFor(156, vh, COUNT)).toBeLessThan(Math.round(vh * 2.97));
  });

  it("is monotonic in viewport height", () => {
    expect(stackHeightFor(156, 900, COUNT)).toBeGreaterThan(stackHeightFor(156, 600, COUNT));
  });
});
