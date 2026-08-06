"use client";

import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import { expGap, randomPointOnSphere, REAL_MEAN_GAP_MS } from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import { fitProjection, GRATICULE_WIDTH, insideViewport, type Bbox } from "./basemap";
import { buildLandMask, buildPopulatedMask, classify, convergenceShares } from "./dartField";
import { bumpDart, setDartLimits } from "./dartTallyState";
import { useFigureWidth } from "./useFigureSize";
import { useSkin } from "../SkinContext";
import { useDict } from "../I18nContext";
import type { CountryFeature, DensityGrid } from "../types";

interface Dart {
  id: number;
  x: number;
  y: number;
  // Bearing of local north at the landing point, in degrees — the crosshair is squared to the
  // graticule rather than to the screen, so it reads as a point on a globe.
  bearing: number;
  born: number;
}

interface GlobalRandomMapProps {
  features: CountryFeature[] | null;
  grid: DensityGrid | null;
}

// A dart stays legible for a long time and fades as k², so the figure builds up a scatter
// instead of showing one blip at a time.
const LIFE_MS = 20800;
const CROSSHAIR = 10;
const OCEAN = "#6dc0e8";
const DART = "#6de895";

// South America and the Pacific it sits in: an ocean wide enough that the answer to "where do
// random points land" is visible without counting, and a coastline to measure it against.
const BBOX: Bbox = [
  [-124, -34],
  [-62, -2],
];

// The first spatial model: a death lands anywhere on Earth with equal probability. Land is the
// page itself and only the ocean is inked, so every dart that misses is a dart you can see
// missing. Each mark is also counted by the tally below (see dartTallyState).
export default function GlobalRandomMap({ features, grid }: GlobalRandomMapProps) {
  const t = useDict().charts.globalRandomMap;
  const { sky } = useSkin();
  const ref = useRef<SVGSVGElement | null>(null);
  const [sizeRef, measured] = useFigureWidth<SVGSVGElement>();
  // Square, at exactly the width the column gave it: the column's own max-width is the bound, so
  // the viewBox always equals the rendered size and nothing is scaled.
  const width = measured;
  const height = width;

  // Only the land follows the palette — it is painted in the page's own colour so it disappears
  // into it, leaving the ocean as the only thing inked. The water and the marks stay literal:
  // water that isn't blue stops reading as water, and a dart has to sit clearly on top of both.
  const land = `rgb(${sky.join(",")})`;

  const masks = useMemo(() => {
    if (!features || !grid) return null;
    const landMask = buildLandMask(features);
    if (!landMask) return null;
    return { land: landMask, populated: buildPopulatedMask(grid) };
  }, [features, grid]);

  // One pass over 20 000 area-correct samples, published once so the tally can show what each
  // running count is heading for.
  useEffect(() => {
    if (!masks) return;
    setDartLimits(convergenceShares(masks.land, masks.populated));
  }, [masks]);

  useEffect(() => {
    if (!ref.current || !features) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const projection = fitProjection(
      d3.geoConicEqualArea().parallels([-10, -28]).rotate([92, 0]).center([0, -18]),
      BBOX,
      width,
      height,
      22,
    );
    const path = d3.geoPath(projection);

    // The plate: ocean, then land in the page's own colour, then a graticule that only shows
    // over water. Nothing here is a photograph — the figure is about position, not terrain.
    svg
      .append("path")
      .attr("d", path({ type: "Sphere" }) ?? "")
      .attr("fill", OCEAN);
    const landG = svg.append("g");
    for (const f of features) {
      landG
        .append("path")
        .attr("d", path(f) ?? "")
        .attr("fill", land)
        .attr("stroke", "none");
    }
    svg
      .append("path")
      .attr("d", path(d3.geoGraticule().step([10, 10])()) ?? "")
      .attr("class", "map-graticule")
      .attr("fill", "none")
      .attr("stroke-width", GRATICULE_WIDTH);

    const dartsG = svg.append("g").attr("class", "dart-marks");
    const darts: Dart[] = [];
    let nextId = 0;
    let nextAt = performance.now() + expGap(REAL_MEAN_GAP_MS);
    let rafId = 0;
    let cancelled = false;

    const bearingAt = (lon: number, lat: number, xy: [number, number]) => {
      const north = projection([lon, Math.min(90, lat + 0.5)]);
      if (!north) return 0;
      return (Math.atan2(north[0] - xy[0], xy[1] - north[1]) * 180) / Math.PI;
    };

    function frame(now: number) {
      if (cancelled) return;
      // Darts spawn at the real global rate over the whole sphere. Every one is counted; only
      // the ones inside this crop are drawn, so the visible slice shows the true rate for its
      // own share of the planet rather than an inflated one.
      while (now >= nextAt) {
        const [lon, lat] = randomPointOnSphere();
        if (masks) bumpDart(classify(lon, lat, masks.land, masks.populated));
        const xy = projection([lon, lat]);
        if (insideViewport(xy, width, height)) {
          darts.push({
            id: nextId++,
            x: xy[0],
            y: xy[1],
            bearing: bearingAt(lon, lat, xy),
            born: nextAt,
          });
        }
        nextAt += expGap(REAL_MEAN_GAP_MS);
      }
      for (let i = darts.length - 1; i >= 0; i -= 1) {
        if (now - darts[i]!.born >= LIFE_MS) darts.splice(i, 1);
      }

      dartsG
        .selectAll<SVGGElement, Dart>("g")
        .data(darts, (d) => d.id)
        .join((enter) => {
          const g = enter.append("g");
          g.append("line").attr("x1", -CROSSHAIR).attr("x2", CROSSHAIR).attr("y1", 0).attr("y2", 0);
          g.append("line").attr("x1", 0).attr("x2", 0).attr("y1", -CROSSHAIR).attr("y2", CROSSHAIR);
          g.append("circle").attr("r", 2.1);
          return g;
        })
        .attr("transform", (d) => `translate(${d.x},${d.y}) rotate(${d.bearing})`)
        .attr("opacity", (d) => {
          const k = Math.max(0, 1 - (now - d.born) / LIFE_MS);
          return k * k;
        })
        .call((g) => {
          g.selectAll("line").attr("stroke", "#ffffff").attr("stroke-width", 1.1);
          g.selectAll("circle").attr("fill", DART);
        });
      rafId = requestAnimationFrame(frame);
    }

    svg
      .append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "transparent")
      .on("pointermove", (event) => {
        const [x, y] = d3.pointer(event, ref.current);
        const lonLat = projection.invert?.([x, y]);
        if (!lonLat) {
          hideTooltip();
          return;
        }
        const hit = features.find((f) => d3.geoContains(f, lonLat));
        const label = hit
          ? (hit.properties?.name ?? "Unknown")
          : `${lonLat[1].toFixed(1)}°, ${lonLat[0].toFixed(1)}°`;
        showTooltip(label, event.clientX, event.clientY);
      })
      .on("pointerleave", hideTooltip);

    rafId = requestAnimationFrame(frame);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [features, masks, land, width, height]);

  return (
    <section className="chart-panel wide">
      <svg
        ref={(node) => {
          ref.current = node;
          sizeRef(node);
        }}
        id="global-random-map-chart"
        className="story-figure"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={t.aria}
      />
    </section>
  );
}
