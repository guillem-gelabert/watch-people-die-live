"use client";

import { useDict } from "../I18nContext";
import { hideTooltip, moveTooltip, showTooltip } from "../tooltip";
import { fill } from "@/lib/i18n/fill";
import { useDartTally } from "./dartTallyState";

// The running score of the dart map above: of every death placed at a uniformly random point on
// Earth, where did it actually land? The arrow shows what the running count is converging to,
// sampled from the same two tests the map classifies with.
export default function DartTally() {
  const tally = useDartTally();
  const t = useDict().charts.dartTally;
  // "Ocean" explains itself; the other two need a sentence, so only they carry one.
  const rows = [
    { key: "ocean", label: t.ocean, count: tally.ocean, limit: tally.limits?.ocean },
    {
      key: "uninhabited",
      label: t.uninhabited,
      definition: t.uninhabitedNote,
      count: tally.uninhabited,
      limit: tally.limits?.uninhabited,
    },
    {
      key: "inhabited",
      label: t.inhabited,
      definition: t.inhabitedNote,
      count: tally.inhabited,
      limit: tally.limits?.inhabited,
    },
  ];
  const total = tally.ocean + tally.uninhabited + tally.inhabited;

  return (
    <div className="dart-tally">
      {rows.map((row) => {
        const share = total ? Math.round((row.count / total) * 100) : 0;
        // One sentence per tile for assistive tech: read in the order it means something,
        // rather than as three loose numbers in visual order.
        const spoken = total
          ? fill(t.spoken, { label: row.label, count: row.count, total, share }) +
            (row.limit != null ? fill(t.spokenLimit, { limit: row.limit }) : "")
          : fill(t.counting, { label: row.label });
        return (
          <div className="dart-tally-cell" key={row.key} aria-label={spoken} role="group">
            <span className="dart-tally-count" aria-hidden="true">
              {row.count}
            </span>
            <span className="dart-tally-share" aria-hidden="true">
              {total ? `${share}%` : "\u2014"}
              {row.limit != null && total ? ` \u2192 ${row.limit}%` : ""}
            </span>
            {row.definition ? (
              <button
                type="button"
                className="dart-tally-label has-definition"
                aria-label={`${row.label}: ${row.definition}`}
                onPointerEnter={(event) =>
                  showTooltip(row.definition, event.clientX, event.clientY)
                }
                onPointerMove={(event) => moveTooltip(event.clientX, event.clientY)}
                onPointerLeave={(event) => {
                  if (event.pointerType !== "touch") hideTooltip();
                }}
                onFocus={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  showTooltip(row.definition, rect.left + rect.width / 2, rect.bottom);
                }}
                onClick={(event) => {
                  event.currentTarget.focus();
                  const rect = event.currentTarget.getBoundingClientRect();
                  showTooltip(row.definition, rect.left + rect.width / 2, rect.bottom);
                }}
                onBlur={hideTooltip}
                onKeyDown={(event) => {
                  if (event.key === "Escape") event.currentTarget.blur();
                }}
              >
                {row.label}
              </button>
            ) : (
              <span className="dart-tally-label">{row.label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
