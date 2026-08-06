"use client";

import { useMemo } from "react";
import * as d3 from "d3";
import { strength } from "../chartHelpers";
import { useDict } from "../I18nContext";
import AmplitudeScatter, { type AmplitudePoint } from "./AmplitudeScatter";
import { PROXY } from "./chartFrame";
import type { CountryFeature, SeasonalityData, SeasonalityProxies } from "../types";

interface GdpScatterProps {
  unified: SeasonalityData | null;
  proxies: SeasonalityProxies | null;
  features: CountryFeature[] | null;
}

const fmtUsd = d3.format("$,.0f");
const fmtAxisUsd = (value: d3.NumberValue) => `$${d3.format("~s")(value)}`;

// Amplitude against GDP per capita (World Bank NY.GDP.PCAP.CD, current USD). The only one of the
// three on a log axis: GDP per capita spans three orders of magnitude across reporting countries,
// and on a linear axis every country but a handful would pile up against the left edge.
export default function GdpScatter({ unified, proxies, features }: GdpScatterProps) {
  const t = useDict().charts.gdpScatter;
  const points = useMemo<AmplitudePoint[]>(() => {
    if (!unified || !proxies || !features) return [];
    const nameById = new Map(features.map((f) => [Number(f.id), f.properties?.name ?? ""]));
    return Object.entries(unified.countries).flatMap(([id, curve]) => {
      const row = proxies.byM49[id];
      if (!row || row.gdpPerCapita == null) return [];
      return [
        {
          name: nameById.get(Number(id)) || id,
          value: row.gdpPerCapita,
          amplitude: strength(curve),
          gdpPerCapita: row.gdpPerCapita,
        },
      ];
    });
  }, [unified, proxies, features]);

  return (
    <AmplitudeScatter
      id="gdp-scatter-chart"
      proxyIndex={PROXY.gdp}
      points={points}
      xLabel={t.xLabel}
      xLog
      formatValue={fmtUsd}
      formatTick={fmtAxisUsd}
      ariaLabel={t.aria}
    />
  );
}
