"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import * as d3 from "d3";
import {
  MONTHS,
  COUNTRY_CURVE_PICKS,
  KG_FAMILY_KEYS,
  MAX_COMPARE_COUNTRIES,
} from "../chartHelpers";
import { CURVE_Y_DOMAIN, MARGINS } from "./chartFrame";
import { kgFamilyName } from "../chartHelpers";
import { figureHeight, useFigureWidth } from "./useFigureSize";
import { showTooltip, hideTooltip } from "../tooltip";
import type { CountryFeature, SeasonalityData, SeasonalityProxies } from "../types";
import { sampleHarmonicCurve, shiftHarmonicCurveHalfYear } from "@/lib/seasonal-curve";
import { useDict } from "../I18nContext";
import { fill } from "@/lib/i18n/fill";

// Wide and shallow: twelve months across, a narrow band of deviation vertically. Bounded so a
// wider column lengthens the year rather than inflating the labels.
const SHAPE = { aspect: 0.636, min: 210, max: 290 };
const CURVE_PHASES = d3.range(181).map((index) => index / 180);

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

const DEFAULT_NAME_BY_ID = new Map(COUNTRY_CURVE_PICKS.map((d) => [d.id, d.name]));
const SWITZERLAND_ID = 756;

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
// Bounds only. The labels live in the dictionary, indexed by position, because a bin is a
// range first and a phrase second.
const GDP_BINS = [
  { key: "gdp-0", lo: -Infinity, hi: 10_000 },
  { key: "gdp-1", lo: 10_000, hi: 30_000 },
  { key: "gdp-2", lo: 30_000, hi: 50_000 },
  { key: "gdp-3", lo: 50_000, hi: Infinity },
];
const LAT_BINS = [
  { key: "lat-0", lo: 0, hi: 23.5 },
  { key: "lat-1", lo: 23.5, hi: 35 },
  { key: "lat-2", lo: 35, hi: 50 },
  { key: "lat-3", lo: 50, hi: Infinity },
];

