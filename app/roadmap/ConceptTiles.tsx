"use client";

import { useState } from "react";

import { CONCEPT_TILE_SETS } from "./conceptTileDefs";

interface ConceptTilesProps {
  // Which of the two sets to show — see conceptTileDefs.ts.
  set: keyof typeof CONCEPT_TILE_SETS | string;
}

// A two-column grid of expandable asides. Closed, the three read as a contents list for what the
// section chose not to spell out; opening one gives it the full width of the grid and dims the
// other two, so the row never grows taller than the card being read.
//
// The head is the button and the body is its sibling, rather than the design's single button
// wrapping both: a collapsed body inside the button would be read out as part of the button's own
// label. Closed bodies are `inert`, so only the visible card is reachable.
export default function ConceptTiles({ set }: ConceptTilesProps) {
  const [open, setOpen] = useState<string | null>(null);
  const items = CONCEPT_TILE_SETS[set];

  if (!items) return null;

  return (
    <div className="concept-tiles" data-any-open={open ? "" : undefined}>
      {items.map((item) => {
        const isOpen = open === item.id;
        return (
          <div className="concept-tile" key={item.id} data-open={isOpen ? "" : undefined}>
            <button
              type="button"
              className="concept-tile-head"
              aria-expanded={isOpen}
              aria-controls={`concept-tile-${item.id}`}
              onClick={() => setOpen(isOpen ? null : item.id)}
            >
              <span className="concept-tile-kind">{item.kind}</span>
              <span className="concept-tile-title">{item.title}</span>
              <span className="concept-tile-plus" aria-hidden="true">
                +
              </span>
            </button>
            <div className="concept-tile-body" id={`concept-tile-${item.id}`} inert={!isOpen}>
              {/* The clip has to be the grid item and carry no padding of its own: padding cannot
                  be collapsed away, so a padded item would hold the closed row open. */}
              <div className="concept-tile-clip">
                <p className="concept-tile-copy">{item.body}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
