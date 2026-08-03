"use client";

import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import type { Feature, Geometry } from "geojson";
import { showTooltip, hideTooltip } from "../tooltip";
import { fitProjection, insideViewport, type Bbox } from "./basemap";
import { useFigureWidth } from "./useFigureSize";
import type { Admin1Feature, Nuts2Feature, RatePer100kByCountry, RatePer100kByKey } from "../types";

interface SubnationalChoroplethMapProps {
  admin1Features: Admin1Feature[] | null;
  nuts2Features: Nuts2Feature[] | null;
  ratePer100kByKey: RatePer100kByKey | null;
  ratePer100kByCountry: RatePer100kByCountry | null;
  nutsCountries: Set<string> | null;
  nutsIso2ToIso3: Map<string, string> | null;
}

interface DrawnRegion {
  feature: Feature<Geometry>;
  key: string;
  name: string;
  country?: string; // ISO3 (Natural Earth adm0_a3), for the national-rate fallback
}

// High-contrast callouts surfaced by notebooks/data/build-subnational.ipynb — matched by
// (globally-unique) region name across both layers.
const CALLOUTS: { name: string; kind: "high" | "low" }[] = [
  { name: "Akita", kind: "high" },
  { name: "Tokyo", kind: "low" },
  { name: "West Virginia", kind: "high" },
  { name: "Utah", kind: "low" },
  { name: "Telangana", kind: "high" },
  { name: "Rio de Janeiro", kind: "high" },
  { name: "Severozapaden", kind: "high" },
  { name: "Sachsen-Anhalt", kind: "high" },
  { name: "Pskov", kind: "high" },
];

// Seven steps: the same ramp depth the country map uses, so "darker means higher" carries over.
const RAMP_STEPS = 7;

// Fixed literals rather than palette-derived, matching the design. Like the two border close-ups
// this map keeps a dark plate through every sky, so its ramp has to stay in one register instead of
// following the section hue — and a rate ramp needs one hue, not seven harmony members.
const PLATE = "#251f2b";
const GRATICULE = "rgb(231,233,228)";
const RAMP_HI = [240, 72, 152]; // #f04898 — the highest rate
const RAMP_LO = [252, 214, 232]; // #fcd6e8 — the lowest
const RAMP = Array.from({ length: RAMP_STEPS }, (_, k) => {
  const t = k / (RAMP_STEPS - 1);
  return `rgb(${RAMP_HI.map((v, j) => Math.round(v + ((RAMP_LO[j] as number) - v) * t)).join(",")})`;
});

// Japan, Okinawa to Hokkaido. The story's own lead example is Akita against Tokyo, and Japan
// reports every prefecture — so the country that makes the argument is the country on screen.
const BBOX: Bbox = [
  [127, 29],
  [147, 46],
];

