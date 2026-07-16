"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import * as d3 from "d3";
import {
  MONTHS,
  COUNTRY_CURVE_PICKS,
  EXTRA_CURVE_COLORS,
  MAX_COMPARE_COUNTRIES,
  styleAxis,
} from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import type { CountryFeature, SeasonalityData } from "../types";

interface Series {
  id: number;
  name: string;
  color: string;
  curve: number[];
}

interface CountryCurvesProps {
  seasonality: SeasonalityData | null;
  features: CountryFeature[] | null;
}

const COLOR_POOL = [...COUNTRY_CURVE_PICKS.map((d) => d.color), ...EXTRA_CURVE_COLORS];
const DEFAULT_NAME_BY_ID = new Map(COUNTRY_CURVE_PICKS.map((d) => [d.id, d.name]));

// Chart 3: multi-line seasonal mortality curves, comparable across any country with a
// directly-measured curve (no latitude-fallback countries — those never appear in
// `seasonality.countries`). Starts on the 10-country default from chartHelpers.
export default function CountryCurves({ seasonality, features }: CountryCurvesProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [selectedIds, setSelectedIds] = useState<number[]>(() =>
    COUNTRY_CURVE_PICKS.map((d) => d.id),
  );
  const [colorById, setColorById] = useState<Map<number, string>>(
    () => new Map(COUNTRY_CURVE_PICKS.map((d) => [d.id, d.color])),
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const nameById = useMemo(
    () => new Map((features ?? []).map((f) => [Number(f.id), f.properties?.name ?? "Unknown"])),
    [features],
  );

  // Every country with a direct measured curve — fallback-only countries never appear
  // in `seasonality.countries`, so no extra filtering is needed to exclude them.
  const availableCountries = useMemo(() => {
    if (!seasonality) return [];
    return Object.keys(seasonality.countries)
      .map(Number)
      .map((id) => ({ id, name: DEFAULT_NAME_BY_ID.get(id) ?? nameById.get(id) ?? String(id) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [seasonality, nameById]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const selected = new Set(selectedIds);
    return availableCountries.filter(
      (c) => !selected.has(c.id) && (q === "" || c.name.toLowerCase().includes(q)),
    );
  }, [availableCountries, selectedIds, query]);

  const atCap = selectedIds.length >= MAX_COMPARE_COUNTRIES;

  function addCountry(id: number) {
    if (selectedIds.includes(id) || selectedIds.length >= MAX_COMPARE_COUNTRIES) return;
    const used = new Set(colorById.values());
    const color = COLOR_POOL.find((c) => !used.has(c));
    if (!color) return;
    setSelectedIds((prev) => [...prev, id]);
    setColorById((prev) => new Map(prev).set(id, color));
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
      if (match) addCountry(match.id);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const selectedNames = useMemo(() => {
    const byId = new Map(availableCountries.map((c) => [c.id, c.name]));
    return selectedIds.map((id) => byId.get(id) ?? DEFAULT_NAME_BY_ID.get(id) ?? String(id));
  }, [availableCountries, selectedIds]);

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
        return {
          id,
          name: DEFAULT_NAME_BY_ID.get(id) ?? nameById.get(id) ?? String(id),
          color,
          curve,
        };
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
        showTooltip(
          `${d.name}, ${MONTHS[i]}: ${fmtFactor(d.curve[i]!)}×`,
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
  }, [seasonality, selectedIds, colorById, nameById]);

  return (
    <section className="chart-panel wide">
      <h4 className="chart-title">A Cluster Of Similar Curves</h4>
      <p className="chart-copy">
        Add or remove any country with a directly-measured curve to compare.
      </p>

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
              ? `country-compare-option-${matches[activeIndex].id}`
              : undefined
          }
          placeholder={
            atCap
              ? `Comparing ${MAX_COMPARE_COUNTRIES} — remove one to add another`
              : "Add a country…"
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
            {matches.length === 0 && <li className="cc-empty">No matching countries</li>}
            {matches.map((c, i) => (
              <li
                key={c.id}
                id={`country-compare-option-${c.id}`}
                role="option"
                aria-selected={i === activeIndex}
                className={`cc-option${i === activeIndex ? " active" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => addCountry(c.id)}
              >
                {c.name}
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
      </div>

      {selectedIds.length === 0 ? (
        <p className="chart-copy">Add a country above to see its seasonal curve.</p>
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
