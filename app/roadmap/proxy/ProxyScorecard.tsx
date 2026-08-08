"use client";

import { useMemo } from "react";
import * as d3 from "d3";
import { useDict } from "../I18nContext";
import { fill, plural } from "@/lib/i18n/fill";
import { proxyDefs } from "./proxyDefs";
import { useProxyGuess } from "./ProxyGuessContext";
import { proxyAgreement, scoreGuess } from "./proxyScores";
import type { Dictionary } from "@/lib/i18n/en";
import type { CountryFeature, NeighborsByM49, SeasonalityData, SeasonalityProxies } from "../types";

interface ProxyScorecardProps {
  unified: SeasonalityData | null;
  proxies: SeasonalityProxies | null;
  features: CountryFeature[] | null;
  neighborsByM49: NeighborsByM49 | null;
}

const fmt2 = d3.format(".2f");

// The verdict the reader gets, by how far their ranking is from the data's. Bands rather than a
// percentage: this is a guess made before seeing a single chart, and scoring it to two decimals
// would pretend it was an exam.
function verdictLine(d: Dictionary, exact: number, total: number, accuracy: number): string {
  const s = d.proxy.scorecard;
  if (exact === total) return s.verdictPerfect;
  if (accuracy >= 0.84) return s.verdictClose;
  if (accuracy >= 0.6) return s.verdictRough;
  if (accuracy >= 0.34) return s.verdictHalf;
  return s.verdictPoor;
}

// How far off one row is, as a word rather than a number, for the chip that sits beside it.
function deltaKind(delta: number): "hit" | "near" | "miss" {
  const off = Math.abs(delta);
  if (off === 0) return "hit";
  return off === 1 ? "near" : "miss";
}

// After the five charts: what the reader guessed, against what the data actually says.
//
// The ranking they are marked against is measured here rather than written down — each proxy is
// scored by how strongly it agrees with observed amplitude across the countries that report a
// curve, which is the same question every scatter above this asked one proxy at a time.
export default function ProxyScorecard({
  unified,
  proxies,
  features,
  neighborsByM49,
}: ProxyScorecardProps) {
  const d = useDict();
  const { guess } = useProxyGuess();
  const colors = useMemo(() => [0, 1, 2, 3, 4].map((index) => `var(--proxy-color-${index})`), []);
  const s = d.proxy.scorecard;

  const scores = useMemo(
    () => proxyAgreement({ unified, proxies, features, neighborsByM49 }),
    [unified, proxies, features, neighborsByM49],
  );

  if (!scores) return <p className="chart-status">{s.unavailable}</p>;

  const byIndex = new Map(scores.map((score) => [score.index, score]));
  const defsByIndex = new Map(proxyDefs(d).map((def) => [def.index, def]));
  const truthOrder = scores.map((score) => score.index);
  const verdict = scoreGuess(truthOrder, guess);
  const best = scores[0]!.agreement || 1;
  const answered = guess != null;
  const topPickRight = answered && guess[0] === truthOrder[0];

  return (
    <section className="chart-panel wide proxy-scorecard">
      <h3 className="chart-title">{answered ? s.titleScored : s.titleSkipped}</h3>
      <p className="chart-copy">{s.intro}</p>

      {answered ? (
        <div className="scorecard-verdict" style={{ background: "var(--tile)" }}>
          <p className="scorecard-score">
            <strong className="scorecard-score-value">{verdict.exact}</strong>
            <span className="scorecard-score-label">
              {fill(s.scoreLabel, { total: verdict.rows.length })}
            </span>
          </p>
          <div className="scorecard-verdict-copy">
            <p className="scorecard-verdict-line" style={{ color: "var(--ink)" }}>
              {verdictLine(d, verdict.exact, verdict.rows.length, verdict.accuracy)}
            </p>
            <p className="scorecard-verdict-note">
              {fill(plural(verdict.footrule, { one: s.footruleOne, other: s.footruleOther }), {
                worst: verdict.worstFootrule,
              })}{" "}
              {topPickRight
                ? s.topPickRight
                : fill(s.topPickWrong, { title: defsByIndex.get(truthOrder[0]!)?.title ?? "" })}
            </p>
          </div>
        </div>
      ) : (
        <p className="scorecard-skipped">{s.skipped}</p>
      )}

      <ol className="scorecard-rows">
        {verdict.rows.map((row) => {
          const score = byIndex.get(row.index)!;
          const def = defsByIndex.get(row.index);
          return (
            <li className="scorecard-row" key={row.index}>
              <span className="scorecard-rank">{row.truthRank}</span>
              <span className="scorecard-name" style={{ color: "var(--ink)" }}>
                {def?.title}
              </span>
              <span className="scorecard-track">
                <span
                  className="scorecard-bar"
                  style={{
                    width: `${(score.agreement / best) * 100}%`,
                    background: colors[row.index % colors.length],
                  }}
                />
              </span>
              <span className="scorecard-value" title={fill(s.countryCount, { n: score.n })}>
                {score.metric === "eta" ? "η " : "r "}
                {fmt2(score.agreement)}
              </span>
              {row.delta != null ? (
                <span className="scorecard-chip" data-delta={deltaKind(row.delta)}>
                  {row.delta === 0
                    ? s.hadItHere
                    : fill(s.hadItAt, {
                        ordinal: s.ordinals[(row.guessRank as number) - 1] ?? row.guessRank!,
                      })}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>

      <p className="chart-note-copy">{s.note}</p>
    </section>
  );
}
