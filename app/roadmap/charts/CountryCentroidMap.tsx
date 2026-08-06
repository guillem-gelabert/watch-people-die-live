"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { expGap } from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import { fitProjection, GRATICULE_WIDTH, insideViewport, type Bbox } from "./basemap";
import { useFigureWidth } from "./useFigureSize";
import type { CountryFeature, DeathsPerYearById } from "../types";

interface Dart {
  id: number;
  x: number;
  y: number;
  bearing: number;
  born: number;
}

interface CountryEntry {
  name: string;
  deathsPerYear: number;
  xy: [number, number] | null;
  visible: boolean;
}

interface CountryCentroidMapProps {
  features: CountryFeature[] | null;
  deathsPerYearById: DeathsPerYearById | null;
}

const LIFE_MS = 20800;
const CROSSHAIR = 10;
const DART = "#e86d83";
// Seven steps is as many shades of one hue as read apart at this size.
const RAMP_STEPS = 7;

// Fixed literals rather than palette-derived, matching the design. This map ranks countries, and a
// ranking reads as one ramp; a per-section harmony would hand it seven unrelated hues and turn the
// ordering into a categorical map. The ocean is the same salmon the darts land in.
const OCEAN = "#e86d83";
const RAMP_HI = [222, 191, 43]; // #debf2b — the highest rate
const RAMP_LO = [242, 231, 175]; // #f2e7af — the lowest
const RAMP = Array.from({ length: RAMP_STEPS }, (_, k) => {
  const t = k / (RAMP_STEPS - 1);
  return `rgb(${RAMP_HI.map((v, j) => Math.round(v + ((RAMP_LO[j] as number) - v) * t)).join(",")})`;
});

// One spawn every ~1/6 s among the countries in frame. The globe's own clock is the real one, but
// Europe is a few per cent of global mortality: sampled at the true rate this panel would sit empty
// for most of a scroll, which is the one thing it cannot afford to do.
const MEAN_GAP_MS = 1000 / 6;

// Spain to Moscow, Sicily to the Arctic circle: enough countries in one frame that the ramp has
// something to say, and small enough that each one is still a shape you can recognise.
const BBOX: Bbox = [
  [-11, 35],
  [40, 59],
];

