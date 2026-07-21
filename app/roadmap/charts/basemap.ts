import { useSyncExternalStore } from "react";
import * as d3 from "d3";

export const GRAY_EARTH_URL = "/maps/gray-earth.jpg";

// Matches roadmap.css's own mobile breakpoint (`@media (width <= 680px)`) — lets a map
// component switch to a squarer, more zoomed-in viewBox/bbox on small screens instead of
// rendering the same wide desktop crop shrunk down.
const MOBILE_BREAKPOINT = "(max-width: 680px)";

function subscribeToBreakpoint(onChange: () => void) {
  const mql = window.matchMedia(MOBILE_BREAKPOINT);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function readIsMobile() {
  return window.matchMedia(MOBILE_BREAKPOINT).matches;
}

// SSR default: assume desktop until the client measures the real viewport.
function readIsMobileServer() {
  return false;
}

export function useIsMobileMap(): boolean {
  return useSyncExternalStore(subscribeToBreakpoint, readIsMobile, readIsMobileServer);
}

let imagePromise: Promise<HTMLImageElement> | null = null;

export function loadGrayEarth() {
  imagePromise ??= new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = GRAY_EARTH_URL;
  });
  return imagePromise;
}

// [[west, south], [east, north]] in degrees.
export type Bbox = [[number, number], [number, number]];

// Every roadmap world map crops to one named region instead of the whole globe —
// fits an equirectangular projection to a lon/lat bbox the same way BorderRasterCloseup
// already fit its own closeups, via a rectangular region-of-interest polygon.
export function fitRegionProjection(
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
  return d3.geoEquirectangular().fitExtent(
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

// Natural Earth's raster is plate carrée, as are the roadmap's map projections. Drawing
// three wrapped copies keeps cropped views continuous at the antimeridian.
function rasterBounds(projection: d3.GeoProjection) {
  const origin = projection([0, 0]);
  const oneDegreeEast = projection([1, 0]);
  const north = projection([0, 90]);
  if (!origin || !oneDegreeEast || !north) return null;

  const pixelsPerDegree = Math.abs(oneDegreeEast[0] - origin[0]);
  return {
    x: origin[0] - 180 * pixelsPerDegree,
    y: north[1],
    width: 360 * pixelsPerDegree,
    height: 180 * pixelsPerDegree,
  };
}

// SVG: appends the wrapped basemap raster, clipped to the panel rect, and returns the
// (already-clipped) content group the caller should draw its own fills/dots into —
// NOT a separate clip-path of its own. `clip-path` implicitly isolates an element into
// its own blending group (same as `isolation: isolate`), so a second, sibling clipped
// group can only ever blend against its own transparent background, never against the
// raster sitting in a different group next to it — any `mix-blend-mode` on content
// added that way silently renders as if blending were off. Once a projection is fit to
// a regional bbox rather than the whole sphere, the sphere's own projected shape is a
// rectangle far bigger than the panel, so clipping to it (the old approach) wouldn't
// constrain anything — the panel rect is the only clip that's still meaningful at any
// zoom level.
export function appendGrayEarthBasemap(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  projection: d3.GeoProjection,
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

  const bounds = rasterBounds(projection);
  if (!bounds) return content;

  const raster = content.append("g").attr("opacity", 0.55).style("pointer-events", "none");
  for (const offset of [-1, 0, 1]) {
    raster
      .append("image")
      .attr("href", GRAY_EARTH_URL)
      .attr("x", bounds.x + offset * bounds.width)
      .attr("y", bounds.y)
      .attr("width", bounds.width)
      .attr("height", bounds.height)
      .attr("preserveAspectRatio", "none");
  }
  return content;
}

export interface RasterRect {
  key: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

// JSX: the same three wrapped-raster rects as appendGrayEarthBasemap, as plain data —
// for components (like BorderRasterCloseup) that render their own <image> elements
// declaratively instead of imperatively selecting into a live d3 <svg>.
export function grayEarthRasterRects(projection: d3.GeoProjection): RasterRect[] {
  const bounds = rasterBounds(projection);
  if (!bounds) return [];
  return [-1, 0, 1].map((offset) => ({
    key: offset,
    x: bounds.x + offset * bounds.width,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  }));
}

// Canvas: same wrapped-raster placement, for DensityMap's offscreen background canvas.
export function drawGrayEarthBasemap(
  context: CanvasRenderingContext2D,
  projection: d3.GeoProjection,
  image: CanvasImageSource,
) {
  const bounds = rasterBounds(projection);
  if (!bounds) return;
  context.save();
  context.globalAlpha = 0.55;
  for (const offset of [-1, 0, 1]) {
    context.drawImage(
      image,
      bounds.x + offset * bounds.width,
      bounds.y,
      bounds.width,
      bounds.height,
    );
  }
  context.restore();
}
