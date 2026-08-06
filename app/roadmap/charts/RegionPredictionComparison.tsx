"use client";

import * as d3 from "d3";
import type { SubnationalLoo } from "../types";
import { useDict } from "../I18nContext";
import { fill } from "@/lib/i18n/fill";

interface RegionPredictionComparisonProps {
  subnationalLoo: SubnationalLoo | null;
  regionCount: number;
}

const fmtRmse = d3.format(".4f");

// Region-level analog of PredictionComparison: reconstructs each held-out region's curve from the
// mean of its bordering regions (or the latitude fallback where it has none), scored the same way
// as the country-level table, side by side with that table's country column. Region and country
// LOO have different targets — hold out a region vs hold out a country — so the two columns are
// directional, not strictly comparable; the low region-neighbour value largely reflects strong
// within-country spatial coherence, not that data-less countries would be predicted twice as well.
export default function RegionPredictionComparison({
  subnationalLoo,
  regionCount,
}: RegionPredictionComparisonProps) {
  const d = useDict();
  const t = d.charts.regionPrediction;
  if (!subnationalLoo || subnationalLoo.comparison.length === 0) return null;

  return (
    <section className="chart-panel wide">
      <h4 className="chart-title">{t.title}</h4>
      <p className="chart-copy">
        {fill(t.copy, {
          n: subnationalLoo.meta.nRegions ?? regionCount,
          note: subnationalLoo.meta.note,
        })}
      </p>

      <div className="loo-summary">
        <table className="loo-summary-table">
          <thead>
            <tr>
              <th scope="col">{d.charts.common.method}</th>
              <th scope="col" className="num">
                {t.colCountryRmse}
              </th>
              <th scope="col" className="num">
                {t.colRegionRmse}
              </th>
            </tr>
          </thead>
          <tbody>
            {subnationalLoo.comparison.map((row) => {
              const best =
                row.region === Math.min(...subnationalLoo.comparison.map((r) => r.region));
              return (
                <tr key={row.proxy} className={best ? "best" : undefined}>
                  <th scope="row">
                    {row.proxy}
                    {best && <span className="best-tag">{d.charts.common.best}</span>}
                  </th>
                  <td className="num">{fmtRmse(row.country)}</td>
                  <td className="num">{fmtRmse(row.region)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
