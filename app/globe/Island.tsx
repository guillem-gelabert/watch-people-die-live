"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  getHeroActive,
  getLatestDeath,
  getServerDeath,
  subscribeToDeaths,
  subscribeToHero,
} from "./stageState";
import { useI18n } from "../roadmap/I18nContext";
import { fill } from "@/lib/i18n/fill";
import { causeLabel } from "@/lib/i18n/causes";
import { explainDeath } from "./explain";
import { sexLabel } from "./persona";
import Derivation from "./Derivation";

interface IslandProps {
  onPausedChange: (paused: boolean) => void;
}

// The latest death, collapsed into a pill over the globe. Tapping it expands to a card and
// pauses the simulation so the persona stays put long enough to read; the secondary button
// resumes the feed without collapsing. Scrolling out of the hero, or tapping anywhere else,
// closes it.
//
// The shell is a role="button" div rather than a <button> because the expanded card holds
// its own controls, and a button cannot contain buttons.
export default function Island({ onPausedChange }: IslandProps) {
  const death = useSyncExternalStore(subscribeToDeaths, getLatestDeath, getServerDeath);
  const { locale, d } = useI18n();
  const t = d.globe;
  const [open, setOpen] = useState(false);
  // Whether the reader hit Resume while keeping the card open. Pause is derived from this
  // rather than stored, so the sim can never be left stopped behind a closed island.
  const [resumed, setResumed] = useState(false);
  const paused = open && !resumed;

  useEffect(() => {
    onPausedChange(paused);
  }, [paused, onPausedChange]);

  const close = useCallback(() => {
    setOpen(false);
    setResumed(false);
  }, []);

  // Scrolling out of the hero closes it for good, so scrolling back does not reopen a card
  // the reader already dismissed by moving on.
  useEffect(() => subscribeToHero(() => getHeroActive() || close()), [close]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest("#island")) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  const toggle = () => {
    if (open) close();
    else {
      setOpen(true);
      setResumed(false);
    }
  };

  // The card is one big role="button", and the derivation now sits inside it: a click meant to
  // scroll or select in there would otherwise bubble up and close the very thing being read.
  // Space has the same problem from the other direction — it is the scroll key for the region's
  // own tab stop, so the card must not swallow it.
  const fromMath = (target: EventTarget | null): boolean =>
    !!(target as Element | null)?.closest("#island-math");

  // The derivation is only assembled while the card is open, and only once per death: the sim
  // fires twice a second and nobody is reading most of them.
  const derivation = useMemo(
    () => (open && death ? explainDeath(death) : null),
    // `death.at` is the identity of a draw; the object itself is replaced on every one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, death?.at],
  );

  const label = death?.text ?? t.waiting;
  // The persona sentence minus the country, which the line below states more precisely anyway.
  // Composed from the fields rather than cut off the assembled sentence with a regex: that
  // depended on every language ending its template with "– {country}" and on no cause label
  // containing an en dash.
  const headline = death
    ? fill(t.persona, {
        who: sexLabel(t, death.sex, death.age),
        age: death.age,
        cause: causeLabel(d.causes, death.cause),
        country: "",
      })
        .replace(/\s*–\s*$/, "")
        .trim()
    : "—";
  const where = death
    ? fill(t.where, {
        country: death.country,
        lat: Math.abs(death.lat).toFixed(1),
        ns: death.lat < 0 ? t.south : t.north,
        lon: Math.abs(death.lon).toFixed(1),
        ew: death.lon < 0 ? t.west : t.east,
      })
    : "—";

  // #island-wrap's opacity is written by the story's scroll handler, so the pill fades out
  // with the globe instead of switching off at a threshold.
  return (
    <>
      <div id="island-wrap">
        <div
          id="island"
          role="button"
          tabIndex={0}
          className={open ? (derivation ? "is-open has-math" : "is-open") : ""}
          // Named from the text the reader can actually see, prefixed by what the thing is. An
          // `aria-label` of "Latest death" alone read as a different control from the one on screen
          // — WCAG's Label in Name asks that a name spoken aloud contain the words next to it, so
          // that "tap "Woman 78"" means something. The prefix carries the framing the pill's own
          // words leave out, and the second id follows whichever line is showing.
          aria-labelledby={`island-role ${open ? "island-big" : "island-text"}`}
          aria-expanded={open}
          onClick={(e) => {
            if (!fromMath(e.target)) toggle();
          }}
          onKeyDown={(e) => {
            if (fromMath(e.target)) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggle();
            }
          }}
        >
          <span id="island-role" className="globe-sr-only">
            {t.latest}
          </span>

          <div id="island-mini" aria-hidden={open} inert={open}>
            <span id="island-pulse" className="island-dot" />
            <span id="island-text">{label}</span>
          </div>

          {/* `inert` alongside `aria-hidden`, and it is the half that was missing: the collapsed
            card is hidden from the accessibility tree but its Pause and Close buttons kept their
            place in the tab order, so tabbing off the pill landed on two controls a sighted
            reader could not see and a screen reader would not announce. `inert` takes the whole
            subtree out of focus as well as out of the tree, which is what "hidden" has to mean
            for something still painted on the page. */}
          <div id="island-full" aria-hidden={!open} inert={!open}>
            <p id="island-eyebrow">
              <span className="island-dot" />
              {t.justNow}
            </p>
            <p id="island-big">{headline}</p>
            <p id="island-where">{where}</p>

            {/* Inside the card rather than beside it: one surface to read, one to dismiss. The
                derivation is taller than the card can be, so it scrolls in place between the
                headline and the buttons while the card itself stops short of the viewport — the
                globe the arithmetic is about has to stay on screen under it. */}
            {derivation && death ? (
              <Derivation derivation={derivation} death={death} locale={locale} words={t.math} />
            ) : null}

            <div id="island-actions">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setResumed((r) => !r);
                }}
              >
                {paused ? t.resume : t.pause}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  close();
                }}
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
