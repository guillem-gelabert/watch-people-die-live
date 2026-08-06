"use client";

import type { ReactNode } from "react";

interface SectionProps {
  sky: string;
  screenLabel: string;
  children: ReactNode;
}

// One chapter of the story. The section only declares its sky; the resolved palette lives on
// the scroll container, because the design themes everything to the section currently in
// view rather than to each section's own colour — that way a neighbour halfway on screen
// during a transition never clashes with the one being read.
export default function Section({ sky, screenLabel, children }: SectionProps) {
  return (
    <section className="story-section" data-screen-label={screenLabel} data-sky={sky}>
      {children}
    </section>
  );
}
