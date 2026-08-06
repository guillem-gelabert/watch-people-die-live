"use client";

import { useMemo } from "react";
import { strength } from "../chartHelpers";
import { useDict } from "../I18nContext";
import { fill } from "@/lib/i18n/fill";
import AmplitudeScatter, { type AmplitudePoint } from "./AmplitudeScatter";
import { PROXY } from "./chartFrame";
import type { CountryFeature, SeasonalityData, SeasonalityProxies } from "../types";

interface Pop65ScatterProps {
  unified: SeasonalityData | null;
  proxies: SeasonalityProxies | null;
  features: CountryFeature[] | null;
}

// Amplitude against the share of the population aged 65+ (World Bank SP.POP.65UP.TO.ZS). One dot
// per country that both reports a seasonal curve and has an age-structure figure. Income rides
// along as dot opacity, because the obvious objection to this proxy is that old countries are
// mostly rich countries — and the reader can see that in the same frame.
export default function Pop65Scatter({ unified, proxies, features }: Pop65ScatterProps) {
  const t = useDict().charts.pop65Scatter;
  const points = useMemo<AmplitudePoint[]>(() => {
    if (!unified || !proxies || !features) return [];
    const nameById = new Map(features.map((f) => [Number(f.id), f.properties?.name ?? ""]));
    return Object.entries(unified.countries).flatMap(([id, curve]) => {
      const row = proxies.byM49[id];
      if (!row || row.pop65 == null) return [];
      return [
        {
          name: nameById.get(Number(id)) || id,
          value: row.pop65,
          amplitude: strength(curve),
          gdpPerCapita: row.gdpPerCapita ?? null,
        },
      ];
    });
  }, [unified, proxies, features]);

  return (
    <AmplitudeScatter
      id="pop65-scatter-chart"
      proxyIndex={PROXY.pop65}
      points={points}
      xLabel={t.xLabel}
      formatValue={(v) => fill(t.value, { v: v.toFixed(1) })}
      formatTick={(v) => `${v}%`}
      ariaLabel={t.aria}
      footnote={t.footnote}
    />
  );
}