// The country layer: every death now fires at its own country's real annual rate, but lands on
// that country's centroid — the right count in the wrong place. Countries are shaded by rate
// across the frame, so the reader can see the rate the darts are obeying.
export default function CountryCentroidMap({
  features,
  deathsPerYearById,
}: CountryCentroidMapProps) {
  const ref = useRef<SVGSVGElement | null>(null);
  const [sizeRef, measured] = useFigureWidth<SVGSVGElement>();
  // Square, at exactly the width the column gave it: the column's own max-width is the bound, so
  // the viewBox always equals the rendered size and nothing is scaled.
  const width = measured;
  const height = width;

  useEffect(() => {
    if (!ref.current || !features || !deathsPerYearById || !deathsPerYearById.size) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const projection = fitProjection(
      d3.geoAzimuthalEquidistant().rotate([-14, -47]),
      BBOX,
      width,
      height,
      6,
    );
    const path = d3.geoPath(projection);

    const entries: CountryEntry[] = features.map((feature) => {
      const deathsPerYear = deathsPerYearById.get(Number(feature.id)) ?? 0;
      const xy = projection(d3.geoCentroid(feature));
      return {
        name: feature.properties?.name ?? "Unknown",
        deathsPerYear,
        xy,
        visible: insideViewport(xy, width, height),
      };
    });

    // Binned by rank among the countries actually on screen, not by raw value: a handful of very
    // large countries would otherwise take the whole ramp and leave the rest one flat shade.
    const onScreen = features.filter((_, i) => entries[i]?.visible);
    const ranked = onScreen
      .map((f) => ({ f, deaths: deathsPerYearById.get(Number(f.id)) ?? 0 }))
      .filter((r) => r.deaths > 0)
      .sort((a, b) => a.deaths - b.deaths);
    const binByFeature = new Map<CountryFeature, number>();
    ranked.forEach((r, i) => {
      const q = ranked.length > 1 ? i / (ranked.length - 1) : 1;
      binByFeature.set(
        r.f,
        Math.max(0, Math.min(RAMP_STEPS - 1, Math.round((1 - q) * (RAMP_STEPS - 1)))),
      );
    });

    // The ocean, so a country with no rate is still visibly land rather than page.
    svg.append("rect").attr("width", width).attr("height", height).attr("fill", OCEAN);

    const plate = svg.append("g");
    for (const feature of features) {
      const bin = binByFeature.get(feature);
      plate
        .append("path")
        .attr("d", path(feature) ?? "")
        // No rate: the lightest step, which is where the ramp's own low end already sits.
        .attr("fill", bin == null ? (RAMP[RAMP_STEPS - 1] as string) : (RAMP[bin] as string))
        .attr("stroke", "none");
    }
    svg
      .append("path")
      .attr("d", path(d3.geoGraticule().step([10, 10])()) ?? "")
      .attr("class", "map-graticule")
      .attr("fill", "none")
      .attr("stroke-width", GRATICULE_WIDTH);

    // Only the countries actually in frame are candidates. Picking from the whole world and then
    // discarding everything off-screen throws away ~19 of every 20 draws, which is what left this
    // panel looking empty; the weighting between the countries you can see is unchanged.
    const visible = entries.filter((e) => e.deathsPerYear > 0 && e.visible && e.xy);
    const total = d3.sum(visible, (e) => e.deathsPerYear);
    if (!visible.length || !(total > 0)) return;

    function pickCountry(): CountryEntry {
      let r = Math.random() * total;
      for (const c of visible) {
        r -= c.deathsPerYear;
        if (r < 0) return c;
      }
      return visible[visible.length - 1]!;
    }

    const bearingAt = (xy: [number, number]) => {
      const lonLat = projection.invert?.(xy);
      if (!lonLat) return 0;
      const north = projection([lonLat[0], Math.min(90, lonLat[1] + 0.5)]);
      if (!north) return 0;
      return (Math.atan2(north[0] - xy[0], xy[1] - north[1]) * 180) / Math.PI;
    };

    const dartsG = svg.append("g").attr("class", "dart-marks");
    const darts: Dart[] = [];
    let nextId = 0;
    let nextAt = performance.now() + expGap(MEAN_GAP_MS);
    let rafId = 0;
    let cancelled = false;

    function frame(now: number) {
      if (cancelled) return;
      while (now >= nextAt) {
        const c = pickCountry();
        darts.push({
          id: nextId++,
          x: c.xy![0],
          y: c.xy![1],
          bearing: bearingAt(c.xy!),
          born: nextAt,
        });
        nextAt += expGap(MEAN_GAP_MS);
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
        const hit = lonLat ? features.find((f) => d3.geoContains(f, lonLat)) : undefined;
        if (!hit) {
          hideTooltip();
          return;
        }
        const deathsPerYear = deathsPerYearById.get(Number(hit.id));
        const label = deathsPerYear
          ? `${hit.properties?.name ?? "Unknown"}: ${Math.round(deathsPerYear).toLocaleString()} deaths/yr`
          : `${hit.properties?.name ?? "Unknown"}: no rate data`;
        showTooltip(label, event.clientX, event.clientY);
      })
      .on("pointerleave", hideTooltip);

    rafId = requestAnimationFrame(frame);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [features, deathsPerYearById, width, height]);

  return (
    <section className="chart-panel wide">
      <svg
        ref={(node) => {
          ref.current = node;
          sizeRef(node);
        }}
        id="country-centroid-map-chart"
        className="story-figure"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Europe shaded by death rate, with every death landing on its country's geographic centre"
      />
    </section>
  );
}
