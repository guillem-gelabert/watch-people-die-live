"use client";

import { useDartTally } from "./dartTallyState";

// What each bucket means, spelled out for the two that need it. "Ocean" explains itself.
const DEFINITIONS: Record<string, string | undefined> = {
  Uninhabited:
    "Land with no populated cell in the 0.5° grid the model samples — about 55 km across.",
  Inhabited: "Land with at least one populated cell in the grid, however sparsely.",
};

// The running score of the dart map above: of every death placed at a uniformly random point on
// Earth, where did it actually land? The arrow shows what the running count is converging to,
// sampled from the same two tests the map classifies with.
export default function DartTally() {
  const tally = useDartTally();
  const rows = [
    { label: "Ocean", count: tally.ocean, limit: tally.limits?.ocean },
    { label: "Uninhabited", count: tally.uninhabited, limit: tally.limits?.uninhabited },
    { label: "Inhabited", count: tally.inhabited, limit: tally.limits?.inhabited },
  ];
  const total = tally.ocean + tally.uninhabited + tally.inhabited;

  return (
    <div className="dart-tally">
      {rows.map((row) => {
        const share = total ? Math.round((row.count / total) * 100) : 0;
        const definition = DEFINITIONS[row.label];
        // One sentence per tile for assistive tech: read in the order it means something,
        // rather than as three loose numbers in visual order.
        const spoken = total
          ? `${row.label}: ${row.count} of ${total} deaths, ${share} per cent` +
            (row.limit != null ? `, converging to ${row.limit} per cent` : "")
          : `${row.label}: counting`;
        return (
          <div className="dart-tally-cell" key={row.label} aria-label={spoken} role="group">
            <span className="dart-tally-count" aria-hidden="true">
              {row.count}
            </span>
            <span className="dart-tally-share" aria-hidden="true">
              {total ? `${share}%` : "—"}
              {row.limit != null && total ? ` → ${row.limit}%` : ""}
            </span>
            {definition ? (
              <abbr className="dart-tally-label" title={definition}>
                {row.label}
              </abbr>
            ) : (
              <span className="dart-tally-label">{row.label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
