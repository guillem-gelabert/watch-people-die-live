import * as d3 from "d3";

// [[west, south], [east, north]] in degrees.
export type Bbox = [[number, number], [number, number]];

// Every square map draws its graticule at this width, so the grid reads as one device across the
// story rather than as a per-figure decision. The colour is the section's own background at full
// opacity — `var(--sky)` for the SVG maps, the resolved sky for the canvas one — which makes the
// graticule read as the page showing through the map instead of as ink drawn over it.
export const GRATICULE_WIDTH = 2;

// Every roadmap world map crops to one named region instead of the whole globe —
// fits an equirectangular projection to a lon/lat bbox the same way BorderRasterCloseup
// already fit its own closeups, via a rectangular region-of-interest polygon.
export function fitRegionProjection(
  bbox: Bbox,
  width: number,
  height: number,
  padding = 6,
): d3.GeoProjection {
  return fitProjection(d3.geoEquirectangular(), bbox, width, height, padding);
}

// The same bbox fit for any projection, so a figure can pick the one that suits its region — a
// conic equal-area for a continent read north-to-south, azimuthal for a country, plate carrée
// for a raster crop — instead of stretching everything onto one.
export function fitProjection(
  projection: d3.GeoProjection,
  bbox: Bbox,
  width: number,
  height: number,
  padding = 6,
): d3.GeoProjection {
  const [[lon0, lat0], [lon1, lat1]] = bbox;
  const roi: GeoJSON.Polygon = {
    type: "Polygon",
    coordinates: [
      [
        [lon0, lat0],
        [lon0, lat1],
        [lon1, lat1],
        [lon1, lat0],
        [lon0, lat0],
      ],
    ],
  };
  return projection.fitExtent(
    [
      [padding, padding],
      [width - padding, height - padding],
    ],
    roi,
  );
}

// True when a projected point lands inside the visible panel — used to drop dots (and
// any other point-placed marks) that a regional crop pushes off-screen, instead of
// letting them render past the panel edge.
export function insideViewport(
  xy: [number, number] | null | undefined,
  width: number,
  height: number,
): xy is [number, number] {
  return xy != null && xy[0] >= 0 && xy[0] <= width && xy[1] >= 0 && xy[1] <= height;
}

// A grid cell is a rectangle in lon/lat and a tilted quadrilateral once projected, so the maps that
// rasterise onto the 0.5° lattice project all four of its corners rather than two. Returns them in
// ring order, or null when any corner falls off the projection.
export function projectCell(
  projection: d3.GeoProjection,
  lon: number,
  lat: number,
  size: number,
): [number, number][] | null {
  const corners: [number, number][] = [
    [0, 0],
    [size, 0],
    [size, size],
    [0, size],
  ];
  const ring: [number, number][] = [];
  for (const [dLon, dLat] of corners) {
    const p = projection([lon + dLon, lat + dLat]);
    if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return null;
    ring.push([p[0], p[1]]);
  }
  return ring;
}

// Cells are filled with no outline anywhere, so two neighbours sharing an edge exactly would still
// show a hairline: each side antialiases to about half coverage and the two halves do not add back
// up to one, so the plate reads through as a grid. Growing every cell out from its own centre makes
// neighbours overlap instead, and the overlap is invisible because it is the same fill on both sides.
//
// 0.6px is measured, not guessed. Corners move radially, so a square gains only about 0.6/√2 per
// side and two neighbours overlap by roughly 0.85px — comfortably more than the ~0.5px of coverage
// antialiasing loses. At 0.35px the seams were still there (215 stray plate pixels on the density
// map, 87 on the region map); at 0.9px they were gone but that is 39% of a 2.3px density cell, wide
// enough to start bleeding one cell's colour into the next. This sits above the artefact and below
// the bleed.
export function inflateCell(ring: [number, number][], pixels = 0.6): [number, number][] {
  let cx = 0;
  let cy = 0;
  for (const [x, y] of ring) {
    cx += x / ring.length;
    cy += y / ring.length;
  }
  return ring.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return [x + (dx / len) * pixels, y + (dy / len) * pixels];
  });
}

// An SVG path command for a closed ring, for the cell maps that draw in SVG rather than canvas.
export function ringPath(ring: [number, number][]): string {
  return `M${ring.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join("L")}Z`;
}

// SVG: clips the panel and lays down its plate, returning the (already-clipped) content group the
// caller draws its own fills into — NOT a separate clip-path of its own. `clip-path` implicitly
// isolates an element into its own blending group (same as `isolation: isolate`), so a second,
// sibling clipped group can only ever blend against its own transparent background, never against
// what sits in a different group next to it — any `mix-blend-mode` on content added that way silently
// renders as if blending were off. Once a projection is fit to a regional bbox rather than the whole
// sphere, the sphere's own projected shape is a rectangle far bigger than the panel, so clipping to
// it (the old approach) wouldn't constrain anything — the panel rect is the only clip that stays
// meaningful at any zoom level.
//
// This used to also draw Natural Earth's shaded relief, wrapped three times across the antimeridian,
// under the fills. The relief is gone: on a map whose whole subject is a value per country, terrain
// is a second picture competing with the first, and it was the only thing the raster machinery here
// existed for.
export function appendMapPlate(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  width: number,
  height: number,
  id: string,
): d3.Selection<SVGGElement, unknown, null, undefined> {
  const clipId = `${id}-panel-clip`;
  svg
    .append("defs")
    .append("clipPath")
    .attr("id", clipId)
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", width)
    .attr("height", height);

  const content = svg.append("g").attr("clip-path", `url(#${clipId})`);
  content.append("rect").attr("width", width).attr("height", height).attr("fill", "#000000");
  return content;
}
