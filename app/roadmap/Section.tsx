"use client";

import { useMemo } from "react";
import type { CSSProperties, ReactNode } from "react";
import { parseSky, skinFromSky, skinToCssVars } from "./palette";

interface SectionProps {
  sky: string;
  label: string;
  children: ReactNode;
}

// One screen of the story. The section resolves its own sky into the full skin and puts it
// on the element as custom properties, so every descendant — prose, panels, and the chart
// classes roadmap.css already scopes — reads the palette straight off the cascade. This is
// the alternative the handoff offers to its runtime canvas-context proxy, and it fits here
// because our figures are SVG styled by classes rather than canvas drawn with literals.
export default function Section({ sky, label, children }: SectionProps) {
  const style = useMemo(() => skinToCssVars(parseSky(sky), skinFromSky(parseSky(sky))), [sky]);

  return (
    <section
      className="story-section"
      data-screen-label={label}
      data-sky={sky}
      style={style as CSSProperties}
    >
      {children}
    </section>
  );
}
