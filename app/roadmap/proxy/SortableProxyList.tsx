"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ReactSortable, type ItemInterface } from "react-sortablejs";

import { prefersReducedMotion } from "../storyMotion";
import { useDict } from "../I18nContext";
import { fill } from "@/lib/i18n/fill";
import ProxyStrip from "./ProxyStrip";
import type { ProxyDef } from "./proxyDefs";

interface SortableProxyListProps {
  order: number[];
  setOrder: React.Dispatch<React.SetStateAction<number[]>>;
  defsByIndex: Map<number, ProxyDef>;
  colors: string[];
  onDraggingChange: (dragging: boolean) => void;
}

interface SortableProxyItem extends ItemInterface {
  id: number;
}

// A touch must settle briefly before it becomes a drag, so an attempted scroll or an ⓘ tap is not
// treated as a reordered proxy.
const TOUCH_DELAY_MS = 120;

// Neither of the strip's own controls may start a drag: one reads the case for a proxy and two
// move it, and all three are things you press rather than things you carry.
const NOT_A_DRAG_HANDLE = ".proxy-strip-info, .proxy-strip-move";

// The five candidates are a controlled `react-sortablejs` list. SortableJS owns pointer and touch
// movement; React continues to own the canonical proxy-index order that the scorecard consumes.
export default function SortableProxyList({
  order,
  setOrder,
  defsByIndex,
  colors,
  onDraggingChange,
}: SortableProxyListProps) {
  const boxesRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = prefersReducedMotion();
  const list = useMemo<SortableProxyItem[]>(() => order.map((id) => ({ id })), [order]);
  const d = useDict();
  const instructionsId = useId();
  // What the live region last said. SortableJS reorders the DOM under a pointer and says nothing,
  // and the nudge buttons move a row the presser cannot see — either way the only report of what
  // just happened is this line.
  const [announcement, setAnnouncement] = useState("");

  const announce = useCallback(
    (id: number, rank: number) =>
      setAnnouncement(
        fill(d.proxy.dnd.dropped, {
          title: defsByIndex.get(id)?.title ?? String(id),
          rank,
          total: order.length,
        }),
      ),
    [d, defsByIndex, order.length],
  );

  // One place up or down. Clamped rather than wrapped: the ends of a ranking are meaningful, and
  // a proxy that fell off the bottom and reappeared at the top would be a different claim.
  const move = useCallback(
    (id: number, direction: -1 | 1) => {
      const from = order.indexOf(id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= order.length) return;
      const next = [...order];
      next.splice(from, 1);
      next.splice(to, 0, id);
      setOrder(next);
      announce(id, to + 1);
    },
    [order, setOrder, announce],
  );

  // One visible shuffle shortly after opening demonstrates that the rows move. `translate` is
  // separate from the transform SortableJS applies while dragging, so the two do not clobber.
  useEffect(() => {
    if (reduceMotion) return;
    const boxes = boxesRef.current;
    if (!boxes) return;
    const strips = [...boxes.querySelectorAll<HTMLElement>(".proxy-strip")];
    if (strips.length < 2) return;
    const pitch = strips[1]!.getBoundingClientRect().top - strips[0]!.getBoundingClientRect().top;
    const offsets = [1, -1, 0, 1, -1];
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(
      setTimeout(() => {
        strips.forEach((el, index) => {
          el.style.transition = "translate .54s cubic-bezier(.22,1,.36,1)";
          el.style.translate = `0 ${(offsets[index] ?? 0) * pitch}px`;
        });
      }, 700),
    );
    timers.push(
      setTimeout(() => {
        strips.forEach((el) => (el.style.translate = "0 0"));
      }, 790),
    );
    timers.push(
      setTimeout(() => {
        strips.forEach((el) => {
          el.style.transition = "";
          el.style.translate = "";
        });
      }, 1430),
    );
    return () => timers.forEach(clearTimeout);
  }, [reduceMotion]);

  const setList = useCallback(
    (next: SortableProxyItem[]) => setOrder(next.map((item) => item.id)),
    [setOrder],
  );

  return (
    // The group, its name and its instructions live on this wrapper rather than on the list
    // itself: ReactSortable does not forward arbitrary aria props to the element it renders.
    <div
      ref={boxesRef}
      role="group"
      aria-labelledby="proxy-modal-heading"
      aria-describedby={instructionsId}
    >
      <ReactSortable
        list={list}
        setList={setList}
        className="proxy-boxes"
        direction="vertical"
        animation={reduceMotion ? 0 : 200}
        delayOnTouchOnly
        delay={TOUCH_DELAY_MS}
        touchStartThreshold={4}
        filter={NOT_A_DRAG_HANDLE}
        preventOnFilter={false}
        chosenClass="proxy-sortable-chosen"
        ghostClass="proxy-sortable-ghost"
        dragClass="proxy-sortable-drag"
        onStart={() => onDraggingChange(true)}
        onEnd={(event) => {
          onDraggingChange(false);
          const id = list[event.oldIndex ?? -1]?.id;
          if (id != null && event.newIndex != null && event.newIndex !== event.oldIndex) {
            announce(id, event.newIndex + 1);
          }
        }}
      >
        {list.map((item, position) => {
          const def = defsByIndex.get(item.id)!;
          return (
            <ProxyStrip
              key={item.id}
              def={def}
              color={colors[item.id % colors.length] as string}
              rank={position + 1}
              progress={1}
              controlsShown
              inModal
              onMove={(direction) => move(item.id, direction)}
              canMoveUp={position > 0}
              canMoveDown={position < list.length - 1}
            />
          );
        })}
      </ReactSortable>
      <p className="sr-only" id={instructionsId}>
        {d.proxy.dnd.instructions}
      </p>
      {/* Polite, and outside the sortable container so SortableJS's DOM shuffling cannot move or
          re-create the node mid-announcement. */}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
