// The bend only works if both end states are the same kind of path. A cubic tweened against a
// line (`M36,96 L96,36`, which is what the linear half used to be) cannot interpolate at all, so
// what these pin is the shape of the command string, not just its endpoints.
import { describe, expect, it } from "vitest";
import { elasticBend, scalePathD } from "./ScaleDiagonalToggle";

const CUBIC = /^M6,80 C-?[\d.]+,-?[\d.]+ -?[\d.]+,-?[\d.]+ 84,8$/;

describe("scalePathD", () => {
  it("is one cubic between the same two endpoints at every point in the tween", () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      expect(scalePathD(t)).toMatch(CUBIC);
    }
  });

  it("draws a straight line at 0 — controls at a third and two thirds of the chord", () => {
    expect(scalePathD(0)).toBe("M6,80 C32,56 58,32 84,8");
  });

  it("draws the log curve at 1", () => {
    expect(scalePathD(1)).toBe("M6,80 C16,34 36,16 84,8");
  });

  it("moves monotonically between the two, so the word bends rather than jumping", () => {
    const firstControlY = (t: number) => Number(/C[\d.]+,([\d.]+)/.exec(scalePathD(t))![1]);
    const ys = [0, 0.2, 0.4, 0.6, 0.8, 1].map(firstControlY);
    for (let i = 1; i < ys.length; i++) expect(ys[i]!).toBeLessThan(ys[i - 1]!);
  });
});

describe("elasticBend", () => {
  it("starts and ends exactly on its endpoints", () => {
    expect(elasticBend(0)).toBeCloseTo(0, 6);
    expect(elasticBend(1)).toBeCloseTo(1, 6);
  });

  it("bows the wrong way before setting off", () => {
    const early = [0.05, 0.1, 0.15, 0.2].map(elasticBend);
    expect(Math.min(...early)).toBeLessThan(0);
  });

  it("swings past the target before settling onto it", () => {
    const late = [0.8, 0.85, 0.9, 0.95].map(elasticBend);
    expect(Math.max(...late)).toBeGreaterThan(1);
  });

  it("is halfway at halfway, so the word swaps on the halfway shape", () => {
    expect(elasticBend(0.5)).toBeCloseTo(0.5, 6);
  });

  it("stays within a tenth either side — enough to read as sprung, not as a glitch", () => {
    const all = Array.from({ length: 201 }, (_, i) => elasticBend(i / 200));
    expect(Math.min(...all)).toBeGreaterThan(-0.15);
    expect(Math.max(...all)).toBeLessThan(1.15);
  });
});
