import { describe, expect, it } from "vitest";
import { scoreGuess, worstFootrule } from "./proxyScores";

const TRUTH = [1, 2, 3, 0, 4];

describe("worstFootrule", () => {
  it("is the distance a fully reversed ranking travels", () => {
    // [a,b,c,d,e] against [e,d,c,b,a] is 4 + 2 + 0 + 2 + 4.
    expect(worstFootrule(5)).toBe(12);
    expect(worstFootrule(4)).toBe(8);
  });
});

describe("scoreGuess", () => {
  it("scores a perfect ranking as five exact and full accuracy", () => {
    const v = scoreGuess(TRUTH, [...TRUTH]);
    expect(v.exact).toBe(5);
    expect(v.footrule).toBe(0);
    expect(v.accuracy).toBe(1);
    expect(v.rows.every((r) => r.delta === 0)).toBe(true);
  });

  it("scores a reversed ranking as zero accuracy", () => {
    const v = scoreGuess(TRUTH, [...TRUTH].reverse());
    expect(v.exact).toBe(1); // the middle item cannot move
    expect(v.footrule).toBe(worstFootrule(5));
    expect(v.accuracy).toBe(0);
  });

  it("signs the delta by which way the reader was wrong", () => {
    // Reader put the data's best proxy last.
    const v = scoreGuess(TRUTH, [2, 3, 0, 4, 1]);
    const best = v.rows.find((r) => r.index === 1);
    expect(best?.truthRank).toBe(1);
    expect(best?.guessRank).toBe(5);
    expect(best?.delta).toBe(4);
  });

  it("leaves every row unscored when the reader skipped", () => {
    const v = scoreGuess(TRUTH, null);
    expect(v.exact).toBe(0);
    expect(v.accuracy).toBe(0);
    expect(v.rows.every((r) => r.guessRank === null && r.delta === null)).toBe(true);
    expect(v.rows.map((r) => r.truthRank)).toEqual([1, 2, 3, 4, 5]);
  });
});
