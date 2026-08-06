"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type ScreenReaderInstructions,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import ProxyStrip from "./ProxyStrip";
import type { ProxyDef } from "./proxyDefs";
import { useDict } from "../I18nContext";
import { fill } from "@/lib/i18n/fill";
import { prefersReducedMotion } from "../storyMotion";

interface SortableProxyListProps {
  order: number[];
  setOrder: React.Dispatch<React.SetStateAction<number[]>>;
  defsByIndex: Map<number, ProxyDef>;
  colors: string[];
  onDraggingChange: (dragging: boolean) => void;
}

// A pointer has to travel this far before the row starts following it, so a tap on the ⓘ or a
// scroll that begins on a row is not read as the start of a drag.
const DRAG_ACTIVATION_DISTANCE = 4;

// One row. dnd-kit owns its transform; everything else about how a strip looks is the strip's own.
function SortableRow({ def, color, rank }: { def: ProxyDef; color: string; rank: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: def.index,
  });

  return (
    <ProxyStrip
      def={def}
      color={color}
      rank={rank}
      progress={1}
      controlsShown
      inModal
      dragRef={setNodeRef}
      dragProps={{ ...attributes, ...listeners }}
      isDragging={isDragging}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        // The carried row has to sit over the ones sliding out of its way, and the lift is what
        // says it left the stack rather than just moved inside it.
        ...(isDragging
          ? { zIndex: 3, boxShadow: "0 10px 24px rgba(20,16,26,.32)", scale: "1.03" }
          : null),
      }}
    />
  );
}

// The five candidates as a keyboard- and pointer-sortable list. dnd-kit replaces the hand-rolled
// pointer maths this used to carry: it brings the keyboard affordance (grab with space, move with
// the arrows) and the live-region announcements with it, which the two sr-only nudge buttons only
// ever half-approximated.
export default function SortableProxyList({
  order,
  setOrder,
  defsByIndex,
  colors,
  onDraggingChange,
}: SortableProxyListProps) {
  const boxesRef = useRef<HTMLDivElement | null>(null);
  const d = useDict();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const titleOf = (id: number | string) => defsByIndex.get(Number(id))?.title ?? String(id);
  const positionOf = (id: number | string) => order.indexOf(Number(id)) + 1;

  const screenReaderInstructions: ScreenReaderInstructions = {
    draggable: d.proxy.dnd.instructions,
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      fill(d.proxy.dnd.pickedUp, {
        title: titleOf(active.id),
        rank: positionOf(active.id),
        total: order.length,
      }),
    onDragOver: ({ active, over }) =>
      over
        ? fill(d.proxy.dnd.over, { title: titleOf(active.id), rank: positionOf(over.id) })
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? fill(d.proxy.dnd.dropped, {
            title: titleOf(active.id),
            rank: positionOf(over.id),
            total: order.length,
          })
        : fill(d.proxy.dnd.cancelled, { title: titleOf(active.id) }),
    onDragCancel: ({ active }) => fill(d.proxy.dnd.cancelled, { title: titleOf(active.id) }),
  };

  // One visible shuffle shortly after opening: the rows are draggable, and nothing else on the page
  // has been, so the affordance has to be demonstrated rather than described. It animates the
  // `translate` property rather than `transform`, which is dnd-kit's — the two compose instead of
  // one clobbering the other.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const boxes = boxesRef.current;
    if (!boxes) return;
    const strips = [...boxes.querySelectorAll<HTMLElement>(".proxy-strip")];
    if (strips.length < 2) return;
    const pitch = strips[1]!.getBoundingClientRect().top - strips[0]!.getBoundingClientRect().top;
    const offsets = [1, -1, 0, 1, -1];
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(
      setTimeout(() => {
        strips.forEach((el, i) => {
          el.style.transition = "translate .54s cubic-bezier(.22,1,.36,1)";
          el.style.translate = `0 ${(offsets[i] ?? 0) * pitch}px`;
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
  }, []);

  const rows = useMemo(
    () =>
      order.map((proxyIndex, position) => ({
        def: defsByIndex.get(proxyIndex)!,
        color: colors[proxyIndex % colors.length] as string,
        rank: position + 1,
      })),
    [order, defsByIndex, colors],
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    onDraggingChange(false);
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const from = prev.indexOf(Number(active.id));
      const to = prev.indexOf(Number(over.id));
      if (from < 0 || to < 0) return prev;
      return arrayMove(prev, from, to);
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      accessibility={{ announcements, screenReaderInstructions }}
      onDragStart={() => onDraggingChange(true)}
      onDragEnd={onDragEnd}
      onDragCancel={() => onDraggingChange(false)}
    >
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <div className="proxy-boxes" ref={boxesRef}>
          {rows.map((row) => (
            <SortableRow key={row.def.index} def={row.def} color={row.color} rank={row.rank} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
