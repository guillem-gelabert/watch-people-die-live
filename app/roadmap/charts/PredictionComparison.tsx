"use client";

import * as d3 from "d3";
import type { ReactNode } from "react";
import type { CountryFeature, LooValidation, NeighborsByM49, SeasonalityProxies } from "../types";
import { useDict } from "../I18nContext";
import { fill } from "@/lib/i18n/fill";
import type { Dictionary } from "@/lib/i18n/en";
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

// The keys are the notebook's own column names in the baked JSON and never change; the labels
// beside them are copy.
function summaryColumns(d: Dictionary): { key: string; label: string; kind: SummaryKind }[] {
  const t = d.charts.prediction;
  return [
    { key: "Method", label: d.charts.common.method, kind: "text" },
    { key: "Median RMSE", label: t.colMedianRmse, kind: "rmse" },
    { key: "Median prediction r", label: t.colMedianR, kind: "r" },
    { key: "Skill vs mean curve", label: t.colSkillMean, kind: "skill" },
    { key: "Skill vs latitude", label: t.colSkillLatitude, kind: "skill" },
    { key: "Countries won (vs latitude)", label: t.colWonLatitude, kind: "pct" },
  ];
}

// The four rows are values in the validation JSON rather than strings in the source, so they are
// translated on the way out; anything unrecognised prints as it arrives.
function methodLabel(d: Dictionary, method: string): string {
  const methods = d.charts.prediction.methods as Record<string, string | undefined>;
  return methods[method] ?? method;
}

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
  groupLabel,
}: {
  title: string;
  description: string;
  cohorts: CohortPerformance[];
  note?: ReactNode;
  groupLabel?: string;
}) {
  const d = useDict();
  const t = d.charts.prediction;
  const titleId = `${title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}-title`;
  return (
    <section className="loo-cohorts" aria-labelledby={titleId}>
      <h5 id={titleId}>{title}</h5>
      <p className="loo-cohort-copy">{description}</p>
      <div className="loo-summary">
        <table className="loo-summary-table loo-cohort-table">
          <thead>
            <tr>
              <th scope="col">{groupLabel ?? t.group}</th>
              <th scope="col" className="num">
                {t.count}
              </th>
              <th scope="col" className="num">
                {t.latitudeRmse}
              </th>
              <th scope="col" className="num">
                {t.climateRmse}
              </th>
              <th scope="col" className="num">
                {t.neighbourRmse}
              </th>
              <th scope="col">{t.bestColumn}</th>
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
                <td>{cohortMethodLabel(d, cohort.bestMethod)}</td>
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
  const d = useDict();
  const t = d.charts.prediction;
  const summary = looValidation?.comparisonTable ?? [];
  if (!looValidation || summary.length === 0) return null;
  const cols = summaryColumns(d);
  const cohorts = buildCohortPerformance(d, looValidation, proxies, neighborsByM49);
  const latitudeByM49 = new Map(
    (features ?? []).map((feature) => [Number(feature.id), d3.geoCentroid(feature)[1]]),
  );
  const latitudePerformance = buildLatitudePerformance(d, looValidation, latitudeByM49);
  const subclassPerformance = buildClimateSubclassPerformance(d, looValidation, proxies);

  // Best method = lowest median RMSE (the notebook's own headline metric).
  const bestRow = summary.reduce((a, b) =>
    Number(a["Median RMSE"]) <= Number(b["Median RMSE"]) ? a : b,
  );

  return (
    <section className="chart-panel wide">
      <h4 className="chart-title">{t.title}</h4>
      <p className="chart-copy">{fill(t.copy, { n: looValidation.meta.nCountries })}</p>

      <div className="loo-summary">
        <table className="loo-summary-table">
          <thead>
            <tr>
              {cols.map((c) => (
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
                  {cols.map((c) =>
                    c.kind === "text" ? (
                      <th key={c.key} scope="row">
                        {methodLabel(d, String(row[c.key]))}
                        {best && <span className="best-tag">{d.charts.common.best}</span>}
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
        title={t.cohortTitle}
        description={t.cohortCopy}
        cohorts={cohorts}
        note={t.cohortNote}
      />
      <PerformanceTable
        title={t.latitudeTitle}
        description={t.latitudeCopy}
        cohorts={latitudePerformance}
      />
      <PerformanceTable
        title={t.subclassTitle}
        description={t.subclassCopy}
        cohorts={subclassPerformance}
        groupLabel={t.subclassGroup}
      />
    </section>
  );
}
