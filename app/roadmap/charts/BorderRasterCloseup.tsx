"use client";

import { useMemo, type PointerEvent as ReactPointerEvent } from "react";
import * as d3 from "d3";
import { showTooltip, hideTooltip } from "../tooltip";
import { GRAY_EARTH_URL, grayEarthRasterRects, type RasterRect } from "./basemap";
import type { CountryFeature, DensityGrid } from "../types";

// Fixed viewBox: same aspect for every panel so a responsive grid gives every box the
// same height. Equirectangular maps lon/lat linearly, so cell squareness now depends on
// the roi's aspect ratio matching the panel's — a mismatch stretches cells uniformly.
const NOMINAL_W = 600;
const PANEL_AR = 1.5; // width / height (3:2)
const NOMINAL_H = Math.round(NOMINAL_W / PANEL_AR);

type Bbox = [[number, number], [number, number]];

interface CellModel {
  key: string;
  d: string;
  fill: string;
  m49: number;
  pop: number;
  lon: number;
  lat: number;
}

interface BorderModel {
  key: string | number;
  d: string;
  feature: CountryFeature;
}

interface Model {
  width: number;
  height: number;
  rasterRects: RasterRect[];
  cells: CellModel[];
  borders: BorderModel[];
  nameById: Map<number, string>;
}

interface BorderRasterCloseupProps {
  features: CountryFeature[] | null;
  grid: DensityGrid | null;
  bbox: Bbox;
  zoom?: number;
  title: string;
  id: string;
  colorBy?: "country" | "density";
}

