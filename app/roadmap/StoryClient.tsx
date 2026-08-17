"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import GlobeStage from "../globe/GlobeStage";
import { setHeroActive } from "../globe/stageState";
import MiniEarth from "./MiniEarth";
import Section from "./Section";
import { parseSky, skinFromSky, skinToCssVars } from "./palette";
import { SkinProvider } from "./SkinContext";
import { useI18n } from "./I18nContext";
import LanguageSwitcher from "./LanguageSwitcher";
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

// Rendered under I18nProvider (see app/page.tsx), not around it: useStorySlots() reads the
// dictionary through the context, and a provider rendered *by* this component would be below
// the hook that needs it — which is exactly how every chart panel briefly stayed in English.
export default function StoryClient({ markdown }: StoryClientProps) {
  const { locale, d: dictionary } = useI18n();
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

    // The globe's exit: the tip-away rotation in Earth's useFrame, the stage scrolling off the top
    // like anything else, and this fade. It never moves under the reader and never shrinks — the
    // fade is on top of the scroll, so the globe is already thinning out by the time its lower limb
    // reaches the top of the screen. Releasing the pointer matters too: the canvas sets
    // `touch-action: none` for OrbitControls, so a drag on a half-scrolled globe would rotate it
    // instead of carrying on with the scroll.
    const globe = stage.querySelector<HTMLElement>("#globe");
    if (globe) {
      globe.style.opacity = String(Math.max(0, 1 - Math.max(0, phase - 0.62) / 0.3));
      globe.style.pointerEvents = phase > 0.35 ? "none" : "auto";
    }

    // The hero line is deliberately not touched here. It used to fade and lift on scroll, from when
    // the stage was pinned and the copy had to be taken off a globe that stayed put; now the whole
    // stage scrolls away, so it leaves on its own, and fading it as well read as the words
    // dissolving before the reader had left them.
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

  // The sections are built once and reused across sky changes. They do not depend on the active sky
  // — each only declares its own, and the palette reaches the figures through SkinContext and CSS
  // variables — so rebuilding this tree ten times a page was rebuilding every section's markdown
  // and every figure's element tree to change one background colour. That was ~100ms of main thread
  // per sky change, landing as a stutter in the globe exactly as the cross-fade started. Held apart
  // like this, a sky change re-renders only what actually reads the skin.
  const flow = useMemo(
    () =>
      sections.map((section) => {
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
      }),
    [sections, slotsByKey],
  );

  const body = (
    // No background here: --sky (from skinToCssVars) carries the colour and roadmap.css paints
    // .story from it, so the sky is one declaration rather than an inline style competing with a
    // stylesheet.
    <div
      className="story"
      // The prose is justified, so it is hyphenated, and a browser only hyphenates text whose
      // language it knows. I18nProvider does set document.documentElement.lang, but from an
      // effect — too late for the first paint, which would set every language with English
      // hyphenation rules and then reflow. Declaring it on the story itself puts the right
      // language in the server-rendered markup, where the first line break is decided.
      lang={locale}
      style={{
        colorScheme: active.skin.dark ? "dark" : "light",
        ...(skinToCssVars(active.sky, active.skin) as CSSProperties),
      }}
    >
      <LanguageSwitcher />

      <div id="story-stage" ref={stageRef}>
        <GlobeStage phaseRef={phaseRef} />
        {/* Hero line and cue in one box: transparent, over the globe's lower edge, and the only
            thing in the stage that takes a gesture — see #story-hero for why. */}
        <div id="story-hero">
          <h1>{dictionary.chrome.hero}</h1>
          <div id="story-cue-wrap">
            {/* The cue is the invitation to start reading, so it does what it invites. */}
            <button
              type="button"
              className="story-cue"
              onClick={() =>
                window.scrollTo({ top: window.innerHeight * 1.05, behavior: "smooth" })
              }
            >
              {dictionary.chrome.cue} <span aria-hidden="true">↓</span>
            </button>
          </div>
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
          {dictionary.chrome.globe}
        </button>
      </div>

      {/* <main> rather than a div, and this is the only landmark on the page: the story had none,
          so "skip to the content" had nothing to skip to and a screen reader's landmark list was
          empty on a page that is 24,000px of content. The flow is the right element to carry it —
          the stage above is the globe and the title, the rail is a way back to them, and this is
          everything a reader came to read. */}
      <main id="story-flow" ref={flowRef}>
        {flow}
      </main>
    </div>
  );

  return (
    <SkinProvider value={active}>
      <ProxyGuessProvider>{body}</ProxyGuessProvider>
    </SkinProvider>
  );
}
