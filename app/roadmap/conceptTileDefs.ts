// The asides that close the "Who" and conflicts sections: three cards each, every one a short
// answer to a question the section raised but did not stop to settle.
//
// The copy sits here rather than in docs/ROADMAP.md for the same reason the proxy write-ups do
// (see proxyDefs.ts) — a tile is a kind, a title and a body, and that structure survives better as
// data than as a markdown convention the renderer would have to learn.
export interface ConceptTile {
  id: string;
  // "Method", "Why it failed", "Concept" — what kind of aside this is, not what it says.
  kind: string;
  title: string;
  body: string;
}

export const CONCEPT_TILE_SETS: Record<string, ConceptTile[]> = {
  clock: [
    {
      id: "one-global-clock",
      kind: "Method",
      title: "One global clock",
      body:
        "Total deaths per year become a rate per second. Each interval is drawn from an " +
        "exponential distribution, so bursts and gaps happen for the same reason they do in " +
        "reality.",
    },
    {
      id: "deaths-in-the-ocean",
      kind: "Why it failed",
      title: "Deaths in the ocean",
      body:
        "A uniform point on a sphere puts seven in ten deaths in water and most of the rest in " +
        "empty land. Right total, meaningless map.",
    },
    {
      id: "poisson-process",
      kind: "Concept",
      title: "Poisson process",
      body:
        "Independent events, exponential waiting times. This is why the rhythm looks broken and " +
        "is not.",
    },
  ],
  rate: [
    {
      id: "rate-relative-to-the-global-mean",
      kind: "Method",
      title: "Rate relative to the global mean",
      body:
        "Each country's rate becomes a multiplier on the global mean, so weights stay comparable " +
        "across borders and every national total stays exact.",
    },
    {
      id: "crude-really-means-crude",
      kind: "What I learned",
      title: "Crude really means crude",
      body:
        "The number is dominated by age structure. It says almost nothing about how good a " +
        "country's healthcare is.",
    },
    {
      id: "why-a-cartogram",
      kind: "Map",
      title: "Why a cartogram",
      body:
        "Area-true maps make Russia and Canada shout and Bangladesh disappear. Equal-area " +
        "hexagons give every place the same voice.",
    },
  ],
};
