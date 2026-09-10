"use client";

import type { Dictionary } from "@/lib/i18n/en";
import type { Locale } from "@/lib/i18n/config";
import { causeLabel } from "@/lib/i18n/causes";
import { fill } from "@/lib/i18n/fill";
import { useDict } from "../roadmap/I18nContext";
import type { Derivation as DerivationModel } from "./explain";
import type { Death } from "./stageState";

// The arithmetic behind one death, shown rather than described: the multiplication that gave its
// cell a weight, then the three draws that gave it a person. Every number here came back from the
// sampler and the persona tables, so the card cannot drift from the simulation it is explaining.
//
// Source names (GPWv4, World Bank, WHO, ACLED) stay in English wherever the card is read — they
// are proper nouns, like the country and cause names, not strings to translate.
const GPWV4 = "GPWv4 2015";
const WORLD_BANK = "World Bank";
const ACLED = "ACLED";

interface DerivationProps {
  derivation: DerivationModel;
  death: Death;
  locale: Locale;
  words: Dictionary["globe"]["math"];
}

function Row({
  op,
  value,
  unit,
  note,
}: {
  op?: string;
  value: string;
  unit: string;
  note?: string;
}) {
  return (
    <li className="drv-row">
      <span className="drv-op" aria-hidden={!op}>
        {op ?? ""}
      </span>
      <span className="drv-val">{value}</span>
      <span className="drv-unit">{unit}</span>
      {note ? <span className="drv-note">{note}</span> : null}
    </li>
  );
}

// A labelled bar. `p` is a probability; `drawn` marks the outcome this death actually got.
function Bar({ label, p, drawn, pct }: { label: string; p: number; drawn: boolean; pct: string }) {
  return (
    <li className={drawn ? "drv-bar is-drawn" : "drv-bar"}>
      <span className="drv-bar-label">{label}</span>
      <span className="drv-bar-track">
        {/* The bar is decoration over the number beside it, which carries the same value. */}
        <span className="drv-bar-fill" style={{ width: `${Math.max(p * 100, 0.5)}%` }} />
      </span>
      <span className="drv-bar-pct">{pct}</span>
    </li>
  );
}

export default function Derivation({ derivation, death, locale, words }: DerivationProps) {
  const d = useDict();
  const { cell, ages, causes, sex, tier } = derivation;

  const round = (value: number, digits = 0) =>
    new Intl.NumberFormat(locale, {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(value);
  const pct = (p: number) =>
    new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(p);
  // "61.6 million" rather than "61,615,938": the point of the line is the order of magnitude.
  const compact = (value: number) =>
    new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
  const month = death.eventDate.toLocaleString(locale, { month: "long", timeZone: "UTC" });

  const tierWord =
    tier === 0
      ? words.tierRegional
      : tier === 1
        ? words.tierDerived
        : tier === 2
          ? words.tierNational
          : null;

  return (
    // The panel scrolls and holds nothing focusable, so without a tab stop of its own a keyboard
    // user can see the derivation but cannot reach past its first screen. `group` plus a name
    // makes it one announced region rather than an unlabelled scroll container.
    <div
      id="island-math"
      role="group"
      aria-label={`${words.whereTitle}. ${words.whoTitle}`}
      tabIndex={0}
    >
      {cell ? (
        <section className="drv-block" aria-labelledby="drv-where-h">
          <h3 className="drv-h" id="drv-where-h">
            {words.whereTitle}
          </h3>
          <p className="drv-sub">{fill(words.cellOf, { country: death.country })}</p>
          <ul className="drv-rows">
            {cell.population !== null && cell.rate !== null ? (
              <>
                <Row value={round(cell.population)} unit={words.people} note={GPWV4} />
                <Row
                  op="×"
                  value={round(cell.rate * 1000, 2)}
                  unit={words.perThousand}
                  note={`${WORLD_BANK} ${cell.year}`}
                />
              </>
            ) : null}
            <Row op="=" value={round(cell.baseDeaths, 1)} unit={words.deathsPerYear} />
            {/* Three decimals, not two: most countries sit within a percent of 1.0 in most weeks,
                and a rounded "1.00" above a total that visibly drops reads as an arithmetic
                error rather than as a small seasonal effect. */}
            <Row op="×" value={round(cell.seasonal, 3)} unit={fill(words.seasonalIn, { month })} />
            {/* Conflict is added, not multiplied — it does not follow the winter curve, so the
                sampler puts it on top of the seasonal baseline rather than scaling it. */}
            {cell.conflict > 0 ? (
              <Row op="+" value={round(cell.conflict, 1)} unit={words.conflict} note={ACLED} />
            ) : null}
            <Row
              op="="
              value={round(cell.weight, 1)}
              unit={words.deathsPerYear}
              note={
                cell.weight > 0
                  ? fill(words.share, {
                      // Odds read as a count ("1 in 1,596"), so they are grouped rather than
                      // compacted; the world total is an order of magnitude ("59.2M") and is.
                      odds: round(cell.total / cell.weight),
                      total: compact(cell.total),
                    })
                  : undefined
              }
            />
          </ul>
        </section>
      ) : null}

      <section className="drv-block" aria-labelledby="drv-who-h">
        <h3 className="drv-h" id="drv-who-h">
          {words.whoTitle}
        </h3>

        {sex ? (
          <>
            <p className="drv-sub">
              {words.sex}
              {tierWord ? <span className="drv-tier">{tierWord}</span> : null}
            </p>
            <ul className="drv-bars">
              <Bar label={d.globe.woman} p={sex.f} pct={pct(sex.f)} drawn={death.sex === "f"} />
              <Bar label={d.globe.man} p={sex.m} pct={pct(sex.m)} drawn={death.sex === "m"} />
            </ul>
          </>
        ) : null}

        {ages ? (
          <>
            <p className="drv-sub">{words.age}</p>
            <ul className="drv-bars">
              {ages.map((band) => (
                <Bar
                  key={band.label}
                  label={band.label}
                  p={band.p}
                  pct={pct(band.p)}
                  drawn={band.drawn}
                />
              ))}
            </ul>
          </>
        ) : null}

        <p className="drv-sub">
          {words.cause}
          {/* How many causes were in play, not which rank this one took: "3 of 41" reads as a
              fraction rather than as a placing, and the bars already show the order. */}
          {derivation.causeCount > 0 ? (
            <span className="drv-tier">
              {fill(words.causeOptions, { count: derivation.causeCount })}
            </span>
          ) : null}
        </p>
        {causes && causes.length ? (
          <ul className="drv-bars is-causes">
            {causes.map((c) => (
              <Bar
                key={c.label}
                label={causeLabel(d.causes, c.label)}
                p={c.p}
                pct={pct(c.p)}
                drawn={c.drawn}
              />
            ))}
          </ul>
        ) : (
          <p className="drv-empty">{words.causeFallback}</p>
        )}
      </section>
    </div>
  );
}
