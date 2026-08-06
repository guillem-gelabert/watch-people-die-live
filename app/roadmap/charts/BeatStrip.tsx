"use client";

import { useEffect, useMemo, useState } from "react";
import { useSkin } from "../SkinContext";
import { REAL_MEAN_GAP_MS, expGap, formatMeanGap } from "../chartHelpers";
import { mapColor } from "../palette";

// What fits across a phone at a legible width, given the 5px gap between bars — the two trade
// against each other, since the bars are flex:1 and share whatever the gaps leave. Still long
// enough that the Poisson strip shows several clusters and several gaps in one screen.
const BARS = 32;
// Resting height of a bar. The metronome never leaves it; the Poisson strip uses it as the
// midpoint of its range so the two strips read as the same instrument.
const REST_HEIGHT = 22;
const MIN_HEIGHT = 5;
const MAX_HEIGHT = 38;
// A gap counts as "on the average rate" within 15% of the mean — tight enough that only a
// genuinely typical wait is marked, loose enough that it happens a few times per pass.
const ON_RATE_TOLERANCE = 0.15;
// A bar at full height means a wait of a second or more. Past that the exponential tail is so
// long that scaling to it would flatten every ordinary gap to nothing.
const FULL_HEIGHT_GAP_MS = 1000;

type Mode = "metronome" | "poisson";
type Tone = "a" | "b" | "hot";

interface Beat {
  height: number;
  tone: Tone;
  title: string;
}

interface BeatStripProps {
  mode: Mode;
  meanMs?: number;
}

function restingBeat(): Beat {
  return { height: REST_HEIGHT, tone: "a", title: "" };
}

// Two readings of the same annual death rate. The metronome fires on the mean gap every time;
// the Poisson strip draws each gap from the exponential distribution the real process follows
// and lets the bar's height carry how long that wait was. Same average, completely different
// shape — which is the whole argument of the section.
export default function BeatStrip({ mode, meanMs = REAL_MEAN_GAP_MS }: BeatStripProps) {
  const { skin } = useSkin();
  const [beats, setBeats] = useState<Beat[]>(() => Array.from({ length: BARS }, restingBeat));

  // The design's two fixed blues for the alternating cycles and its red for an on-rate beat, each
  // re-expressed in the current section's palette. Deliberately not a generated harmony: these
  // bars are one wide block of solid colour, and a vivid complement at that size fights the
  // copy around it. Bars store which tone they are rather than a colour, so a sky change re-inks
  // the whole strip on the next render without interrupting the beat.
  const palette = useMemo(
    () => ({
      a: mapColor("#2f4bff", skin),
      b: mapColor("#7c93cf", skin),
      hot: mapColor("#ff3b30", skin),
    }),
    [skin],
  );

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let index = 0;
    let cycle = 0;

    const beat = () => {
      const gapMs = mode === "poisson" ? expGap(meanMs) : meanMs;
      const onRate = mode === "poisson" && Math.abs(gapMs - meanMs) < meanMs * ON_RATE_TOLERANCE;
      const at = index;
      const next: Beat = {
        height:
          mode === "poisson"
            ? MIN_HEIGHT + Math.min(1, gapMs / FULL_HEIGHT_GAP_MS) * (MAX_HEIGHT - MIN_HEIGHT)
            : REST_HEIGHT,
        tone: onRate ? "hot" : cycle % 2 === 0 ? "a" : "b",
        title:
          mode === "poisson"
            ? `${Math.round(gapMs)} ms since the previous death${onRate ? " — on the average rate" : ""}`
            : `${formatMeanGap(meanMs)} — always`,
      };
      setBeats((prev) => prev.map((b, i) => (i === at ? next : b)));

      index += 1;
      if (index >= BARS) {
        index = 0;
        cycle += 1;
      }
      timer = setTimeout(() => {
        if (!cancelled) beat();
      }, gapMs);
    };

    beat();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [mode, meanMs]);

  const label =
    mode === "poisson"
      ? "Gaps between deaths drawn from the real distribution: most are short, a few are long"
      : `A beat every ${formatMeanGap(meanMs)}, the annual average`;

  return (
    <section className="chart-panel wide" aria-label={label}>
      <div className={`beat-strip beat-strip-${mode}`} aria-hidden="true">
        {beats.map((b, i) => (
          <span
            key={i}
            className="beat-bar"
            style={{ height: `${b.height.toFixed(1)}px`, background: palette[b.tone] }}
            title={b.title}
          />
        ))}
      </div>
    </section>
  );
}
