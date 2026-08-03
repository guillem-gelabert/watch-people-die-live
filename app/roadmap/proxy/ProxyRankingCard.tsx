"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSkin } from "../SkinContext";
import { proxyColors } from "../palette";
import { prefersReducedMotion } from "../storyMotion";
import ProxyStrip from "./ProxyStrip";
import { PROXY_DEFS, PROXY_MODAL_COPY } from "./proxyDefs";
import { useProxyGuess } from "./ProxyGuessContext";
import { FOLDED_HEIGHT, stripStyle, useProxyFold } from "./useProxyFold";

// The stack is taller than the card so the sticky card has somewhere to travel while the strips
// fold: roughly half a screen per strip, plus a little run-out at the end.
const SCREENS_PER_STRIP = 0.55;
const RUN_OUT = 0.22;

// A natural (unfolded) strip height, used before the real one has been measured. Only matters for
// the first frame.
const ASSUMED_NATURAL = 210;

// Records where every strip is now and returns the function that, once the list has been
// reordered, slides each one from where it was to where it ended up. Without it a reorder is a
// jump cut and the reader has to work out what moved.
function captureStrips(root: HTMLElement, skip?: HTMLElement | null): () => void {
  const before = new Map<HTMLElement, number>();
  for (const el of root.querySelectorAll<HTMLElement>(".proxy-strip")) {
    before.set(el, el.getBoundingClientRect().top);
  }
  return () => {
    for (const [el, previousTop] of before) {
      if (el === skip || !el.isConnected) continue;
      const delta = previousTop - el.getBoundingClientRect().top;
      if (!delta) continue;
      el.style.transition = "none";
      el.style.transform = `translateY(${delta}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform .26s cubic-bezier(.22,1,.36,1)";
        el.style.transform = "translateY(0)";
      });
    }
  };
}

// Before the data: five candidate proxies for a country's seasonal swing, each argued for in its
// own words, folding into a ranking the reader is then asked to commit to. Guessing first is the
// point — the five charts that follow are the answer, and they land differently once you have
// staked something on them.
export default function ProxyRankingCard() {
  const { skin, sky } = useSkin();
  const { submit, spent, markSpent } = useProxyGuess();
  const [order, setOrder] = useState<number[]>(() => PROXY_DEFS.map((d) => d.index));
  const [modalOpen, setModalOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [stackHeight, setStackHeight] = useState(0);
  // Measured open heights, in state rather than a ref: the fold interpolates towards them, so they
  // are an input to rendering and a change in them has to produce a new frame.
  const [naturalHeights, setNaturalHeights] = useState<number[]>(() =>
    PROXY_DEFS.map(() => ASSUMED_NATURAL),
  );
  const boxesRef = useRef<HTMLDivElement | null>(null);

  // Colour is keyed to a proxy's identity, never to where it currently sits, so reordering the
  // list never repaints a single strip.
  const colors = useMemo(() => proxyColors(sky), [sky]);

  const openModal = useCallback(() => setModalOpen(true), []);
  const { stackRef, fold } = useProxyFold({
    count: PROXY_DEFS.length,
    suspended: modalOpen || dragging,
    onComplete: openModal,
  });

  // The container's height decides how much scroll the fold gets. Measured from the viewport rather
  // than hardcoded, so a short phone and a tall one both get the same number of screens.
  useEffect(() => {
    const resize = () => {
      const vh = window.innerHeight || 1;
      setStackHeight(Math.round(vh * SCREENS_PER_STRIP * PROXY_DEFS.length + vh * RUN_OUT));
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Each strip's open height at this width. The fold interpolates towards it, so it has to be a
  // real number rather than "auto".
  //
  // Measured by opening each strip for one synchronous read rather than by waiting for one to be
  // open on its own: a strip only sits at progress 0 before the reader reaches the card, so a
  // width change afterwards — an orientation flip, a dragged desktop window — would otherwise
  // leave every strip folding towards a height from the old width. Keyed on the width it was
  // measured at, so it happens once per width and not once per frame.
  const measuredWidth = useRef(0);
  useLayoutEffect(() => {
    const boxes = boxesRef.current;
    if (!boxes || modalOpen) return;
    const width = boxes.clientWidth;
    if (!width || width === measuredWidth.current) return;
    measuredWidth.current = width;

    const strips = [...boxes.querySelectorAll<HTMLElement>(".proxy-strip")];
    const next = strips.map((el) => {
      const { height, paddingTop, paddingBottom } = el.style;
      // The write-up is what makes a strip tall, and past the halfway point of its own fold it
      // is display:none — so it has to be put back for the read.
      const body = el.querySelector<HTMLElement>(".proxy-strip-body");
      const bodyDisplay = body?.style.display ?? "";
      const bodyOpacity = body?.style.opacity ?? "";
      if (body) {
        body.style.display = "block";
        body.style.opacity = "0";
      }
      // A folded strip centres its row and clips its title to one line; measured that way a
      // title that wraps when open would come back short.
      const wasFolded = el.dataset.folded;
      el.dataset.folded = "0";
      el.style.height = "auto";
      el.style.paddingTop = "16px";
      el.style.paddingBottom = "17px";
      const natural = el.offsetHeight;
      el.style.height = height;
      el.style.paddingTop = paddingTop;
      el.style.paddingBottom = paddingBottom;
      if (wasFolded === undefined) delete el.dataset.folded;
      else el.dataset.folded = wasFolded;
      if (body) {
        body.style.display = bodyDisplay;
        body.style.opacity = bodyOpacity;
      }
      return natural;
    });
    setNaturalHeights((prev) => (next.every((v, i) => v === prev[i]) ? prev : next));
  }, [modalOpen, fold.progress]);

  // Swapping with a neighbour animates exactly as dragging does. The two are the same operation
  // — one by pointer, one by keyboard — and if only one of them moved, the button would read as
  // a different, lesser control.
  const move = useCallback((proxyIndex: number, direction: -1 | 1) => {
    const boxes = boxesRef.current;
    const flip = boxes ? captureStrips(boxes) : null;
    setOrder((prev) => {
      const at = prev.indexOf(proxyIndex);
      const to = at + direction;
      if (at < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      next.splice(at, 1);
      next.splice(to, 0, proxyIndex);
      return next;
    });
    if (flip) requestAnimationFrame(() => flip());
  }, []);

  const closeModal = useCallback(
    (submitted: boolean) => {
      if (submitted) submit(order);
      else markSpent();
      setModalOpen(false);
    },
    [order, submit, markSpent],
  );

  // Body scroll is locked while the modal is up: it is a decision, not a layer over the story, and
  // the fold behind it must not move under the reader.
  useEffect(() => {
    if (!modalOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [modalOpen]);

  // Escape closes without submitting, like the scrim.
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, closeModal]);

  const defsByIndex = useMemo(() => new Map(PROXY_DEFS.map((d) => [d.index, d])), []);
  const strips = order.map((proxyIndex, position) => ({
    def: defsByIndex.get(proxyIndex)!,
    color: colors[proxyIndex % colors.length] as string,
    rank: position + 1,
    progress: fold.progress[position] ?? 0,
    position,
  }));

  const list = (
    <div className="proxy-boxes" ref={boxesRef}>
      {strips.map((s) => (
        <ProxyStrip
          key={s.def.index}
          def={s.def}
          color={s.color}
          rank={s.rank}
          progress={modalOpen ? 1 : s.progress}
          // The ⓘ and the move buttons arrive when the ranking does — all at once, once every
          // strip has folded — rather than one strip at a time on the way down.
          controlsShown={modalOpen || fold.complete}
          inModal={modalOpen}
          onMove={modalOpen ? (dir) => move(s.def.index, dir) : undefined}
          style={
            modalOpen
              ? undefined
              : stripStyle(
                  s.progress,
                  naturalHeights[s.position] ?? ASSUMED_NATURAL,
                  s.position === 0,
                )
          }
        />
      ))}
    </div>
  );

  return (
    <>
      {/* The stack keeps its height while the card is away in the modal. Dropping it would take
          four viewports of runway out of the document, and the browser would clamp the scroll
          position to the new bottom — so closing the modal would return the reader somewhere
          they had never been. */}
      <div className="proxy-stack" ref={stackRef} style={{ height: `${stackHeight}px` }}>
        <div
          className="proxy-card"
          style={{ background: skin.tileOpen, color: skin.body }}
          data-hidden={modalOpen ? "1" : "0"}
        >
          <div className="proxy-card-title">Potential seasonality proxies</div>
          <div className="proxy-rail proxy-rail-best" data-shown={fold.complete ? "1" : "0"}>
            <span>Best predictor</span>
            <span className="proxy-rail-line" />
          </div>
          {modalOpen ? (
            <div
              className="proxy-boxes-placeholder"
              style={{ height: FOLDED_HEIGHT * PROXY_DEFS.length }}
            />
          ) : (
            list
          )}
          <div className="proxy-card-foot">
            {/* The rails fade in with the finished ranking; the reorder button does not, because
                it is how the reader gets back to a modal they have already dismissed. */}
            <div className="proxy-rail proxy-rail-worst" data-shown={fold.complete ? "1" : "0"}>
              <span className="proxy-rail-line" />
              <span>Worst</span>
            </div>
            {spent ? (
              <button
                type="button"
                className="proxy-reorder"
                style={{ background: skin.tile, color: skin.ink }}
                onClick={openModal}
              >
                Reorder the proxies
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {modalOpen ? (
        <ProxyRankModal
          list={list}
          onClose={closeModal}
          reduceMotion={prefersReducedMotion()}
          setDragging={setDragging}
          order={order}
          setOrder={setOrder}
        />
      ) : null}
    </>
  );
}

interface ModalProps {
  list: React.ReactNode;
  onClose: (submitted: boolean) => void;
  reduceMotion: boolean;
  setDragging: (dragging: boolean) => void;
  order: number[];
  setOrder: React.Dispatch<React.SetStateAction<number[]>>;
}

function ProxyRankModal({ list, onClose, reduceMotion, setDragging, order, setOrder }: ModalProps) {
  const { skin } = useSkin();
  const slotRef = useRef<HTMLDivElement | null>(null);

  // One visible shuffle shortly after opening: the rows are draggable, and nothing else on the page
  // has been, so the affordance has to be demonstrated rather than described.
  useEffect(() => {
    if (reduceMotion) return;
    const slot = slotRef.current;
    if (!slot) return;
    const strips = [...slot.querySelectorAll<HTMLElement>(".proxy-strip")];
    if (strips.length < 2) return;
    const pitch = strips[1]!.getBoundingClientRect().top - strips[0]!.getBoundingClientRect().top;
    const offsets = [1, -1, 0, 1, -1];
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(
      setTimeout(() => {
        strips.forEach((el, i) => {
          el.style.transition = "transform .54s cubic-bezier(.22,1,.36,1)";
          el.style.transform = `translateY(${(offsets[i] ?? 0) * pitch}px)`;
        });
      }, 700),
    );
    timers.push(
      setTimeout(() => {
        strips.forEach((el) => (el.style.transform = "translateY(0)"));
      }, 790),
    );
    timers.push(
      setTimeout(() => {
        strips.forEach((el) => {
          el.style.transition = "";
          el.style.transform = "";
        });
      }, 1430),
    );
    return () => timers.forEach(clearTimeout);
  }, [reduceMotion]);

  // Drag to reorder. The dragged row lifts and follows the pointer; whichever row the pointer is
  // over becomes the new position, and the displaced rows slide with a FLIP so the reader can see
  // what their drag is doing to the list rather than only where it ends up.
  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;

    let active: HTMLElement | null = null;
    let startY = 0;
    let fromIndex = -1;

    const stripsNow = () => [...slot.querySelectorAll<HTMLElement>(".proxy-strip")];

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("button")) return;
      const strip = target.closest<HTMLElement>(".proxy-strip");
      if (!strip) return;
      active = strip;
      startY = event.clientY;
      fromIndex = stripsNow().indexOf(strip);
      setDragging(true);
      strip.style.transition = "transform .18s cubic-bezier(.22,1,.36,1), box-shadow .18s ease";
      strip.style.transform = "scale(1.03)";
      strip.style.boxShadow = "0 10px 24px rgba(20,16,26,.32)";
      strip.style.zIndex = "3";
      strip.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!active) return;
      const dy = event.clientY - startY;
      active.style.transition = "box-shadow .18s ease";
      active.style.transform = `translateY(${dy}px) scale(1.03)`;

      const strips = stripsNow();
      const overIndex = strips.findIndex((el) => {
        if (el === active) return false;
        const r = el.getBoundingClientRect();
        return event.clientY >= r.top && event.clientY <= r.bottom;
      });
      if (overIndex >= 0 && overIndex !== fromIndex) {
        // Record where every row is, reorder, then animate each one from where it was: a FLIP.
        const lifted = active;
        const liftedTop = lifted.getBoundingClientRect().top;
        const flip = captureStrips(slot, lifted);
        setOrder((prev) => {
          const moved = prev[fromIndex];
          if (moved == null) return prev;
          const next = [...prev];
          next.splice(fromIndex, 1);
          next.splice(overIndex, 0, moved);
          return next;
        });
        fromIndex = overIndex;
        requestAnimationFrame(() => {
          flip();
          // The dragged row's own slot has just moved by a row, and its transform is measured
          // from that slot — so without shifting the origin by the same amount it would jump a
          // full row away from the finger on every swap.
          startY += lifted.getBoundingClientRect().top - liftedTop;
        });
      }
    };

    const onPointerUp = () => {
      if (!active) return;
      const strip = active;
      active = null;
      setDragging(false);
      strip.style.transition = "transform .42s cubic-bezier(.34,1.56,.64,1), box-shadow .3s ease";
      strip.style.transform = "translateY(0) scale(1)";
      strip.style.boxShadow = "none";
      window.setTimeout(() => {
        strip.style.transition = "";
        strip.style.transform = "";
        strip.style.zIndex = "";
      }, 430);
    };

    slot.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      slot.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [setDragging, setOrder]);

  return (
    <>
      <div className="proxy-scrim" onClick={() => onClose(false)} />
      <div
        className="proxy-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="proxy-modal-heading"
        style={{ background: skin.paper }}
      >
        <p className="proxy-modal-eyebrow" style={{ color: "var(--blue)" }}>
          {PROXY_MODAL_COPY.eyebrow}
        </p>
        <h3 className="proxy-modal-heading" id="proxy-modal-heading" style={{ color: skin.ink }}>
          {PROXY_MODAL_COPY.heading}
        </h3>
        <p className="proxy-modal-note" style={{ color: skin.mute }}>
          {PROXY_MODAL_COPY.instruction}
        </p>
        {/* Strips only. The "Best predictor" / "Worst" rails belong to the card, where the
            instruction above the list already says which end is which — repeating them here costs
            two rows of height in the one place that cannot spare it. */}
        <div className="proxy-modal-slot" ref={slotRef}>
          {list}
        </div>
        <p className="proxy-modal-closing" style={{ color: skin.mute }}>
          {PROXY_MODAL_COPY.closing}
        </p>
        <div className="proxy-modal-actions">
          <button
            type="button"
            className="proxy-skip"
            style={{ background: skin.tile, color: skin.body }}
            onClick={() => onClose(false)}
          >
            Skip
          </button>
          <button
            type="button"
            className="proxy-submit"
            style={{ background: skin.ink, color: skin.paper }}
            onClick={() => onClose(true)}
          >
            Submit my ranking
          </button>
        </div>
        <p className="sr-only">
          Current order, best first: {order.map((i) => PROXY_DEFS[i]?.title).join(", ")}
        </p>
      </div>
    </>
  );
}