// Shows a region with the rastered density cells (blocky 0.5deg squares) overlaid by
// the smooth vector country borders (topojson), so a cell can visibly belong to one
// country's raster block while sitting across a neighbor's vector polygon. Rendered as
// SVG (via d3-geo path strings) so borders stay crisp at any size — no canvas
// pixelation. The region of interest is centered/contained; the surrounding area is
// overscanned (more cells/borders drawn than strictly visible) and cropped to the
// viewBox, so a mismatched panel aspect never shows black margins.
//
// colorBy: "country" (default) hues each cell by its raster-owning country, same
// palette per country as the mismatch demo. "density" hues each cell by population
// (log scale), matching the flat DensityMap chart above it.
export default function BorderRasterCloseup({
  features,
  grid,
  bbox,
  zoom = 1,
  title,
  id,
  colorBy = "country",
}: BorderRasterCloseupProps) {
  const model = useMemo<Model | null>(() => {
    if (!features || !grid) return null;

    // Optional zoom: shrink the visible window around the bbox center. Default 1 shows
    // the whole region.
    const [[bLon0, bLat0], [bLon1, bLat1]] = bbox;
    const cLon = (bLon0 + bLon1) / 2;
    const cLat = (bLat0 + bLat1) / 2;
    const halfLon = (bLon1 - bLon0) / 2 / zoom;
    const halfLat = (bLat1 - bLat0) / 2 / zoom;
    const lon0 = cLon - halfLon;
    const lon1 = cLon + halfLon;
    const lat0 = cLat - halfLat;
    const lat1 = cLat + halfLat;
    // Region-of-interest rectangle. Ring wound SW→NW→NE→SE→SW (counterclockwise in
    // lon/lat): d3-geo is spherical and ring winding decides which side is "inside".
    // The reverse order makes d3 treat the rectangle as its complement (nearly the whole
    // globe), which breaks fitExtent (fits the whole world → region renders tiny) and
    // the cell fills (each square floods the panel).
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

    // Contain the ROI in the fixed-aspect viewBox; letterbox margins on the off-aspect
    // axis are filled by overscan (below), then everything is cropped to the viewBox.
    const width = NOMINAL_W;
    const height = NOMINAL_H;
    const projection = d3.geoEquirectangular().fitExtent(
      [
        [0, 0],
        [width, height],
      ],
      roi,
    );
    const path = d3.geoPath(projection);
    const rasterRects = grayEarthRasterRects(projection);
    // Overscan window: the lon/lat span that actually covers the whole viewBox at this
    // projection (invert its four corners), padded a cell so cells reach the edges. We
    // draw everything in this window, not just the ROI, so off-aspect margins are filled.
    const cellSize = grid.cellsize;
    const corners = [
      projection.invert?.([0, 0]),
      projection.invert?.([width, 0]),
      projection.invert?.([0, height]),
      projection.invert?.([width, height]),
    ].filter((c): c is [number, number] => Boolean(c));
    const oLon0 = Math.min(...corners.map((c) => c[0])) - cellSize;
    const oLon1 = Math.max(...corners.map((c) => c[0])) + cellSize;
    const oLat0 = Math.min(...corners.map((c) => c[1])) - cellSize;
    const oLat1 = Math.max(...corners.map((c) => c[1])) + cellSize;
    const inWindow = (lon: number, lat: number) =>
      lon >= oLon0 && lon <= oLon1 && lat >= oLat0 && lat <= oLat1;

    const nameById = new Map(features.map((f) => [Number(f.id), f.properties?.name ?? "Unknown"]));

    // "country" mode: one hue per country that owns a density cell in the window.
    // Every country's borders are drawn (and cropped) regardless, so no membership
    // sampling is required — just a stable color per raster owner.
    let colorById: Map<number, string> | null = null;
    // "density" mode: same log1p(pop) scale as the flat DensityMap chart, computed over
    // the full grid so the color scale means the same thing in both charts.
    let densityColor: d3.ScaleSequential<string> | null = null;
    if (colorBy === "density") {
      const maxLog = Math.log1p(d3.max(grid.cells, (c) => c[2]) ?? 0);
      densityColor = d3
        .scaleSequential()
        .domain([0, maxLog])
        .interpolator(d3.interpolateRgb("#1c2331", "#ff5252"));
    } else {
      const inRegionIds = new Set<number>();
      for (const [lon, lat, , m49] of grid.cells) {
        if (inWindow(lon, lat)) inRegionIds.add(Number(m49));
      }
      const idList = [...inRegionIds];
      const palette = d3.quantize(d3.interpolateRainbow, Math.max(idList.length, 2));
      colorById = new Map(idList.map((cid, i) => [cid, palette[i % palette.length]!]));
    }

    // Density cells in the window → projected GeoJSON squares. Ring wound
    // SW→NW→NE→SE→SW so d3-geo's spherical fill treats the square as the small
    // interior, not its complement (see the roi note above).
    const cells: CellModel[] = [];
    for (const [lon, lat, pop, m49] of grid.cells) {
      if (!inWindow(lon, lat)) continue;
      const fill = densityColor ? densityColor(Math.log1p(pop)) : colorById?.get(Number(m49));
      if (!fill) continue;
      const square: GeoJSON.Polygon = {
        type: "Polygon",
        coordinates: [
          [
            [lon, lat],
            [lon, lat + cellSize],
            [lon + cellSize, lat + cellSize],
            [lon + cellSize, lat],
            [lon, lat],
          ],
        ],
      };
      const d = path(square);
      if (!d) continue;
      cells.push({ key: `${lon},${lat}`, d, fill, m49: Number(m49), pop, lon, lat });
    }

    // Draw every country's borders; the viewBox-rect clip crops the overscan (and
    // overseas parts of multi-part countries) down to the visible panel.
    const borders: BorderModel[] = features
      .map((f, i): BorderModel | null => {
        const d = path(f);
        if (!d) return null;
        return { key: f.id ?? f.properties?.name ?? i, d, feature: f };
      })
      .filter((b): b is BorderModel => b !== null);

    return { width, height, rasterRects, cells, borders, nameById };
  }, [features, grid, bbox, zoom, colorBy]);

  if (!model) {
    return (
      <section className="chart-panel">
        <h4 className="chart-title">{title}</h4>
        <div className="chart-status">Loading…</div>
      </section>
    );
  }

  const { width, height, rasterRects, cells, borders, nameById } = model;
  const clipId = `${id}-clip`;

  // Cell hover: raster country is the cell's own m49; also resolve the vector country
  // under the pointer so we can flag the mismatch strip near borders.
  const onCellMove = (event: ReactPointerEvent, cell: CellModel) => {
    const rasterName = nameById.get(cell.m49);
    const vectorHit = borders.find((b) =>
      d3.geoContains(b.feature, [cell.lon + 0.25, cell.lat + 0.25]),
    );
    const vectorName = vectorHit?.feature.properties?.name;
    const place =
      rasterName && vectorName && rasterName !== vectorName
        ? `raster: ${rasterName} / vector: ${vectorName} (mismatch)`
        : rasterName || vectorName || "Unknown";
    const text =
      colorBy === "density"
        ? `${Math.round(cell.pop).toLocaleString()} people/cell — ${place}`
        : place;
    showTooltip(text, event.clientX, event.clientY);
  };

  return (
    <section className="chart-panel">
      <h4 className="chart-title">{title}</h4>
      <svg
        id={id}
        className="seasonality-chart"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Close-up of vector country borders overlapping rastered density cells near ${title}`}
        style={{ background: "#0d0f14" }}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width={width} height={height} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          <g opacity={0.55} style={{ pointerEvents: "none" }}>
            {rasterRects.map((r) => (
              <image
                key={r.key}
                href={GRAY_EARTH_URL}
                x={r.x}
                y={r.y}
                width={r.width}
                height={r.height}
                preserveAspectRatio="none"
              />
            ))}
          </g>
          <g fillOpacity={colorBy === "density" ? 0.9 : 0.55} style={{ mixBlendMode: "overlay" }}>
            {cells.map((c) => (
              <path
                key={c.key}
                d={c.d}
                fill={c.fill}
                stroke="none"
                onPointerMove={(e) => onCellMove(e, c)}
                onPointerLeave={hideTooltip}
              />
            ))}
          </g>
          <g fill="none" stroke="#ffffff" strokeWidth={1} strokeLinejoin="round">
            {borders.map((b) => (
              <path
                key={b.key}
                d={b.d}
                onPointerMove={(e) =>
                  showTooltip(b.feature.properties?.name ?? "Unknown", e.clientX, e.clientY)
                }
                onPointerLeave={hideTooltip}
                style={{ pointerEvents: "stroke" }}
              />
            ))}
          </g>
        </g>
      </svg>
    </section>
  );
}
