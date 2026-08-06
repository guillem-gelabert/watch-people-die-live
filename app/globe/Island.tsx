"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  getHeroActive,
  getLatestDeath,
  getServerDeath,
  subscribeToDeaths,
  subscribeToHero,
} from "./stageState";
import { useDict } from "../roadmap/I18nContext";
import { fill } from "@/lib/i18n/fill";

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
  const t = useDict().globe;
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

  const label = death?.text ?? t.waiting;
  // "Woman 78, breast cancer – Spain" -> drop the country, which the line below states
  // more precisely anyway.
  const headline = death ? label.replace(/\s+–\s+[^–]*$/, "") : "—";
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
    <div id="island-wrap">
      <div
        id="island"
        role="button"
        tabIndex={0}
        className={open ? "is-open" : ""}
        aria-label={t.latest}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
      >
        <div id="island-mini" aria-hidden={open}>
          <span id="island-pulse" className="island-dot" />
          <span id="island-text">{label}</span>
        </div>

        <div id="island-full" aria-hidden={!open}>
          <p id="island-eyebrow">
            <span className="island-dot" />
            {t.justNow}
          </p>
          <p id="island-big">{headline}</p>
          <p id="island-where">{where}</p>
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
  );
}
