// Tapping a chart on a phone, where hovering a dot is not available and the dots are 6px wide.
//
// Every scatter in the story hangs its tooltip off per-dot `pointermove`, which is exact with a
// mouse and useless with a thumb: measured at 390px, 92-100% of the points in every scatter have
// at least one rival inside a 44px target, and the dense ones have a mean of 34 to 116 rivals with
// worst clumps of 68 to 223. So a tap cannot mean "the dot under my finger" — there is no such dot.
//
// It means "the nearest candidate", and which points are candidates is the chart's decision:
//
//   - Where the cloud is sparse enough that the nearest point is the one the reader aimed at, every
//     point is a candidate and the radius is a thumb's width.
//   - Where it is not, the chart passes a curated handful — the countries its own prose names —
//     drawn with permanent labels, and the radius is unbounded. A tap then lands on the nearest
//     labelled point, which is a Voronoi cell over the representatives without drawing one: the
//     reader can see the targets, so being given one they did not precisely hit is not a lottery.
//
// Whichever it is, the chosen point is ringed as the tooltip opens. A tooltip that names a point
// without saying which one would be worse than no tooltip, because the reader would trust it.
import * as d3 from "d3";
import { hideTooltip, showTooltip } from "../tooltip";

export interface PickCandidate {
  // Position in the plot group's own coordinates, which is what the tap is measured against.
  x: number;
  y: number;
  // How far this candidate may be from a tap and still win, overriding the picker's own radius.
  // The two rules a chart needs live here rather than in two pickers: its country dots take the
  // default thumb radius, and its labelled representatives take Infinity, so a tap near a dot gets
  // that dot and a tap in open space falls through to the nearest labelled point.
  reach?: number;
}

// A thumb is about 44px across, so the nearest point within half of that is the one it was aimed
// at. Only used by the charts that pass every point as a candidate.
export const TAP_RADIUS = 22;

// The nearest candidate to a tap, or null if the nearest is further than `radius`. Ties go to the
// earlier candidate, so a chart's own order decides and the pick is stable across taps.
export function nearestWithin<T extends PickCandidate>(
  candidates: readonly T[],
  x: number,
  y: number,
  radius = TAP_RADIUS,
): T | null {
  let best: T | null = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = Math.hypot(candidate.x - x, candidate.y - y);
    if (distance < bestDistance && distance <= (candidate.reach ?? radius)) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

// What a tap does to what is already open. Tapping the point that is already showing closes it,
// which is the only dismiss path a touch reader has: `hideTooltip` hangs off `pointerleave`, and a
// finger never produces one.
export function tapOutcome<T>(shown: T | null, picked: T | null): { shown: T | null } {
  if (picked === null) return { shown: null };
  if (shown === picked) return { shown: null };
  return { shown: picked };
}

// True on a device that cannot hover. The picker is attached only here, so a mouse keeps the exact
// per-dot behaviour it always had and there is no second code path competing for its events.
export function isTouchOnly(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(hover: none)").matches === true;
}

interface PickerOptions<T extends PickCandidate> {
  width: number;
  height: number;
  candidates: readonly T[];
  // Omit for the curated charts: the nearest representative wins however far away it is.
  radius?: number;
  describe: (candidate: T) => string;
}

// Puts a transparent tap surface over the plot and rings whatever it picks. No-op on a hover
// device, and no-op with nothing to pick.
export function attachTapPicker<T extends PickCandidate>(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  { width, height, candidates, radius = TAP_RADIUS, describe }: PickerOptions<T>,
): void {
  if (!isTouchOnly() || candidates.length === 0) return;

  const marker = g
    .append("circle")
    .attr("class", "chart-tap-marker")
    .attr("r", 7)
    .attr("fill", "none")
    .attr("opacity", 0)
    .style("pointer-events", "none");

  let shown: T | null = null;

  g.append("rect")
    .attr("class", "chart-tap-surface")
    .attr("width", Math.max(0, width))
    .attr("height", Math.max(0, height))
    .attr("fill", "transparent")
    .style("touch-action", "manipulation")
    .on("pointerup", (event: PointerEvent) => {
      // d3.pointer inverts the group's own screen CTM, so the margins' translate and the viewBox's
      // scale to the rendered width are both already accounted for.
      const [localX, localY] = d3.pointer(event, g.node());
      const picked = nearestWithin(candidates, localX, localY, radius);
      const next = tapOutcome(shown, picked).shown;
      shown = next;
      if (!next) {
        marker.attr("opacity", 0);
        hideTooltip();
        return;
      }
      marker.attr("cx", next.x).attr("cy", next.y).attr("opacity", 1);
      // Positioned at the point rather than at the finger, so the tooltip and the ring agree about
      // which dot is being described.
      const node = g.node() as SVGGElement;
      const ctm = node.getScreenCTM();
      const at = ctm
        ? new DOMPoint(next.x, next.y).matrixTransform(ctm)
        : { x: event.clientX, y: event.clientY };
      showTooltip(describe(next), at.x, at.y);
    });
}
