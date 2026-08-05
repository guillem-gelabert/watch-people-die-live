"use client";

import { useMemo, type PointerEvent as ReactPointerEvent } from "react";
import * as d3 from "d3";
import { showTooltip, hideTooltip } from "../tooltip";
import { parseColor } from "../palette";
import type { CountryFeature, DensityGrid, NeighborsByM49 } from "../types";

// Fixed viewBox: same aspect for every panel so a responsive grid gives every box the
// same height. Equirectangular maps lon/lat linearly, so cell squareness now depends on
// the roi's aspect ratio matching the panel's — a mismatch stretches cells uniformly.
const NOMINAL_W = 600;
// Square, as in the design. `fitExtent` scales uniformly, so a region wider than it is tall is
// letterboxed against the plate rather than stretched — the cells stay square either way.
const PANEL_AR = 1; // width / height
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
  // Shared-border adjacency, so "one hue per country" can actually be a four-colouring rather
  // than a palette cycled by index — which would hand two neighbours the same hue and hide the
  // very mismatch this figure exists to show.
  neighborsByM49?: NeighborsByM49 | null;
}

// Greedy graph colouring over the countries present. Four hues suffice for any planar map, and
// the greedy pass finds an assignment for a handful of countries immediately.
function fourColour(
  ids: number[],
  neighbours: NeighborsByM49 | null | undefined,
  palette: string[],
): Map<number, string> {
  const out = new Map<number, string>();
  for (const id of ids) {
    const taken = new Set(
      (neighbours?.get(id) ?? []).map((n) => out.get(n)).filter((c): c is string => Boolean(c)),
    );
    const pick = palette.find((c) => !taken.has(c)) ?? palette[0];
    out.set(id, pick as string);
  }
  return out;
}

function withAlpha(color: string, alpha: number): string {
  const parsed = parseColor(color);
  if (!parsed) return color;
  return `rgba(${parsed.rgb.join(",")},${alpha.toFixed(3)})`;
}

// The plate both close-ups sit on. Every other figure in the story is transparent, but these two
// are about what the grid does and does not cover: with the page showing through, "no cell here"
// and "page" would be the same colour, and the ragged raster coastline — the whole subject —
// would disappear. The cells are pastel so they read as light on dark.
const PLATE = "#251f2b";

// One hue per country, so the cell grid can be read against the real border.
const COUNTRY_HUES = ["#f68fc0", "#8fc0f6", "#8ff6c5", "#f6f68f"];
// Density carried by alpha over a single pink; the Benelux crop is the only density close-up.
const DENSITY_HUE = "#f68fc0";
// Borders follow rivers and coasts; the grid underneath cannot. Warm against the pastel cells.
const BORDER = "#f6c58f";

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
  neighborsByM49,
}: BorderRasterCloseupProps) {
  // Country mode gets four vivid hues to separate ownership; density mode gets one, because it
  // is showing a quantity and a second hue would imply a second variable.
  //
  // These are fixed literals rather than palette-derived, matching the design: both close-ups keep
  // a dark plate through every sky, so their cells have to stay in one pastel register instead of
  // following the section hue. The design's renderer takes the raw canvas context for exactly this
  // reason ("literal colours: the gaps between cells and the borders").
  const countryHues = COUNTRY_HUES;
  const densityHue = DENSITY_HUE;

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

    // "country" mode: a four-colouring of whichever countries own a density cell in the window.
    // Every country's borders are drawn (and cropped) regardless, so no membership sampling is
    // required — just a stable hue per raster owner.
    let colorById: Map<number, string> | null = null;
    // "density" mode: one hue, with population carried by alpha. The stretch is min–max over the
    // visible window rather than the whole world, because a crop of the Low Countries against the
    // global maximum would be a single flat tone; the 0.8 gamma lifts the sparse end enough to
    // see where the cells actually are.
    let densityAlpha: ((pop: number) => number) | null = null;
    if (colorBy === "density") {
      const inView = grid.cells.filter((c) => inWindow(c[0], c[1])).map((c) => c[2]);
      // Log, then a gamma lift. Raw population in this crop spans four orders of magnitude
      // between a Dutch polder and the Randstad; stretched linearly, every ordinary cell would
      // sit at the bottom of the range and the map would be one flat tone with three bright dots.
      const hiLog = Math.log1p(d3.max(inView) ?? 1);
      densityAlpha = (pop: number) => {
        const t = Math.min(1, Math.log1p(Math.max(0, pop)) / Math.max(1e-6, hiLog));
        // Gamma above 1 after the log: the log alone lifts every inhabited cell into the top half
        // of the range, which flattens the crop back into one tone. This holds ordinary cells down
        // so the cities are still the brightest thing in the frame.
        return 0.08 + Math.pow(t, 1.6) * 0.92;
      };
    } else {
      const inRegionIds = new Set<number>();
      for (const [lon, lat, , m49] of grid.cells) {
        if (inWindow(lon, lat)) inRegionIds.add(Number(m49));
      }
      colorById = fourColour([...inRegionIds], neighborsByM49, countryHues);
    }

    // Density cells in the window → projected GeoJSON squares. Ring wound
    // SW→NW→NE→SE→SW so d3-geo's spherical fill treats the square as the small
    // interior, not its complement (see the roi note above).
    const cells: CellModel[] = [];
    for (const [lon, lat, pop, m49] of grid.cells) {
      if (!inWindow(lon, lat)) continue;
      const fill = densityAlpha
        ? withAlpha(densityHue, densityAlpha(pop))
        : colorById?.get(Number(m49));
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

    return { width, height, cells, borders, nameById };
  }, [features, grid, bbox, zoom, colorBy, neighborsByM49, countryHues, densityHue]);

  if (!model) {
    return (
      <section className="chart-panel">
        <div className="chart-status">Loading…</div>
      </section>
    );
  }

  const { width, height, cells, borders, nameById } = model;
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
      <svg
        id={id}
        className="story-figure"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Close-up of vector country borders overlapping rastered density cells near ${title}`}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width={width} height={height} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          {/* Water is simply the absence of a cell, so the plate showing through is the coastline
              the grid thinks exists — which is the point of putting it next to the real border. */}
          <rect x="0" y="0" width={width} height={height} fill={PLATE} />
          <g>
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
          {/* Borders in the page's own colour: they read as a cut through the raster rather than
              as a third layer of ink on top of it. */}
          <g fill="none" stroke={BORDER} strokeWidth={1.1} strokeLinejoin="round">
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
