"use client";

import * as d3 from "d3";
import type { ReactNode } from "react";
import type { CountryFeature, LooValidation, NeighborsByM49, SeasonalityProxies } from "../types";
import {
  buildClimateSubclassPerformance,
  buildCohortPerformance,
  buildLatitudePerformance,
  cohortMethodLabel,
  type CohortPerformance,
} from "./validationCohorts";

interface PredictionComparisonProps {
  looValidation: LooValidation | null;
  proxies: SeasonalityProxies | null;
  neighborsByM49: NeighborsByM49 | null;
  features: CountryFeature[] | null;
}

// Aggregate hold-one-out results, straight from the notebook's comparisonTable (one row per
// method): reconstruct every reporting country's curve from each proxy with that country held
// out, then score how far each reconstruction lands from the measured curve, across all countries.
type SummaryKind = "text" | "rmse" | "r" | "skill" | "pct";
const SUMMARY_COLS: { key: string; label: string; kind: SummaryKind }[] = [
  { key: "Method", label: "Method", kind: "text" },
  { key: "Median RMSE", label: "Median RMSE", kind: "rmse" },
  { key: "Median prediction r", label: "Median r", kind: "r" },
  { key: "Skill vs mean curve", label: "Skill vs mean", kind: "skill" },
  { key: "Skill vs latitude", label: "Skill vs latitude", kind: "skill" },
  { key: "Countries won (vs latitude)", label: "Won vs latitude", kind: "pct" },
];

function fmtSummary(value: number | string | null | undefined, kind: SummaryKind): string {
  if (value == null || (typeof value === "number" && Number.isNaN(value))) return "—";
  if (kind === "text") return String(value);
  const n = Number(value);
  if (kind === "rmse") return d3.format(".3f")(n);
  if (kind === "r") return d3.format(".2f")(n);
  if (kind === "skill") return d3.format("+.2f")(n);
  return d3.format(".0%")(n); // pct
}

function PerformanceTable({
  title,
  description,
  cohorts,
  note,
  groupLabel = "Group",
}: {
  title: string;
  description: string;
  cohorts: CohortPerformance[];
  note?: ReactNode;
  groupLabel?: string;
}) {
  const titleId = `${title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}-title`;
  return (
    <section className="loo-cohorts" aria-labelledby={titleId}>
      <h5 id={titleId}>{title}</h5>
      <p className="loo-cohort-copy">{description}</p>
      <div className="loo-summary">
        <table className="loo-summary-table loo-cohort-table">
          <thead>
            <tr>
              <th scope="col">{groupLabel}</th>
              <th scope="col" className="num">
                n
              </th>
              <th scope="col" className="num">
                Latitude RMSE
              </th>
              <th scope="col" className="num">
                Climate RMSE
              </th>
              <th scope="col" className="num">
                Neighbour RMSE
              </th>
              <th scope="col">Best</th>
            </tr>
          </thead>
          <tbody>
            {cohorts.map((cohort) => (
              <tr key={cohort.label}>
                <th scope="row" title={cohort.definition}>
                  {cohort.label}
                </th>
                <td className="num">{cohort.count}</td>
                {(["latitude", "climate", "neighbor"] as const).map((method) => (
                  <td key={method} className="num">
                    {fmtSummary(cohort.rmseByMethod[method], "rmse")}
                  </td>
                ))}
                <td>{cohortMethodLabel(cohort.bestMethod)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note && <p className="loo-cohort-note">{note}</p>}
    </section>
  );
}

export default function PredictionComparison({
  looValidation,
  proxies,
  neighborsByM49,
  features,
}: PredictionComparisonProps) {
  const summary = looValidation?.comparisonTable ?? [];
  if (!looValidation || summary.length === 0) return null;
  const cohorts = buildCohortPerformance(looValidation, proxies, neighborsByM49);
  const latitudeByM49 = new Map(
    (features ?? []).map((feature) => [Number(feature.id), d3.geoCentroid(feature)[1]]),
  );
  const latitudePerformance = buildLatitudePerformance(looValidation, latitudeByM49);
  const subclassPerformance = buildClimateSubclassPerformance(looValidation, proxies);

  // Best method = lowest median RMSE (the notebook's own headline metric).
  const bestRow = summary.reduce((a, b) =>
    Number(a["Median RMSE"]) <= Number(b["Median RMSE"]) ? a : b,
  );

  return (
    <section className="chart-panel wide">
      <h4 className="chart-title">Predictions vs. Measured Curve</h4>
      <p className="chart-copy">
        Hold out each of the {looValidation.meta.nCountries} countries that report a curve in turn,
        rebuild it from each proxy as if it were missing, and score how far the reconstruction lands
        from the measured curve. Lower median RMSE is better; skill is the drop in total squared
        error against each baseline.
      </p>

      <div className="loo-summary">
        <table className="loo-summary-table">
          <thead>
            <tr>
              {SUMMARY_COLS.map((c) => (
                <th key={c.key} scope="col" className={c.kind === "text" ? undefined : "num"}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.map((row) => {
              const best = row === bestRow;
              return (
                <tr key={String(row.Method)} className={best ? "best" : undefined}>
                  {SUMMARY_COLS.map((c) =>
                    c.kind === "text" ? (
                      <th key={c.key} scope="row">
                        {String(row[c.key])}
                        {best && <span className="best-tag"> · best</span>}
                      </th>
                    ) : (
                      <td key={c.key} className="num">
                        {fmtSummary(row[c.key], c.kind)}
                      </td>
                    ),
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <PerformanceTable
        title="Performance by cohort"
        description="Median day-weighted curve RMSE within each overlapping cohort. Lower is better; an em dash means the validation set has no eligible measured curve for that cohort."
        cohorts={cohorts}
        note={
          <>
            Temperate includes Köppen–Geiger families C and D. Data-poor means sparse local donor
            coverage, not incomplete mortality registration; countries with no measured curve cannot
            be scored by hold-one-out validation.
          </>
        }
      />
      <PerformanceTable
        title="Performance by absolute latitude"
        description="Median day-weighted curve RMSE in disjoint absolute country-centroid latitude bands. Lower is better."
        cohorts={latitudePerformance}
      />
      <PerformanceTable
        title="Performance by Köppen–Geiger sub-class"
        description="Median day-weighted curve RMSE by each country’s population-weighted dominant Köppen–Geiger sub-class. Lower is better; small groups are descriptive."
        cohorts={subclassPerformance}
        groupLabel="Class — sub-class"
      />
    </section>
  );
}
