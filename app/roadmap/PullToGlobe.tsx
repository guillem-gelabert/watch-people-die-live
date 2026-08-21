"use client";

import { useEffect, useRef } from "react";

import { useDict } from "./I18nContext";

// How far the reader has to travel before the bar is full. Long: going back to the top is a
// hundred screens of scroll undone. Raised twice — 104px, then 260 — each time because the bar
// could be filled by overshooting the last paragraph. The overshoot was really momentum being
// accepted as a pull (see SETTLE_MS); that is now gated at the input, so this number no longer
// carries the job of resisting a coast. It is raised anyway, because the gesture should cost
// something on its own terms. This is a gesture you have to mean.
const THRESHOLD = 340;
// The elastic constant. The bar fills against a spring rather than linearly — the first half of
// the travel fills about four-fifths of it, and the last fifth of the bar costs half the pull.
// The resistance is the whole point: it is what makes the end of the gesture feel like a decision
// rather than a distance, which is why the divisor went up with the threshold rather than staying
// proportional — a longer pull with the old curve would have been a longer *cheap* pull.
const SOFTNESS = THRESHOLD / 2.8;
const FULL_STRAIN = 1 - Math.exp(-THRESHOLD / SOFTNESS);
// A mouse wheel arrives in discrete deltas with no "end" event, so a gap this long stands in for
// letting go. Just longer than the pause between two deltas of one continuous scroll, and shorter
// than anything a reader would experience as a wait.
const RELEASE_MS = 150;
// A trackpad keeps emitting decaying deltas for hundreds of milliseconds after the fingers have
// left it, and those deltas are indistinguishable from a deliberate pull once they arrive at the
// bottom of the page. So the stream that carried the reader here does not count: deltas are only
// accepted after the wheel has gone quiet for this long. Momentum cannot survive its own silence;
// a reader who means it still has their hand on the trackpad. Longer than RELEASE_MS, because a
// pause inside one pull must not read as the end of the coast that preceded it.
const SETTLE_MS = 300;
// Below full stretch, an unfed pull leaks back at this rate: a trackpad flick that stops short
// unwinds instead of banking progress towards the next one.
const LEAK_PER_SECOND = 520;
// The bar is drawn at a fixed width rather than a percentage so it reads as a gauge filling up
// rather than a layout that stretches.
const BAR_WIDTH = 118;

// Travel in pixels to how full the bar looks, on the spring.
function strain(travel: number): number {
  if (travel <= 0) return 0;
  return Math.min(1, (1 - Math.exp(-travel / SOFTNESS)) / FULL_STRAIN);
}

