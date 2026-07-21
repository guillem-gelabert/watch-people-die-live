"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import * as d3 from "d3";
import {
  MONTHS,
  COUNTRY_CURVE_PICKS,
  EXTRA_CURVE_COLORS,
  KG_FAMILIES,
  MAX_COMPARE_COUNTRIES,
  styleAxis,
} from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import type { CountryFeature, SeasonalityData, SeasonalityProxies } from "../types";

interface Series {
  id: number;
  name: string;
  color: string;
  curve: number[]; // phase-aligned (southern hemisphere shifted 6 months)
  shift: number; // months the calendar curve was rotated, for true-month tooltips
}

interface CountryCurvesProps {
  seasonality: SeasonalityData | null;
  features: CountryFeature[] | null;
  proxies: SeasonalityProxies | null;
}

// A combobox option: either a single country or a category that bulk-adds its member countries.
interface Option {
  optionKey: string;
  kind: "country" | "category";
  group: string; // "Climate" | "GDP" | "Latitude" for categories, "" for countries
  label: string;
  ids: number[];
}

const COLOR_POOL = [...COUNTRY_CURVE_PICKS.map((d) => d.color), ...EXTRA_CURVE_COLORS];
const DEFAULT_NAME_BY_ID = new Map(COUNTRY_CURVE_PICKS.map((d) => [d.id, d.name]));
const SWITZERLAND_ID = 756;
const SWITZERLAND_COLOR =
  COUNTRY_CURVE_PICKS.find((d) => d.id === SWITZERLAND_ID)?.color ?? COLOR_POOL[0]!;

// City-states with a measured curve but absent from the world-atlas 110m topology (folded into
// their surrounding country at that resolution), so `nameById` can't name them — they'd otherwise
// render as their bare M49 code (344, 702). No proxy/centroid either, so they never enter the
// climate/GDP/latitude categories; they remain individually addable.
const M49_NAME_FALLBACK = new Map<number, string>([
  [344, "Hong Kong SAR"],
  [702, "Singapore"],
]);

// GDP-per-capita bins (current USD) and absolute-latitude bins, chosen to spread the measured
// countries across non-trivial groups; empty bins are dropped before display.
const GDP_BINS = [
  { key: "gdp-0", label: "GDP < $10k", lo: -Infinity, hi: 10_000 },
  { key: "gdp-1", label: "GDP $10k–$30k", lo: 10_000, hi: 30_000 },
  { key: "gdp-2", label: "GDP $30k–$50k", lo: 30_000, hi: 50_000 },
  { key: "gdp-3", label: "GDP > $50k", lo: 50_000, hi: Infinity },
];
const LAT_BINS = [
  { key: "lat-0", label: "Tropics (0–23.5°)", lo: 0, hi: 23.5 },
  { key: "lat-1", label: "Subtropics (23.5–35°)", lo: 23.5, hi: 35 },
  { key: "lat-2", label: "Temperate (35–50°)", lo: 35, hi: 50 },
  { key: "lat-3", label: "High latitude (50°+)", lo: 50, hi: Infinity },
];

