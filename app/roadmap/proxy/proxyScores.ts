// Scoring the reader's proxy ranking against the data's own.
//
// The five charts each answer one question — does this proxy track a country's seasonal swing? —
// and they answer it in five different units: a latitude in degrees, a GDP in dollars, a climate
// class. To rank the five against each other they have to be reduced to one number, so each proxy
// is scored by how strongly it agrees with observed amplitude: |Pearson r| for the four continuous
// proxies, and the correlation ratio η for the categorical one. Both are on [0, 1] and both are
// "the share of the spread this predictor accounts for", so they are comparable enough to order.
//
// Deliberately measured rather than declared: the ranking the reader is marked against comes out
// of the same data the charts above it drew, so it cannot drift away from them.
import * as d3 from "d3";
import { correlationRatio, pearson, strength } from "../chartHelpers";
import { PROXY } from "../charts/chartFrame";
import type { CountryFeature, NeighborsByM49, SeasonalityData, SeasonalityProxies } from "../types";

export type AgreementMetric = "r" | "eta";

export interface ProxyScore {
  // The proxy's identity index (PROXY.*), not its rank.
  index: number;
  // |r| or η, on [0, 1]. Higher means the proxy tracks amplitude more closely.
  agreement: number;
  // How many countries the figure is computed over.
  n: number;
  metric: AgreementMetric;
}

interface Inputs {
  unified: SeasonalityData | null;
  proxies: SeasonalityProxies | null;
  features: CountryFeature[] | null;
  neighborsByM49: NeighborsByM49 | null;
}

// Pairs a proxy's x-value with the country's amplitude, dropping any country missing either.
function agree(pairs: [number, number][]): { agreement: number; n: number } | null {
  if (pairs.length < 3) return null;
  const r = pearson(
    pairs.map((p) => p[0]),
    pairs.map((p) => p[1]),
  );
  return r == null ? null : { agreement: Math.abs(r), n: pairs.length };
}

export function proxyAgreement({
  unified,
  proxies,
  features,
  neighborsByM49,
}: Inputs): ProxyScore[] | null {
  if (!unified || !proxies || !features) return null;

  const amplitudeById = new Map(
    Object.entries(unified.countries).map(([id, curve]) => [Number(id), strength(curve)]),
  );
  const latById = new Map(features.map((f) => [Number(f.id), d3.geoCentroid(f)[1]]));

  const gdp: [number, number][] = [];
  const pop65: [number, number][] = [];
  const latitude: [number, number][] = [];
  const neighbour: [number, number][] = [];
  const climateGroups = new Map<string, number[]>();

  for (const [id, amplitude] of amplitudeById) {
    const row = proxies.byM49[String(id)];
    // GDP is read on a log axis in its own chart for the same reason it is logged here: income
    // per head spans three orders of magnitude, and a linear r would be a test of the outliers.
    if (row?.gdpPerCapita != null && row.gdpPerCapita > 0) {
      gdp.push([Math.log10(row.gdpPerCapita), amplitude]);
    }
    if (row?.pop65 != null) pop65.push([row.pop65, amplitude]);
    if (row?.kgFamily) {
      const bucket = climateGroups.get(row.kgFamily) ?? [];
      bucket.push(amplitude);
      climateGroups.set(row.kgFamily, bucket);
    }
    const lat = latById.get(id);
    if (lat != null && Number.isFinite(lat)) latitude.push([Math.abs(lat), amplitude]);

    const donors = (neighborsByM49?.get(id) ?? [])
      .map((n) => amplitudeById.get(n))
      .filter((v): v is number => v != null);
    if (donors.length) neighbour.push([d3.mean(donors) ?? 0, amplitude]);
  }

  const eta = correlationRatio(climateGroups);
  const climateN = [...climateGroups.values()].reduce((a, b) => a + b.length, 0);

  const scores: ProxyScore[] = [];
  const push = (index: number, result: { agreement: number; n: number } | null) => {
    if (result) scores.push({ index, metric: "r", ...result });
  };
  push(PROXY.gdp, agree(gdp));
  push(PROXY.pop65, agree(pop65));
  push(PROXY.latitude, agree(latitude));
  push(PROXY.neighbour, agree(neighbour));
  if (eta != null) {
    scores.push({ index: PROXY.climate, agreement: eta, n: climateN, metric: "eta" });
  }

  if (scores.length < 2) return null;
  return scores.sort((a, b) => b.agreement - a.agreement);
}

export interface VerdictRow {
  index: number;
  // 1-based position in the data's ranking.
  truthRank: number;
  // 1-based position in the reader's, or null if they skipped the modal.
  guessRank: number | null;
  // Signed places off: negative means they ranked it higher than the data does.
  delta: number | null;
}

export interface Verdict {
  rows: VerdictRow[];
  // How many proxies landed in exactly the right slot.
  exact: number;
  // Spearman's footrule: the total number of places the ranking is out by.
  footrule: number;
  // The worst possible footrule for this many items — a perfectly reversed ranking.
  worstFootrule: number;
  // 1 for a perfect ranking, 0 for a perfectly reversed one.
  accuracy: number;
}

// The largest footrule distance for n items, reached by reversing the list: floor(n² / 2).
export function worstFootrule(n: number): number {
  return Math.floor((n * n) / 2);
}

export function scoreGuess(truthOrder: number[], guess: number[] | null): Verdict {
  const rows: VerdictRow[] = truthOrder.map((index, i) => {
    const at = guess?.indexOf(index) ?? -1;
    const guessRank = at >= 0 ? at + 1 : null;
    return {
      index,
      truthRank: i + 1,
      guessRank,
      delta: guessRank == null ? null : guessRank - (i + 1),
    };
  });

  const scored = rows.filter((r) => r.delta != null);
  const footrule = scored.reduce((sum, r) => sum + Math.abs(r.delta as number), 0);
  const worst = worstFootrule(truthOrder.length) || 1;
  return {
    rows,
    exact: scored.filter((r) => r.delta === 0).length,
    footrule,
    worstFootrule: worst,
    accuracy: scored.length ? 1 - footrule / worst : 0,
  };
}
