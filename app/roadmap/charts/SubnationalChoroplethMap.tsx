"use client";

import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import type { Feature, Geometry } from "geojson";
import { MAP_GRATICULE } from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
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
// (globally-unique) region name across both layers. `label` overrides crowded names.
const CALLOUTS: { name: string; kind: "high" | "low"; label?: string }[] = [
  { name: "Akita", kind: "high" },
  { name: "Tokyo", kind: "low" },
  { name: "West Virginia", kind: "high" },
  { name: "Utah", kind: "low" },
  { name: "Telangana", kind: "high" },
  { name: "Rio de Janeiro", kind: "high" },
  { name: "Severozapaden", kind: "high", label: "NW Bulgaria" },
  { name: "Sachsen-Anhalt", kind: "high", label: "Sachsen-Anhalt (DE)" },
  { name: "Pskov", kind: "high" },
];

const WIDTH = 860;
const HEIGHT = 430;
const NO_DATA = "#e7e8ec";

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

    const projection = d3.geoEquirectangular().fitExtent(
      [
        [6, 6],
        [WIDTH - 6, HEIGHT - 6],
      ],
      { type: "Sphere" },
    );
    const path = d3.geoPath(projection);
    const color = d3.scaleSequential(d3.interpolateYlOrRd).domain(domain);

    // A region's rate is its own subnational value, falling back to the country's national
    // rate (World Bank) where there's no regional data.
    const rateOf = (d: DrawnRegion): { rate: number | null; national: boolean } => {
      const own = ratePer100kByKey.get(d.key);
      if (own != null) return { rate: own, national: false };
      const nat = d.country ? ratePer100kByCountry?.get(d.country) : undefined;
      return nat != null ? { rate: nat, national: true } : { rate: null, national: false };
    };

    svg
      .append("path")
      .datum<d3.GeoSphere>({ type: "Sphere" })
      .attr("d", path)
      .attr("fill", "rgba(15,15,30,0.02)")
      .attr("stroke", "rgba(15,15,30,0.12)");

    // One <path> per region — exact SVG hit-testing (no pick-canvas antialiasing that could
    // report the wrong region on hover).
    svg
      .append("g")
      .selectAll("path")
      .data(drawn)
      .join("path")
      .attr("class", "map-region")
      .attr("d", (d) => path(d.feature))
      .attr("fill", (d) => {
        const { rate } = rateOf(d);
        return rate != null ? color(rate) : NO_DATA;
      })
      .on("pointermove", (event, d) => {
        const { rate, national } = rateOf(d);
        const label =
          rate == null
            ? `${d.name}: no data`
            : national
              ? `${d.name} — national rate: ${Math.round(rate)} deaths / 100k/yr`
              : `${d.name}: ${Math.round(rate)} deaths / 100k/yr`;
        showTooltip(label, event.clientX, event.clientY);
      })
      .on("pointerleave", hideTooltip);

    svg.append("path").datum(MAP_GRATICULE).attr("class", "map-graticule").attr("d", path);

    // Callout leader dots + labels.
    const byName = new Map(drawn.map((r) => [r.name, r]));
    const callouts = CALLOUTS.map((c) => {
      const region = byName.get(c.name);
      const xy = region ? projection(d3.geoCentroid(region.feature)) : null;
      const rate = region ? ratePer100kByKey.get(region.key) : null;
      return xy && rate != null ? { ...c, x: xy[0], y: xy[1], rate } : null;
    }).filter((c): c is NonNullable<typeof c> => c !== null);

    const g = svg.append("g").attr("class", "map-callouts");
    g.selectAll("circle")
      .data(callouts)
      .join("circle")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", 2.6)
      .attr("fill", (d) => (d.kind === "high" ? "#ff3b30" : "#2f4bff"))
      .attr("stroke", "rgba(0,0,0,0.5)")
      .attr("stroke-width", 0.75);
    g.selectAll("text")
      .data(callouts)
      .join("text")
      .attr("class", "map-callout-label")
      .attr("x", (d) => (d.x < WIDTH - 130 ? d.x + 6 : d.x - 6))
      .attr("y", (d) => d.y)
      .attr("text-anchor", (d) => (d.x < WIDTH - 130 ? "start" : "end"))
      .text((d) => `${d.label ?? d.name} ${Math.round(d.rate)}`);
  }, [drawn, ratePer100kByKey, ratePer100kByCountry, domain]);

  const loading = !drawn || !ratePer100kByKey;

  return (
    <section className="chart-panel wide map-panel">
      <p className="chart-copy">
        Every first-level region colored by its own crude death rate. Inside a single country the
        spread is dramatic — Russia&apos;s is the widest of all, Pskov running over 5× Ingushetia;
        rural Akita nearly 2× Tokyo, West Virginia well above Utah, north-west Bulgaria far above
        Ireland. Countries without regional data (China, most of Africa) are shaded a flat national
        rate instead.
      </p>
      <svg
        ref={ref}
        id="subnational-choropleth-chart"
        className="seasonality-chart"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="World map of first-level regions shaded by crude death rate, showing large differences within countries"
      />
      {!loading && (
        <div className="choropleth-legend" aria-hidden="true">
          <span>{Math.round(domain[0])}</span>
          <span className="choropleth-legend-bar" />
          <span>{Math.round(domain[1])}+ deaths / 100k/yr</span>
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