// Step 5: a static, fully-vector (SVG) world choropleth of first-level regions colored by their
// real crude death rate. Two geometry layers — Eurostat NUTS-2 across Europe, Natural Earth
// Admin-1 elsewhere (European NE features suppressed so the finer NUTS layer isn't drawn over).
// Where subnational data exists, the spread *inside* a single country is dramatic — the detail
// the single national rate in step 2 flattens away. Grey = country reported only nationally.
export default function SubnationalChoroplethMap({
  admin1Features,
  nuts2Features,
  ratePer100kByKey,
  ratePer100kByCountry,
  nutsCountries,
  nutsIso2ToIso3,
}: SubnationalChoroplethMapProps) {
  const ref = useRef<SVGSVGElement | null>(null);
  const [sizeRef, measured] = useFigureWidth<SVGSVGElement>();
  // Square, at exactly the width the column gave it: the column's own max-width is the bound, so
  // the viewBox always equals the rendered size and nothing is scaled.
  const width = measured;
  const height = width;
  // Shades of the section's own hue, inverted so the highest rate takes the darkest step.

  // The two layers merged into one draw list (European NE features dropped).
  const drawn = useMemo<DrawnRegion[] | null>(() => {
    if (!admin1Features || !nuts2Features || !nutsCountries || !nutsIso2ToIso3) return null;
    const ne = admin1Features
      .filter((f) => !nutsCountries.has(f.properties.adm0_a3))
      .map((f) => ({
        feature: f,
        key: f.properties.adm1_code,
        name: f.properties.name,
        country: f.properties.adm0_a3,
      }));
    // Only NUTS geometries whose country actually appears in the rate data. This drops the
    // UK — its polygons ship in the NUTS file, but Eurostat stopped publishing UK regional
    // rates post-Brexit, so it has no rows and its ISO3 isn't learnable; the UK then falls
    // through to its Natural-Earth features + national rate. Each kept region carries its
    // ISO3 `country` so regions with no rate of their own (e.g. PT Centro/Lisboa/Alentejo,
    // absent from the Eurostat extract) fall back to the national rate instead of going grey.
    const nuts = nuts2Features
      .map((f) => {
        const country = f.properties.CNTR_CODE
          ? nutsIso2ToIso3.get(f.properties.CNTR_CODE)
          : undefined;
        return { feature: f, key: f.properties.NUTS_ID, name: f.properties.NAME_LATN, country };
      })
      .filter((r) => r.country != null);
    return [...ne, ...nuts];
  }, [admin1Features, nuts2Features, nutsCountries, nutsIso2ToIso3]);

  // Sequential scale over both regional and national rates (both are drawn), clamped to
  // the 2nd–98th percentile.
  const domain = useMemo<[number, number]>(() => {
    const rates = [
      ...(ratePer100kByKey?.values() ?? []),
      ...(ratePer100kByCountry?.values() ?? []),
    ].sort(d3.ascending);
    const lo = rates.length ? (d3.quantile(rates, 0.02) ?? rates[0]!) : 0;
    const hi = rates.length ? (d3.quantile(rates, 0.98) ?? rates[rates.length - 1]!) : 1;
    return [lo, hi];
  }, [ratePer100kByKey, ratePer100kByCountry]);

  useEffect(() => {
    if (!ref.current || !drawn || !ratePer100kByKey) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const projection = fitProjection(
      d3.geoAzimuthalEquidistant().rotate([-138, -37]),
      BBOX,
      width,
      height,
      8,
    );
    const path = d3.geoPath(projection);
    // The plate. Like the border close-ups this map is about coverage — where subnational data
    // exists and where it does not — so "no region here" has to be a colour, not the page.
    svg.append("rect").attr("width", width).attr("height", height).attr("fill", PLATE);
    const content = svg.append("g");
    // Quantised into the ramp's seven steps rather than a continuous interpolation: seven shades
    // a reader can count beats a gradient they can only compare two at a time.
    const step = (rate: number) => {
      const t = (rate - domain[0]) / Math.max(1e-6, domain[1] - domain[0]);
      const k = Math.round(Math.min(1, Math.max(0, t)) * (RAMP_STEPS - 1));
      return RAMP[RAMP_STEPS - 1 - k] as string;
    };

    // A region's rate is its own subnational value, falling back to the country's national
    // rate (World Bank) where there's no regional data.
    const rateOf = (d: DrawnRegion): { rate: number | null; national: boolean } => {
      const own = ratePer100kByKey.get(d.key);
      if (own != null) return { rate: own, national: false };
      const nat = d.country ? ratePer100kByCountry?.get(d.country) : undefined;
      return nat != null ? { rate: nat, national: true } : { rate: null, national: false };
    };

    // Only Japanese regions are ever visible in this crop — thousands of Admin-1/NUTS polygons
    // for the rest of the world would otherwise get projected and clipped away for nothing.
    const visibleRegions = drawn.filter((d) => d.country === "JPN");

    // Rasterised onto the same 0.5° lattice the globe samples, as in the design: the rates are
    // real and regional, but they are shown at the resolution the model actually works at, which
    // is the point the surrounding copy is making. A cell takes the rate of whichever region
    // contains its centre; coastal cells whose centre falls just outside every outline take the
    // nearest region's, so the coastline stays solid instead of combing.
    const CELL = 0.5;
    const bounds = visibleRegions.map((d) => ({ d, b: d3.geoBounds(d.feature) }));
    const centroids = visibleRegions.map((d) => d3.geoCentroid(d.feature));
    const cells: { x: number; y: number; w: number; h: number; region: DrawnRegion }[] = [];

    const q = (v: number, f: "floor" | "ceil") => Math[f](v / CELL) * CELL;
    const [[lon0, lat0], [lon1, lat1]] = BBOX;
    for (let lon = q(lon0, "floor"); lon < q(lon1, "ceil"); lon += CELL) {
      for (let lat = q(lat0, "floor"); lat < q(lat1, "ceil"); lat += CELL) {
        const tl = projection([lon, lat + CELL]);
        const br = projection([lon + CELL, lat]);
        if (!tl || !br || !isFinite(tl[0]) || !isFinite(br[0])) continue;
        const cw = Math.abs(br[0] - tl[0]);
        const ch = Math.abs(br[1] - tl[1]);
        const cx = Math.min(tl[0], br[0]);
        const cy = Math.min(tl[1], br[1]);
        if (cx + cw < 0 || cx > width || cy + ch < 0 || cy > height) continue;

        const centre: [number, number] = [lon + CELL / 2, lat + CELL / 2];
        // Bounding box first: geoContains against every prefecture for every cell is the one
        // thing here expensive enough to notice.
        let hit = bounds.find(
          ({ d, b }) =>
            centre[0] >= b[0][0] - CELL &&
            centre[0] <= b[1][0] + CELL &&
            centre[1] >= b[0][1] - CELL &&
            centre[1] <= b[1][1] + CELL &&
            d3.geoContains(d.feature, centre),
        )?.d;

        if (!hit) {
          // Nearest region, but only close enough to be this coastline rather than the mainland
          // across the sea — otherwise the ocean fills in.
          let best = Infinity;
          let near: DrawnRegion | undefined;
          centroids.forEach((c, i) => {
            const dist = d3.geoDistance(c, centre);
            if (dist < best) {
              best = dist;
              near = visibleRegions[i];
            }
          });
          if (near && best < 0.02) hit = near;
        }
        if (!hit) continue;

        // Snapped to whole pixels so neighbouring cells butt up with no hairline between them.
        const x0 = Math.round(cx);
        const y0 = Math.round(cy);
        cells.push({
          x: x0,
          y: y0,
          w: Math.max(1, Math.round(cx + cw) - x0),
          h: Math.max(1, Math.round(cy + ch) - y0),
          region: hit,
        });
      }
    }

    content
      .append("g")
      .attr("class", "map-region-cells")
      .selectAll("rect")
      .data(cells)
      .join("rect")
      .attr("x", (c) => c.x)
      .attr("y", (c) => c.y)
      .attr("width", (c) => c.w)
      .attr("height", (c) => c.h)
      .attr("fill", (c) => {
        const { rate } = rateOf(c.region);
        return rate != null ? step(rate) : PLATE;
      })
      .on("pointermove", (event, c) => {
        const { rate, national } = rateOf(c.region);
        const label =
          rate == null
            ? `${c.region.name}: no data`
            : national
              ? `${c.region.name} — national rate: ${Math.round(rate)} deaths / 100k/yr`
              : `${c.region.name}: ${Math.round(rate)} deaths / 100k/yr`;
        showTooltip(label, event.clientX, event.clientY);
      })
      .on("pointerleave", hideTooltip);

    // Callout leader dots (no labels — the region name/rate shows via hover instead),
    // kept only where they land inside this crop (West Virginia, Utah).
    const byName = new Map(drawn.map((r) => [r.name, r]));
    const callouts = CALLOUTS.map((c) => {
      const region = byName.get(c.name);
      const xy = region ? projection(d3.geoCentroid(region.feature)) : null;
      const rate = region ? ratePer100kByKey.get(region.key) : null;
      return xy && insideViewport(xy, width, height) && rate != null
        ? { ...c, x: xy[0], y: xy[1] }
        : null;
    }).filter((c): c is NonNullable<typeof c> => c !== null);

    content
      .append("g")
      .attr("class", "map-callouts")
      .selectAll("circle")
      .data(callouts)
      .join("circle")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", 2.6)
      .attr("fill", (d) => (d.kind === "high" ? "#ffffff" : PLATE))
      .attr("stroke", (d) => (d.kind === "high" ? PLATE : "#ffffff"))
      .attr("stroke-width", 0.75);

    // A 5° graticule, finer than the world maps use, because at this zoom a 10° grid would put
    // two lines on the whole picture.
    svg
      .append("path")
      .attr("d", path(d3.geoGraticule().step([5, 5])()) ?? "")
      .attr("fill", "none")
      .attr("stroke", GRATICULE)
      .attr("stroke-width", 1.1)
      .attr("opacity", 0.55);
  }, [drawn, ratePer100kByKey, ratePer100kByCountry, domain, width, height]);

  const loading = !drawn || !ratePer100kByKey;

  return (
    <section className="chart-panel wide">
      <svg
        ref={(node) => {
          ref.current = node;
          sizeRef(node);
        }}
        id="subnational-choropleth-chart"
        className="story-figure"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Map of Japan's prefectures shaded by crude death rate, showing large differences within one country"
      />
      {!loading && (
        <div className="choropleth-legend" aria-hidden="true">
          <span>{Math.round(domain[0])}</span>
          <span className="choropleth-legend-bar">
            {[...RAMP].reverse().map((c) => (
              <span key={c} style={{ background: c }} />
            ))}
          </span>
          <span>{Math.round(domain[1])}+ per 100k</span>
        </div>
      )}
      {loading && (
        <p className="chart-status" aria-live="polite">
          Loading subnational death rates…
        </p>
      )}
    </section>
  );
}
