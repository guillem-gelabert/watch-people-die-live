"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GlobeStage from "../globe/GlobeStage";
import { setHeroActive } from "../globe/stageState";
import { smoothstep } from "../globe/helpers";
import Section from "./Section";
import { parseSky, skinFromSky } from "./palette";
import RoadmapMarkdown, { roadmapSections } from "./roadmapMarkdown";
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

export default function StoryClient({ markdown }: StoryClientProps) {
  const sections = useMemo(() => roadmapSections(markdown), [markdown]);
  const slotsByKey = useStorySlots();
  const [skyIndex, setSkyIndex] = useState(0);
  const phaseRef = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);

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
    setHeroActive(phase < 0.04);

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

  // Before the first section claims the screen the page wears the pre-hero night sky.
  const activeSky = skyIndex >= 0 ? (sections[skyIndex]?.sky ?? "#000011") : "#000011";
  const activeSkin = skinFromSky(parseSky(activeSky));

  return (
    <div
      className="story"
      style={{ backgroundColor: activeSky, colorScheme: activeSkin.dark ? "dark" : "light" }}
    >
      <div id="story-stage" ref={stageRef}>
        <GlobeStage phaseRef={phaseRef} />
        <div id="story-hero">
          <h1>
            Every flash
            <br />
            is a death.
          </h1>
          <p className="story-cue" aria-hidden="true">
            What? <span>↓</span>
          </p>
        </div>
      </div>

      <div id="story-flow" ref={flowRef}>
        {sections.map((section) => (
          <Section key={section.key} sky={section.sky} label={section.label}>
            <h2 className="story-chapter">{section.label}</h2>
            <RoadmapMarkdown source={section.body} slots={slotsByKey[section.key]} />
          </Section>
        ))}
      </div>
    </div>
  );
}