// Chart 3: multi-line seasonal mortality curves, comparable across any country with a
// directly-measured curve (no latitude-fallback countries — those never appear in
// `seasonality.countries`). Starts on Switzerland alone; categories bulk-add measured countries
// by climate zone, GDP bin, or latitude bin, up to the colour-pool cap.
export default function CountryCurves({ seasonality, features, proxies }: CountryCurvesProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [selectedIds, setSelectedIds] = useState<number[]>([SWITZERLAND_ID]);
  const [colorById, setColorById] = useState<Map<number, string>>(
    () => new Map([[SWITZERLAND_ID, SWITZERLAND_COLOR]]),
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [status, setStatus] = useState<string | null>(null);

  const nameById = useMemo(
    () => new Map((features ?? []).map((f) => [Number(f.id), f.properties?.name ?? "Unknown"])),
    [features],
  );
  const resolveName = (id: number) =>
    DEFAULT_NAME_BY_ID.get(id) ?? nameById.get(id) ?? M49_NAME_FALLBACK.get(id) ?? String(id);

  // Signed centroid latitude per country, for hemisphere phase alignment: southern-hemisphere
  // curves are shifted six months so their winter lines up with the northern winter — the same
  // northern-canonical re-phasing the estimator uses (lib/spatial-seasonality.ts). Countries with
  // no 110m feature (Hong Kong, Singapore) are northern, so the 0 default is correct.
  const signedLatById = useMemo(
    () => new Map((features ?? []).map((f) => [Number(f.id), d3.geoCentroid(f)[1]])),
    [features],
  );

  // Every country with a direct measured curve — fallback-only countries never appear
  // in `seasonality.countries`, so no extra filtering is needed to exclude them.
  const availableCountries = useMemo(() => {
    if (!seasonality) return [];
    return Object.keys(seasonality.countries)
      .map(Number)
      .map((id) => ({ id, name: resolveName(id) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonality, nameById]);

  // Categories that bulk-add measured countries. Built from proxies (climate family, GDP) and
  // feature centroids (absolute latitude); only non-empty groups are kept.
  const categories = useMemo<Option[]>(() => {
    if (!seasonality) return [];
    const curveIds = Object.keys(seasonality.countries).map(Number);
    const out: Option[] = [];

    if (proxies) {
      for (const fam of KG_FAMILIES) {
        const ids = curveIds.filter((id) => proxies.byM49[id]?.kgFamily === fam.key);
        if (ids.length) {
          out.push({
            optionKey: `climate-${fam.key}`,
            kind: "category",
            group: "Climate",
            label: fam.name,
            ids,
          });
        }
      }
      for (const bin of GDP_BINS) {
        const ids = curveIds.filter((id) => {
          const g = proxies.byM49[id]?.gdpPerCapita;
          return g != null && g >= bin.lo && g < bin.hi;
        });
        if (ids.length) {
          out.push({ optionKey: bin.key, kind: "category", group: "GDP", label: bin.label, ids });
        }
      }
    }

    for (const bin of LAT_BINS) {
      const ids = curveIds.filter((id) => {
        const lat = signedLatById.get(id);
        return lat != null && Math.abs(lat) >= bin.lo && Math.abs(lat) < bin.hi;
      });
      if (ids.length) {
        out.push({
          optionKey: bin.key,
          kind: "category",
          group: "Latitude",
          label: bin.label,
          ids,
        });
      }
    }
    return out;
  }, [seasonality, proxies, signedLatById]);

  // Listbox contents: matching categories first, then matching not-yet-selected countries.
  const matches = useMemo<Option[]>(() => {
    const q = query.trim().toLowerCase();
    const selected = new Set(selectedIds);
    const cats = categories.filter(
      (c) => q === "" || c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q),
    );
    const countries: Option[] = availableCountries
      .filter((c) => !selected.has(c.id) && (q === "" || c.name.toLowerCase().includes(q)))
      .map((c) => ({
        optionKey: `c-${c.id}`,
        kind: "country",
        group: "",
        label: c.name,
        ids: [c.id],
      }));
    return [...cats, ...countries];
  }, [categories, availableCountries, selectedIds, query]);

  const atCap = selectedIds.length >= MAX_COMPARE_COUNTRIES;

  // Adds as many of `ids` as fit under the colour-pool cap; reports how many were dropped.
  function addCountries(ids: number[]) {
    const used = new Set(colorById.values());
    const nextSelected = [...selectedIds];
    const nextColors = new Map(colorById);
    let added = 0;
    let requested = 0;
    for (const id of ids) {
      if (nextColors.has(id)) continue; // already selected
      requested += 1;
      if (nextSelected.length >= MAX_COMPARE_COUNTRIES) continue;
      const color = COLOR_POOL.find((c) => !used.has(c));
      if (!color) continue;
      used.add(color);
      nextSelected.push(id);
      nextColors.set(id, color);
      added += 1;
    }
    if (added) {
      setSelectedIds(nextSelected);
      setColorById(nextColors);
    }
    const dropped = requested - added;
    setStatus(
      dropped > 0
        ? `Added ${added} — reached the ${MAX_COMPARE_COUNTRIES}-line limit (${dropped} not shown)`
        : null,
    );
    setQuery("");
    setActiveIndex(0);
  }

  function removeCountry(id: number) {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    setColorById((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    setStatus(null);
  }

  function clearAll() {
    setSelectedIds([]);
    setColorById(new Map());
    setStatus(null);
    setQuery("");
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, Math.max(matches.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const match = matches[activeIndex];
      if (match) addCountries(match.ids);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const selectedNames = useMemo(
    () => selectedIds.map((id) => resolveName(id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedIds, availableCountries, nameById],
  );

  useEffect(() => {
    if (!seasonality || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 700;
    const height = 280;
    const margin = { top: 16, right: 18, bottom: 38, left: 48 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const series: Series[] = selectedIds
      .map((id): Series | null => {
        const curve = seasonality.countries[String(id)];
        const color = colorById.get(id);
        if (!curve || !color) return null;
        const shift = (signedLatById.get(id) ?? 0) < 0 ? 6 : 0;
        const aligned = shift ? curve.map((_, m) => curve[(m + shift) % curve.length]!) : curve;
        return { id, name: resolveName(id), color, curve: aligned, shift };
      })
      .filter((d): d is Series => d !== null);
    if (!series.length) return;

    // Curves are seasonal multipliers (mean 1): >1 fires faster than the annual
    // average, <1 slower. Shown as the raw factor, not a percentage deviation.
    const fmtFactor = d3.format(".2f");

    const x = d3.scalePoint().domain(MONTHS).range([0, innerW]).padding(0.35);
    const y = d3
      .scaleLinear()
      .domain(d3.extent(series.flatMap((d) => d.curve)) as [number, number])
      .nice()
      .range([innerH, 0]);
    const line = d3
      .line<number>()
      .x((_, i) => x(MONTHS[i]!) ?? 0)
      .y((d) => y(d))
      .curve(d3.curveMonotoneX);
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("line")
      .attr("class", "chart-gridline")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", y(1))
      .attr("y2", y(1));
    g.selectAll("path.country-curve")
      .data(series, (d) => (d as Series).id)
      .join("path")
      .attr("class", "country-curve")
      .attr("fill", "none")
      .attr("stroke", (d) => d.color)
      .attr("stroke-width", 2.2)
      .attr("d", (d) => line(d.curve))
      .style("cursor", "pointer")
      .on("pointermove", (event, d) => {
        // Nearest month under the pointer for this series.
        const [px] = d3.pointer(event, g.node());
        let i = 0;
        let best = Infinity;
        for (let j = 0; j < MONTHS.length; j++) {
          const dist = Math.abs((x(MONTHS[j]!) ?? 0) - px);
          if (dist < best) {
            best = dist;
            i = j;
          }
        }
        // Report the country's true calendar month, not the aligned x position.
        const trueMonth = MONTHS[(i + d.shift) % MONTHS.length];
        showTooltip(
          `${d.name}, ${trueMonth}: ${fmtFactor(d.curve[i]!)}×`,
          event.clientX,
          event.clientY,
        );
      })
      .on("pointerleave", hideTooltip);
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickSizeOuter(0))
      .call(styleAxis);
    g.append("g")
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickFormat((d) => fmtFactor(Number(d))),
      )
      .call(styleAxis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonality, selectedIds, colorById, nameById, signedLatById]);

  return (
    <section className="chart-panel wide">
      <h4 className="chart-title">A Cluster Of Similar Curves</h4>

      <div className="cc-combobox">
        <label className="cc-label" htmlFor="country-compare-input">
          Compare countries
        </label>
        <input
          ref={inputRef}
          id="country-compare-input"
          className="cc-input"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="country-compare-listbox"
          aria-autocomplete="list"
          aria-activedescendant={
            open && matches[activeIndex]
              ? `country-compare-option-${matches[activeIndex].optionKey}`
              : undefined
          }
          placeholder={
            atCap
              ? `Comparing ${MAX_COMPARE_COUNTRIES} — remove one to add another`
              : "Add a country or category…"
          }
          value={query}
          disabled={atCap}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onInputKeyDown}
        />
        {open && !atCap && (
          <ul id="country-compare-listbox" className="cc-listbox" role="listbox">
            {matches.length === 0 && <li className="cc-empty">No matches</li>}
            {matches.map((opt, i) => (
              <li
                key={opt.optionKey}
                id={`country-compare-option-${opt.optionKey}`}
                role="option"
                aria-selected={i === activeIndex}
                className={`cc-option${i === activeIndex ? " active" : ""}${opt.kind === "category" ? " cc-option-cat" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => addCountries(opt.ids)}
              >
                {opt.kind === "category" ? (
                  <>
                    <span className="cc-cat-tag">{opt.group}</span>
                    {opt.label}
                    <span className="cc-cat-count">{opt.ids.length}</span>
                  </>
                ) : (
                  opt.label
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="cc-chips" aria-label="Selected countries">
        {selectedIds.map((id, i) => (
          <span className="cc-chip" key={id}>
            <span className="swatch" style={{ color: colorById.get(id) }} />
            {selectedNames[i]}
            <button
              type="button"
              className="cc-chip-remove"
              aria-label={`Remove ${selectedNames[i]}`}
              onClick={() => removeCountry(id)}
            >
              ✕
            </button>
          </span>
        ))}
        {selectedIds.length > 0 && (
          <button type="button" className="cc-clear" onClick={clearAll}>
            Clear all
          </button>
        )}
      </div>

      {status && <p className="cc-status">{status}</p>}

      {selectedIds.length === 0 ? (
        <p className="chart-copy">Add a country or category above to see its seasonal curve.</p>
      ) : (
        <svg
          ref={svgRef}
          id="country-curves-chart"
          className="seasonality-chart"
          viewBox="0 0 700 280"
          role="img"
          aria-label={`Line chart comparing the seasonal mortality curves of ${selectedNames.join(", ")}`}
        />
      )}
    </section>
  );
}
