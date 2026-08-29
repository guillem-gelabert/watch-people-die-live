import { describe, expect, it } from "vitest";
import * as d3 from "d3";
import {
  fitProjection,
  fitRegionProjection,
  inflateCell,
  insideViewport,
  projectCell,
  ringPath,
  type Bbox,
} from "./basemap";

// The seasonality map's own frame: hemispheric, crossing the equator, and the one that made
// this file worth testing — its cells are half the size the constants below were tuned at.
const FRAME: Bbox = [
  [-18, -36],
  [93, 72],
];
const SIDE = 786;

describe("fitProjection", () => {
  it("puts every bbox corner inside the padded extent", () => {
    const padding = 6;
    const projection = fitProjection(
      d3.geoEqualEarth().rotate([-37.5, 0]),
      FRAME,
      SIDE,
      SIDE,
      padding,
    );
    const corners: [number, number][] = [
      [FRAME[0][0], FRAME[0][1]],
      [FRAME[0][0], FRAME[1][1]],
      [FRAME[1][0], FRAME[1][1]],
      [FRAME[1][0], FRAME[0][1]],
    ];
    for (const corner of corners) {
      const xy = projection(corner);
      expect(xy).not.toBeNull();
      const [x, y] = xy!;
      // fitExtent fits the bbox's *outline*, and a pseudocylindrical projection bows that
      // outline outward between the corners, so the corners themselves sit at or inside the
      // padded box — never past it.
      expect(x).toBeGreaterThanOrEqual(padding - 0.5);
      expect(x).toBeLessThanOrEqual(SIDE - padding + 0.5);
      expect(y).toBeGreaterThanOrEqual(padding - 0.5);
      expect(y).toBeLessThanOrEqual(SIDE - padding + 0.5);
    }
  });

  it("fills the panel: the fitted bbox touches both padded edges on its long axis", () => {
    const padding = 0;
    const projection = fitProjection(d3.geoEqualEarth(), FRAME, SIDE, SIDE, padding);
    const bounds = d3.geoPath(projection).bounds({
      type: "Polygon",
      coordinates: [
        [
          [FRAME[0][0], FRAME[0][1]],
          [FRAME[0][0], FRAME[1][1]],
          [FRAME[1][0], FRAME[1][1]],
          [FRAME[1][0], FRAME[0][1]],
          [FRAME[0][0], FRAME[0][1]],
        ],
      ],
    });
    const w = bounds[1][0] - bounds[0][0];
    const h = bounds[1][1] - bounds[0][1];
    expect(Math.max(w, h)).toBeCloseTo(SIDE, 0);
  });

  it("gives fitRegionProjection an equirectangular fit of the same bbox", () => {
    const region = fitRegionProjection(FRAME, SIDE, SIDE);
    const explicit = fitProjection(d3.geoEquirectangular(), FRAME, SIDE, SIDE);
    expect(region([10, 10])).toEqual(explicit([10, 10]));
  });
});

describe("projectCell", () => {
  const projection = fitProjection(d3.geoEqualEarth().rotate([-37.5, 0]), FRAME, SIDE, SIDE, 0);

  it("returns the four corners in ring order, not an axis-aligned rectangle", () => {
    const ring = projectCell(projection, 10, 10, 0.5);
    expect(ring).not.toBeNull();
    expect(ring).toHaveLength(4);
    // Ring order is SW, SE, NE, NW in lon/lat, which on any north-up projection means the
    // first two corners are below the last two on screen (y grows downward).
    const [sw, se, ne, nw] = ring as [
      [number, number],
      [number, number],
      [number, number],
      [number, number],
    ];
    expect(sw[1]).toBeGreaterThan(nw[1]);
    expect(se[1]).toBeGreaterThan(ne[1]);
    expect(se[0]).toBeGreaterThan(sw[0]);
    expect(ne[0]).toBeGreaterThan(nw[0]);
  });

  it("matches the projection point for point", () => {
    const ring = projectCell(projection, -3, 41, 0.5)!;
    const corners: [number, number][] = [
      [-3, 41],
      [-2.5, 41],
      [-2.5, 41.5],
      [-3, 41.5],
    ];
    corners.forEach((corner, index) => {
      expect(ring[index]).toEqual(projection(corner));
    });
  });

  it("is null when a corner projects to nothing finite", () => {
    // Mercator has no north pole: a cell whose top edge crosses 90 degrees projects to NaN
    // there, and that is exactly the case the finiteness guard exists for. Returning a ring
    // with a NaN corner would hand canvas a path it silently drops the rest of the batch for.
    const mercator = d3.geoMercator();
    expect(projectCell(mercator, 0, 89.8, 0.5)).toBeNull();
    expect(projectCell(mercator, 0, 60, 0.5)).not.toBeNull();
  });
});

describe("inflateCell", () => {
  it("grows a square symmetrically about its own centroid", () => {
    const square: [number, number][] = [
      [10, 10],
      [12, 10],
      [12, 12],
      [10, 12],
    ];
    const grown = inflateCell(square, 0.6);
    const centroid = (ring: [number, number][]): [number, number] => [
      ring.reduce((sum, p) => sum + p[0], 0) / ring.length,
      ring.reduce((sum, p) => sum + p[1], 0) / ring.length,
    ];
    const [cx, cy] = centroid(square);
    const [gx, gy] = centroid(grown);
    expect(gx).toBeCloseTo(cx, 10);
    expect(gy).toBeCloseTo(cy, 10);
    // Corners move radially, so each corner is exactly `pixels` further from the centre and a
    // side grows by 0.6/√2 at each end — the arithmetic the 0.6 default was chosen against.
    for (const [x, y] of grown) {
      expect(Math.hypot(x - cx, y - cy)).toBeCloseTo(Math.SQRT2 + 0.6, 10);
    }
    expect(grown[1]![0] - grown[0]![0]).toBeCloseTo(2 + 1.2 / Math.SQRT2, 10);
  });

  it("scales with the pixel argument, which is what a smaller cell needs", () => {
    const square: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    const side = (ring: [number, number][]) => ring[1]![0] - ring[0]![0];
    expect(side(inflateCell(square, 0.25))).toBeLessThan(side(inflateCell(square, 0.6)));
    expect(side(inflateCell(square, 0))).toBeCloseTo(1, 10);
  });

  it("leaves a degenerate ring where it is instead of dividing by zero", () => {
    const point: [number, number][] = [
      [5, 5],
      [5, 5],
      [5, 5],
      [5, 5],
    ];
    for (const [x, y] of inflateCell(point, 0.6)) {
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    }
  });
});

describe("ringPath", () => {
  it("round-trips a closed ring at two decimals", () => {
    const ring: [number, number][] = [
      [1.005, 2],
      [3.14159, 4],
      [5, 6.5],
    ];
    const d = ringPath(ring);
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(d).toBe("M1.00,2.00L3.14,4.00L5.00,6.50Z");
    expect(d.split("L")).toHaveLength(3);
  });
});

describe("insideViewport", () => {
  it("keeps the panel's own edges and drops what a regional crop pushes off it", () => {
    expect(insideViewport([0, 0], 100, 100)).toBe(true);
    expect(insideViewport([100, 100], 100, 100)).toBe(true);
    expect(insideViewport([-0.1, 50], 100, 100)).toBe(false);
    expect(insideViewport([50, 100.1], 100, 100)).toBe(false);
    expect(insideViewport(null, 100, 100)).toBe(false);
    expect(insideViewport(undefined, 100, 100)).toBe(false);
  });
});