// The end of the story: a long upward pull at the very bottom fills a bar and sends the reader
// back to the globe they started on. Touch and wheel share one progress value so a trackpad gets
// the same gesture as a thumb.
export default function PullToGlobe() {
  const hintRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const arrowRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  // The three states of the label are written straight into the node by the gesture, which runs
  // outside React. The effect closes over them and re-arms if the language changes, which costs
  // one listener swap on an event that happens at most twice a session.
  const copy = useDict().chrome.pull;

  useEffect(() => {
    const hint = hintRef.current;
    if (!hint) return;

    // Raw travel, before the spring. Touch sets it absolutely from where the finger started;
    // wheel accumulates into it and it leaks back out.
    let pull = 0;
    let startY: number | null = null;
    let fired = false;
    // Full stretch reached, waiting to be let go of. Nothing happens on the way here — the pull
    // is the reader saying they want to leave, and the release is them meaning it. Once armed the
    // bar stops leaking, so the decision keeps until they act on it either way.
    let armed = false;
    // When the wheel last fed the pull, which is the only thing a wheel has in place of a release.
    let lastWheel = 0;
    // When any wheel event last arrived, fed or not — this is what measures the momentum tail.
    let lastWheelAny = 0;
    // False until the wheel has gone quiet at the end of the page. Closed, deltas are discarded:
    // an unbroken stream arriving at the bottom is the coast that brought the reader here, not a
    // decision to leave. Re-closed on leaving the end, so coming back re-arms it.
    let settled = false;
    let raf = 0;
    let lastTick = 0;
    let releaseTimer: ReturnType<typeof setTimeout> | undefined;

    const atEnd = () =>
      window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 2;

    const paint = (k: number) => {
      hint.style.transform = `translateY(${(-16 * k).toFixed(1)}px)`;
      hint.style.setProperty("--pull-strength", k.toFixed(3));
      hint.dataset.ready = k >= 1 ? "1" : "0";
      if (barRef.current) barRef.current.style.width = `${Math.round(k * BAR_WIDTH)}px`;
      if (arrowRef.current) {
        arrowRef.current.style.transform = `translateY(${(-6 * k).toFixed(1)}px) scale(${(1 + 0.25 * k).toFixed(2)})`;
      }
      if (labelRef.current) {
        labelRef.current.textContent =
          k >= 1 ? copy.ready : k > 0.55 ? copy.keepPulling : copy.idle;
      }
    };

    const fire = () => {
      if (fired) return;
      fired = true;
      pull = 0;
      armed = false;
      paint(1);
      releaseTimer = setTimeout(() => {
        paint(0);
        fired = false;
      }, 700);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // One loop, running only while there is something to animate, so an idle page costs nothing.
    const tick = (now: number) => {
      raf = 0;
      const dt = lastTick ? Math.min(0.1, (now - lastTick) / 1000) : 0;
      lastTick = now;
      // Only an unarmed pull decays. Armed, the bar holds at full while it waits to be released.
      if (!armed && startY == null) pull = Math.max(0, pull - LEAK_PER_SECOND * dt);
      const k = armed ? 1 : strain(pull);
      if (k >= 1) armed = true;
      paint(k);
      // A wheel has no touchend, so its release is the deltas stopping. A finger's release is
      // handled where it happens, in onTouchEnd, and never here — while it is still down,
      // startY says so.
      if (armed && startY == null && now - lastWheel >= RELEASE_MS) {
        fire();
        return;
      }
      if (armed || pull > 0) raf = requestAnimationFrame(tick);
      else lastTick = 0;
    };

    const run = () => {
      if (!raf) {
        lastTick = 0;
        raf = requestAnimationFrame(tick);
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0]?.clientY ?? null;
      pull = 0;
      armed = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (startY == null || fired || y == null) return;
      // Positive means the finger travelled up, which is the direction that would scroll past
      // the end of the page.
      const travelled = startY - y;
      if (!atEnd() || travelled <= 0) {
        startY = y;
        pull = 0;
        armed = false;
        paint(0);
        return;
      }
      pull = travelled;
      run();
    };

    const onTouchEnd = () => {
      startY = null;
      // The whole gesture lands here: at full stretch the release is the decision, and short of
      // it the bar unwinds and nothing has happened.
      if (armed || strain(pull) >= 1) fire();
      else run();
    };

    const onWheel = (e: WheelEvent) => {
      // Every wheel event updates the tail clock, including the ones this gate throws away —
      // otherwise a discarded momentum stream would look like silence to the next delta.
      const now = performance.now();
      const quiet = now - lastWheelAny;
      lastWheelAny = now;
      if (fired || !atEnd()) {
        settled = false;
        return;
      }
      if (!settled) {
        if (quiet < SETTLE_MS) return;
        settled = true;
      }
      if (e.deltaY <= 0) return;
      pull = Math.min(THRESHOLD * 1.6, pull + e.deltaY);
      lastWheel = now;
      run();
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("wheel", onWheel);
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(releaseTimer);
    };
  }, [copy]);

  return (
    <div id="pull-hint" ref={hintRef}>
      {/* The gesture is a shortcut, not the only way back: the button does the same thing for
          anyone using a keyboard, a screen reader, or a mouse without a wheel. It wraps the whole
          stack — arrow, label and track — so the three sit at one gap, as they do in the design,
          rather than the track falling outside the control at a second one. */}
      <button type="button" id="pull-button" onClick={() => window.scrollTo({ top: 0 })}>
        <span id="pull-arrow" ref={arrowRef} aria-hidden="true">
          ↑
        </span>
        <span id="pull-label" ref={labelRef}>
          {copy.idle}
        </span>
        <span id="pull-track" aria-hidden="true">
          <span id="pull-bar" ref={barRef} />
        </span>
      </button>
    </div>
  );
}
