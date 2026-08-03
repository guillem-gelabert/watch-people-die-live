"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import GlobeStage from "../globe/GlobeStage";
import { setHeroActive } from "../globe/stageState";
import { smoothstep } from "../globe/helpers";
import MiniEarth from "./MiniEarth";
import Section from "./Section";
import { parseSky, skinFromSky, skinToCssVars } from "./palette";
import { SkinProvider } from "./SkinContext";
import RoadmapMarkdown, { roadmapSections, type SectionHeadingKind } from "./roadmapMarkdown";
import { ProxyGuessProvider } from "./proxy/ProxyGuessContext";
import { prepareReveals, prepareTypers, runReveals, runTypers, type Typer } from "./storyMotion";
import { useStorySlots } from "./storySlots";
import "./roadmap.css";

interface StoryClientProps {
  markdown: string;
}

// How far the reader has to travel before the globe has fully left. Expressed in
// viewports, matching the prototype's `transitionScreens` control.
const EXIT_SCREENS = 0.95;
// The sky belongs to whichever section owns this fraction of the viewport height. Picking a
// point above the middle means a section claims the screen slightly before it fills it.
const SKY_LINE = 0.42;

const CHAPTER_CLASS: Record<SectionHeadingKind, string> = {
  default: "story-heading",
  chapter: "story-chapter",
  "chapter-small": "story-chapter story-chapter-small",
  hidden: "",
};

// A chapter title is set to fill the column, so a short word is set larger than a long one —
// the design draws "Who" at 164px where "Where" and "When" are 148px. Sized by character
// count rather than per section, so the rule survives a retitle.
const SHORT_CHAPTER = 3;