// Chart 3: multi-line seasonal mortality curves, comparable across any country with a
// directly-measured curve (no latitude-fallback countries — those never appear in
// `seasonality.countries`). Starts on Switzerland alone; categories bulk-add measured countries
// by climate zone, GDP bin, or latitude bin, up to the colour-pool cap.
export default function CountryCurves({ seasonality, features, proxies }: CountryCurvesProps) {
  const d = useDict();
  const t = d.charts.countryCurves;
  const UNKNOWN = d.charts.common.unknown;
  const palette = useMemo(
    () =>
      Array.from({ length: MAX_COMPARE_COUNTRIES }, (_, index) => `var(--curve-color-${index})`),
    [],
  );
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [sizeRef, WIDTH] = useFigureWidth<SVGSVGElement>();
  const HEIGHT = figureHeight(WIDTH, SHAPE);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [selectedIds, setSelectedIds] = useState<number[]>([SWITZERLAND_ID]);
  // Palette slots, not literal colours: the pool is generated from the section's sky, so a
  // stored colour would go stale the moment the sky changes.
  const [colorById, setColorById] = useState<Map<number, number>>(
    () => new Map([[SWITZERLAND_ID, 0]]),
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [status, setStatus] = useState<string | null>(null);

  const nameById = useMemo(
    () => new Map((features ?? []).map((f) => [Number(f.id), f.properties?.name ?? UNKNOWN])),
    [features, UNKNOWN],
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
      for (const fam of KG_FAMILY_KEYS) {
        const ids = curveIds.filter((id) => proxies.byM49[id]?.kgFamily === fam.key);
        if (ids.length) {
          out.push({
            optionKey: `climate-${fam.key}`,
            kind: "category",
            group: t.groupClimate,
            label: kgFamilyName(d, fam.key),
            ids,
          });
        }
      }
      for (const [index, bin] of GDP_BINS.entries()) {
        const ids = curveIds.filter((id) => {
          const g = proxies.byM49[id]?.gdpPerCapita;
          return g != null && g >= bin.lo && g < bin.hi;
        });
        if (ids.length) {
          out.push({
            optionKey: bin.key,
            kind: "category",
            group: t.groupGdp,
            label: t.gdpBins[index] ?? bin.key,
            ids,
          });
        }
      }
    }

    for (const [index, bin] of LAT_BINS.entries()) {
      const ids = curveIds.filter((id) => {
        const lat = signedLatById.get(id);
        return lat != null && Math.abs(lat) >= bin.lo && Math.abs(lat) < bin.hi;
      });
      if (ids.length) {
        out.push({
          optionKey: bin.key,
          kind: "category",
          group: t.groupLatitude,
          label: t.latBins[index] ?? bin.key,
          ids,
        });
      }
    }
    return out;
  }, [seasonality, proxies, signedLatById, d, t]);

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
      let slot = 0;
      while (slot < MAX_COMPARE_COUNTRIES && used.has(slot)) slot += 1;
      if (slot >= MAX_COMPARE_COUNTRIES) continue;
      used.add(slot);
      nextSelected.push(id);
      nextColors.set(id, slot);
      added += 1;
    }
    if (added) {
      setSelectedIds(nextSelected);
      setColorById(nextColors);
    }
    const dropped = requested - added;
    setStatus(
      dropped > 0 ? fill(t.limitReached, { added, max: MAX_COMPARE_COUNTRIES, dropped }) : null,
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

    const m = MARGINS.curve;
    const innerW = WIDTH - m.left - m.right;
    const innerH = HEIGHT - m.top - m.bottom;
    const series: Series[] = selectedIds
      .map((id): Series | null => {
        const curve = seasonality.countries[String(id)];
        const slot = colorById.get(id);
        const color = slot === undefined ? undefined : palette[slot % palette.length];
        if (!curve || !color) return null;
        const shift = (signedLatById.get(id) ?? 0) < 0 ? 6 : 0;
        const alignedCurve = shift ? shiftHarmonicCurveHalfYear(curve) : curve;
        const aligned = sampleHarmonicCurve(alignedCurve, CURVE_PHASES);
        return { id, name: resolveName(id), color, curve: aligned, shift };
      })
      .filter((d): d is Series => d !== null);
    if (!series.length) return;

    // Curves are seasonal multipliers (mean 1): >1 fires faster than the annual
    // average, <1 slower. Shown as the raw factor, not a percentage deviation.
    const fmtFactor = d3.format(".2f");

    const x = d3.scaleLinear().domain([0, 1]).range([0, innerW]);
    // A fixed y-domain rather than one fitted to the selection: adding a flatter country must not
    // rescale the ones already on screen, or the reader loses the comparison they were making.
    const y = d3.scaleLinear().domain(CURVE_Y_DOMAIN).range([innerH, 0]);
    const line = d3
      .line<number>()
      .x((_, i) => x(CURVE_PHASES[i] ?? 0))
      .y((d) => y(d))
      .curve(d3.curveMonotoneX);
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    // The annual mean is the only rule on the chart: every curve is a deviation from its own
    // average, so the one line worth drawing is the average itself.
    g.append("line")
      .attr("class", "chart-axis")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", y(1))
      .attr("y2", y(1));
    g.append("text")
      .attr("class", "chart-tick")
      .attr("x", innerW + 5)
      .attr("y", y(1) + 3.4)
      .text("×1");

    g.selectAll("path.country-curve")
      .data(series, (d) => (d as Series).id)
      .join("path")
      .attr("class", "country-curve")
      .attr("fill", "none")
      .attr("stroke", (d) => d.color)
      .attr("stroke-width", 2)
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")
      .attr("d", (d) => line(d.curve))
      .style("cursor", "pointer")
      .on("pointermove", (event, d) => {
        // Nearest phase under the pointer for this series.
        const [px] = d3.pointer(event, g.node());
        const phase = Math.max(0, Math.min(1, x.invert(px)));
        const i = Math.min(CURVE_PHASES.length - 1, Math.round(phase * (CURVE_PHASES.length - 1)));
        // Report the country's true calendar month, not the aligned x position.
        const trueMonth = MONTHS[Math.floor(((phase + d.shift / 12) % 1) * 12) % 12];
        showTooltip(
          `${d.name}, ${trueMonth}: ${fmtFactor(d.curve[i]!)}×`,
          event.clientX,
          event.clientY,
        );
      })
      .on("pointerleave", hideTooltip);

    // A dot at each end of every curve: with a dozen lines crossing, the ends are what let the eye
    // pick one out and follow it.
    for (const s of series) {
      for (const i of [0, CURVE_PHASES.length - 1]) {
        g.append("circle")
          .attr("cx", x(CURVE_PHASES[i] ?? 0))
          .attr("cy", y(s.curve[i]!))
          .attr("r", 2.6)
          .attr("fill", s.color);
      }
    }

    // Every third month only: twelve labels do not fit across a phone, and the quarters are enough
    // to orient a seasonal curve.
    MONTHS.forEach((month, i) => {
      if (i % 3 !== 0) return;
      g.append("text")
        .attr("class", "chart-tick")
        .attr("x", x((i + 0.5) / 12))
        .attr("y", innerH + 14)
        .attr("text-anchor", "middle")
        .text(month);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonality, selectedIds, colorById, nameById, signedLatById, palette, WIDTH, HEIGHT]);

  return (
    <section className="chart-panel wide">
      {selectedIds.length === 0 ? (
        <p className="chart-copy">{t.empty}</p>
      ) : (
        <svg
          ref={(node) => {
            svgRef.current = node;
            sizeRef(node);
          }}
          id="country-curves-chart"
          className="story-figure"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={fill(t.aria, { names: selectedNames.join(", ") })}
        />
      )}

      {/* No panel title: the section heading in the prose already names this figure, and the
          design carries it there rather than repeating it inside the panel. */}
      <div className="cc-combobox">
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
            atCap ? fill(t.placeholderAtCap, { max: MAX_COMPARE_COUNTRIES }) : t.placeholder
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
            {matches.length === 0 && <li className="cc-empty">{t.noMatches}</li>}
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

      <div className="cc-chips" aria-label={t.selected}>
        {selectedIds.map((id, i) => (
          <span
            className="cc-chip"
            key={id}
            style={{ background: palette[(colorById.get(id) ?? 0) % palette.length] }}
          >
            {selectedNames[i]}
            <button
              type="button"
              className="cc-chip-remove"
              aria-label={fill(t.remove, { name: selectedNames[i] ?? "" })}
              onClick={() => removeCountry(id)}
            >
              ✕
            </button>
          </span>
        ))}
        {selectedIds.length > 0 && (
          <button type="button" className="cc-clear" onClick={clearAll}>
            {t.clearAll}
          </button>
        )}
      </div>

      {status && <p className="cc-status">{status}</p>}
    </section>
  );
}
