import { describe, expect, it } from "vitest";
import { legendStepForProgress } from "./chartHelpers";

describe("legendStepForProgress", () => {
  it("activates five equal bins in sequence across a sweep", () => {
    expect(
      [0, 0.2, 0.4, 0.6, 0.8, 1].map((progress) => legendStepForProgress(progress, 5)),
    ).toEqual([0, 1, 2, 3, 4, 4]);
  });

  it("clamps out-of-range progress and handles an empty legend", () => {
    expect(legendStepForProgress(-1, 5)).toBe(0);
    expect(legendStepForProgress(2, 5)).toBe(4);
    expect(legendStepForProgress(0.5, 0)).toBe(-1);
  });
});