export default function StoryClient({ markdown }: StoryClientProps) {
  const sections = useMemo(() => roadmapSections(markdown), [markdown]);
  const slotsByKey = useStorySlots();
  const [skyIndex, setSkyIndex] = useState(0);
  const phaseRef = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  // Fire-once queues, drained by the scroll handler below.
  const revealsRef = useRef<HTMLElement[]>([]);
  const typersRef = useRef<Typer[]>([]);
  const typeTimersRef = useRef(new Set<ReturnType<typeof setTimeout>>());

  // Everything scroll-driven is written straight to the DOM. Only the sky is React state,
  // and only because it changes about ten times over the whole page rather than every frame.
  const onScroll = useCallback(() => {
    const stage = stageRef.current;
    const flow = flowRef.current;
    if (!stage || !flow) return;

    const vh = window.innerHeight || 1;
    const phase = Math.min(1, Math.max(0, window.scrollY / (vh * EXIT_SCREENS)));
    phaseRef.current = phase;
    const e = smoothstep(phase);

    // The globe's exit: the scene-side half (rotation, dolly) happens in Earth's useFrame.
    const globe = stage.querySelector<HTMLElement>("#globe");
    if (globe) {
      globe.style.transform = `translateY(${-e * 88}%) scale(${1 - e * 0.34})`;
      globe.style.opacity = String(Math.max(0, 1 - Math.max(0, phase - 0.62) / 0.3));
      globe.style.pointerEvents = phase > 0.35 ? "none" : "auto";
    }
    const hero = stage.querySelector<HTMLElement>("#story-hero");
    if (hero) {
      const t = Math.min(1, phase / 0.32);
      hero.style.opacity = String(Math.max(0, 1 - t * 1.15));
      hero.style.transform = `translateY(${-t * 46}px)`;
    }
    const cue = stage.querySelector<HTMLElement>("#story-cue-wrap");
    if (cue) {
      const t = Math.min(1, phase / 0.32);
      cue.style.opacity = String(Math.max(0, 1 - t * 1.6));
      // The cue is the only thing in the pointer-transparent stage that can be clicked, and
      // only while it is still legible.
      cue.style.pointerEvents = t > 0.4 ? "none" : "auto";
    }
    const island = stage.querySelector<HTMLElement>("#island-wrap");
    if (island) island.style.opacity = String(Math.max(0, 1 - phase / 0.28));
    setHeroActive(phase < 0.04);

    // The way back to the globe, once it is properly gone.
    const back = document.getElementById("story-return");
    if (back) {
      const shown = phase > 0.86;
      back.style.opacity = shown ? "1" : "0";
      back.style.transform = shown ? "none" : "translateY(-8px)";
      back.style.pointerEvents = shown ? "auto" : "none";
    }

    runReveals(revealsRef.current, vh);
    runTypers(typersRef.current, vh, typeTimersRef.current);

    // Whichever section has crossed the sky line owns the palette. The last section can be
    // shorter than the line is deep, so the very bottom of the scroll always claims it.
    const line = vh * SKY_LINE;
    const nodes = flow.querySelectorAll<HTMLElement>("[data-sky]");
    let next = -1;
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      if (el && el.getBoundingClientRect().top <= line) next = i;
      else break;
    }
    const atEnd = window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 4;
    if (atEnd) next = nodes.length - 1;
    setSkyIndex(next);
  }, []);

  // rAF-throttled: scroll can fire far more often than the compositor paints, and this
  // handler both reads layout and writes styles.
  useEffect(() => {
    let queued = false;
    const handler = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        onScroll();
      });
    };
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler);
      window.removeEventListener("resize", handler);
    };
  }, [onScroll]);

  // Arm the entrances once the flow's contents exist. Re-runs if the story or its figures
  // change (a hot reload, mainly), and always restores the styles it set so nothing is left
  // stranded at opacity 0.
  useEffect(() => {
    const flow = flowRef.current;
    if (!flow) return;
    const timers = typeTimersRef.current;
    const { pending, restore } = prepareReveals(flow);
    revealsRef.current = pending;
    typersRef.current = prepareTypers(flow);
    const vh = window.innerHeight || 1;
    runReveals(revealsRef.current, vh);
    runTypers(typersRef.current, vh, timers);
    return () => {
      revealsRef.current = [];
      typersRef.current = [];
      for (const t of timers) clearTimeout(t);
      timers.clear();
      restore();
    };
  }, [sections, slotsByKey]);

  // Before the first section claims the screen the page wears the pre-hero night sky.
  const activeSky = skyIndex >= 0 ? (sections[skyIndex]?.sky ?? "#000011") : "#000011";
  const active = useMemo(() => {
    const sky = parseSky(activeSky);
    return { sky, skin: skinFromSky(sky) };
  }, [activeSky]);

  const body = (
    <div
      className="story"
      style={{
        backgroundColor: activeSky,
        colorScheme: active.skin.dark ? "dark" : "light",
        ...(skinToCssVars(active.sky, active.skin) as CSSProperties),
      }}
    >
      <div id="story-stage" ref={stageRef}>
        <GlobeStage phaseRef={phaseRef} />
        <div id="story-hero">
          <h1>Every flash is a death.</h1>
        </div>
        <div id="story-cue-wrap">
          {/* The cue is the invitation to start reading, so it does what it invites. */}
          <button
            type="button"
            className="story-cue"
            onClick={() => window.scrollTo({ top: window.innerHeight * 1.05, behavior: "smooth" })}
          >
            What? <span aria-hidden="true">↓</span>
          </button>
        </div>
      </div>

      {/* Zero-height sticky strip so the button hangs over the story without reserving space. */}
      <div id="story-return-rail">
        <button
          type="button"
          id="story-return"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <MiniEarth />
          Globe
        </button>
      </div>

      <div id="story-flow" ref={flowRef}>
        {sections.map((section) => {
          const isChapter = section.heading === "chapter" || section.heading === "chapter-small";
          const title = section.heading !== "hidden" && (
            <h2
              className={
                CHAPTER_CLASS[section.heading] +
                (section.heading === "chapter" && section.label.length <= SHORT_CHAPTER
                  ? " story-chapter-wide"
                  : "")
              }
            >
              {section.label}
            </h2>
          );
          return (
            <Section key={section.key} sky={section.sky} screenLabel={section.screenLabel}>
              {/* A chapter takes its own screen: the title and the line under it are centred
                  together in it, rather than the title standing alone above the prose. */}
              {isChapter ? (
                <div className="story-chapter-block">
                  {title}
                  {section.subtitle && <p className="story-chapter-sub">{section.subtitle}</p>}
                </div>
              ) : (
                title
              )}
              <RoadmapMarkdown source={section.body} slots={slotsByKey[section.key]} />
            </Section>
          );
        })}
      </div>
    </div>
  );

  return (
    <SkinProvider value={active}>
      <ProxyGuessProvider>{body}</ProxyGuessProvider>
    </SkinProvider>
  );
}
