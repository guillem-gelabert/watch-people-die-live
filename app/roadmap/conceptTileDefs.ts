import type { Dictionary } from "@/lib/i18n/en";

// The asides that close the "Who" section: three cards, every one a short answer to a question
// the section raised but did not stop to settle.
//
// The conflicts chapter used to close on a second set of three. It came after the EWMA widget and
// the fatality map had already made the chapter's point, so the row read as a wall the reader had
// to get past rather than as three optional footnotes, and it is gone.
//
// The copy sits in the dictionaries rather than in docs/ROADMAP.md for the same reason the proxy
// write-ups do (see proxyDefs.ts) — a tile is a kind, a title and a body, and that structure
// survives better as data than as a markdown convention the renderer would have to learn.
export interface ConceptTile {
  id: string;
  // "Method", "Why it failed", "Concept" — what kind of aside this is, not what it says.
  kind: string;
  title: string;
  body: string;
}

// Stable ids, so the open/closed state and the aria wiring do not depend on the language.
const CLOCK_IDS = ["one-global-clock", "deaths-in-the-ocean", "poisson-process"];

export function conceptTiles(d: Dictionary, set: string): ConceptTile[] | null {
  if (set !== "clock") return null;
  return d.concept.clock.map((tile, i) => ({ id: CLOCK_IDS[i] ?? String(i), ...tile }));
}
