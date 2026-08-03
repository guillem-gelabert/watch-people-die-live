import { describe, expect, it } from "vitest";
import {
  AMP_Y_DOMAIN,
  AMP_Y_TICKS,
  fitAt,
  gdpAlphaScale,
  hashJitter,
  hashUnit,
  MARGINS,
  niceMaxPercent,
  olsFit,
  percentGridStep,
  percentGridValues,
  PROXY,
  quantileByRank,
} from "./chartFrame";

describe("PROXY", () => {
  // These indices are the design's identity order: they pick each proxy's colour and label the
  // reader's submitted ranking. Reordering them would silently recolour five charts and
  // mislabel the "Your #N" notes, so pin them.
  it("holds the design's data-proxy order", () => {
    expect(PROXY).toEqual({ gdp: 0, neighbour: 1, climate: 2, latitude: 3, pop65: 4 });
  });
});

describe("percentGrid", () => {
  it("halves the step for shallow data so a chart never shows two gridlines", () => {
    expect(percentGridStep(12)).toBe(5);
    expect(percentGridStep(25)).toBe(5);
    expect(percentGridStep(25.1)).toBe(10);
    expect(percentGridStep(40)).toBe(10);
  });

  it("lays lines from zero up to and including the max", () => {
    expect(percentGridValues(20)).toEqual([0, 5, 10, 15, 20]);
    expect(percentGridValues(30)).toEqual([0, 10, 20, 30]);
  });

  it("rounds a max up onto a gridline", () => {
    expect(niceMaxPercent(28)).toBe(30);
    expect(niceMaxPercent(30)).toBe(30);
    expect(niceMaxPercent(21)).toBe(25);
    expect(niceMaxPercent(0)).toBe(5);
  });
});

describe("olsFit", () => {
  it("recovers a line it was given exactly", () => {
    const fit = olsFit([
      [0, 1],
      [1, 3],
      [2, 5],
      [3, 7],
    ]);
    if (!fit) throw new Error("expected a fit");
    expect(fit.slope).toBeCloseTo(2);
    expect(fit.intercept).toBeCloseTo(1);
    expect(fit.r).toBeCloseTo(1);
    expect(fitAt(fit, 4)).toBeCloseTo(9);
  });

  it("signs r with the slope", () => {
    const fit = olsFit([
      [0, 10],
      [1, 8],
      [2, 6],
    ]);
    expect(fit?.r).toBeCloseTo(-1);
  });

  it("returns null instead of a degenerate line", () => {
    expect(olsFit([])).toBeNull();
    expect(olsFit([[1, 1]])).toBeNull();
    expect(
      olsFit([
        [2, 1],
        [2, 5],
      ]),
    ).toBeNull();
  });

  it("reports zero correlation for a flat series rather than dividing by zero", () => {
    const fit = olsFit([
      [0, 4],
      [1, 4],
      [2, 4],
    ]);
    expect(fit?.slope).toBeCloseTo(0);
    expect(fit?.r).toBe(0);
  });
});

describe("gdpAlphaScale", () => {
  const alpha = gdpAlphaScale([1000, 10000, 100000, undefined]);

  it("spans 0.35 to 1 across the log range", () => {
    expect(alpha(1000)).toBeCloseTo(0.35);
    expect(alpha(100000)).toBeCloseTo(1);
    expect(alpha(10000)).toBeCloseTo(0.675);
  });

  it("puts a country with no figure mid-range, not at the poor end", () => {
    expect(alpha(undefined)).toBe(0.5);
    expect(alpha(null)).toBe(0.5);
    expect(alpha(0)).toBe(0.5);
  });

  it("falls back to mid-range when every country shares one value", () => {
    expect(gdpAlphaScale([5000, 5000])(5000)).toBe(0.5);
    expect(gdpAlphaScale([])(5000)).toBe(0.5);
  });
});

describe("hash jitter", () => {
  it("stays in range", () => {
    for (let i = 0; i < 50; i += 1) {
      const u = hashUnit(i, i * 3);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
      expect(Math.abs(hashJitter(i, i * 3))).toBeLessThanOrEqual(1);
    }
  });

  it("is deterministic, so a repaint never makes a dot jump", () => {
    expect(hashUnit(3, 7)).toBe(hashUnit(3, 7));
    expect(hashUnit(3, 7)).not.toBe(hashUnit(7, 3));
  });
});

describe("quantileByRank", () => {
  const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it("picks the nearest actual observation rather than interpolating", () => {
    expect(quantileByRank(sorted, 0)).toBe(1);
    expect(quantileByRank(sorted, 1)).toBe(10);
    expect(quantileByRank(sorted, 0.1)).toBe(2);
    expect(quantileByRank(sorted, 0.9)).toBe(9);
  });

  it("survives short and empty buckets", () => {
    expect(quantileByRank([42], 0.9)).toBe(42);
    expect(quantileByRank([], 0.5)).toBe(0);
  });
});

describe("fixed domains", () => {
  it("keeps every amplitude tick inside the plot", () => {
    for (const t of AMP_Y_TICKS) {
      expect(t).toBeGreaterThanOrEqual(AMP_Y_DOMAIN[0]);
      expect(t).toBeLessThanOrEqual(AMP_Y_DOMAIN[1]);
    }
  });

  it("gives the latitude chart room above the plot for its climate captions", () => {
    expect(MARGINS.latitude.top).toBeGreaterThan(MARGINS.amp.top);
    expect(MARGINS.koppen.bottom).toBeGreaterThan(MARGINS.koppen.top);
  });
});
