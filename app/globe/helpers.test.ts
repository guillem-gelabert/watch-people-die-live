import { describe, expect, it, vi } from "vitest";
import { expGap, flashIntensity, lonLatToVec3 } from "./helpers";

describe("lonLatToVec3", () => {
  it("places every lon/lat exactly on the sphere of radius r", () => {
    const r = 3;
    const points: [number, number][] = [
      [0, 0],
      [180, 0],
      [-180, 0],
      [0, 90],
      [0, -90],
      [45.2, -33.9],
    ];
    for (const [lon, lat] of points) {
      expect(lonLatToVec3(lon, lat, r).length()).toBeCloseTo(r, 10);
    }
  });

  it("maps the north pole to (0, r, 0) regardless of longitude", () => {
    const v = lonLatToVec3(123, 90, 1);
    expect(v.x).toBeCloseTo(0, 10);
    expect(v.y).toBeCloseTo(1, 10);
    expect(v.z).toBeCloseTo(0, 10);
  });
});

describe("expGap", () => {
  it("is non-negative and scales linearly with the mean for a fixed draw", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const gapAt10 = expGap(10);
    const gapAt20 = expGap(20);
    expect(gapAt10).toBeGreaterThan(0);
    expect(gapAt20).toBeCloseTo(gapAt10 * 2, 10);
    vi.restoreAllMocks();
  });
});

describe("flashIntensity", () => {
  it("stays within [0, 1] and fades out for old ages", () => {
    for (const age of [0, 12, 100, 460, 1000, 5000]) {
      const v = flashIntensity(age);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(flashIntensity(50000)).toBeLessThan(0.01);
  });

  it("peaks near the two bump centers (12ms and 460ms)", () => {
    expect(flashIntensity(12)).toBeGreaterThan(flashIntensity(200));
    expect(flashIntensity(460)).toBeGreaterThan(flashIntensity(1500));
  });
});
