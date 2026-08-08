"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useDict } from "../I18nContext";
import { fill } from "@/lib/i18n/fill";
import ProxyStrip from "./ProxyStrip";
import SortableProxyList from "./SortableProxyList";
import { PROXY_INDICES, proxyDefs, type ProxyDef } from "./proxyDefs";
import { useProxyGuess } from "./ProxyGuessContext";
import { FOLDED_HEIGHT, stripStyle, useProxyFold } from "./useProxyFold";

// The stack is taller than the card so the sticky card has somewhere to travel while the strips
// fold: roughly half a screen per strip, plus a little run-out at the end.
const SCREENS_PER_STRIP = 0.55;
const RUN_OUT = 0.22;

// A natural (unfolded) strip height, used before the real one has been measured. Only matters for
// the first frame.
const ASSUMED_NATURAL = 210;

// Before the data: five candidate proxies for a country's seasonal swing, each argued for in its
// own words, folding into a ranking the reader is then asked to commit to. Guessing first is the
// point — the five charts that follow are the answer, and they land differently once you have
// staked something on them.
export default function ProxyRankingCard() {
  const d = useDict();
  const { submit, spent, markSpent } = useProxyGuess();
  const [order, setOrder] = useState<number[]>(() => [...PROXY_INDICES]);
  const [modalOpen, setModalOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [stackHeight, setStackHeight] = useState(0);
  // Measured open heights, in state rather than a ref: the fold interpolates towards them, so they
  // are an input to rendering and a change in them has to produce a new frame.
  const [naturalHeights, setNaturalHeights] = useState<number[]>(() =>
    PROXY_INDICES.map(() => ASSUMED_NATURAL),
  );
  const boxesRef = useRef<HTMLDivElement | null>(null);

  // Colour is keyed to a proxy's identity, never to where it currently sits, so reordering the
  // list never repaints a single strip.
  const colors = useMemo(() => PROXY_INDICES.map((index) => `var(--proxy-color-${index})`), []);
  const defsByIndex = useMemo(() => new Map(proxyDefs(d).map((def) => [def.index, def])), [d]);

  const openModal = useCallback(() => setModalOpen(true), []);
  const { stackRef, fold } = useProxyFold({
    count: PROXY_INDICES.length,
    suspended: modalOpen || dragging,
    onComplete: openModal,
  });

  // The container's height decides how much scroll the fold gets. Measured from the viewport rather
  // than hardcoded, so a short phone and a tall one both get the same number of screens.
  useEffect(() => {
    const resize = () => {
      const vh = window.innerHeight || 1;
      setStackHeight(Math.round(vh * SCREENS_PER_STRIP * PROXY_INDICES.length + vh * RUN_OUT));
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
  // measured at, and on the language, because the same write-up is not the same number of lines
  // in German as it is in English.
  const measuredWidth = useRef(0);
  const measuredDict = useRef(d);
  useLayoutEffect(() => {
    const boxes = boxesRef.current;
    if (!boxes || modalOpen) return;
    const width = boxes.clientWidth;
    if (!width || (width === measuredWidth.current && d === measuredDict.current)) return;
    measuredWidth.current = width;
    measuredDict.current = d;

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
  }, [modalOpen, fold.progress, d]);

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

  // Escape closes without submitting, like the scrim. It remains with the modal while SortableJS
  // is dragging because SortableJS has no separate keyboard drag cancellation to reserve it for.
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !dragging) closeModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, dragging, closeModal]);

  const strips = order.map((proxyIndex, position) => ({
    def: defsByIndex.get(proxyIndex)!,
    color: colors[proxyIndex % colors.length] as string,
    rank: position + 1,
    progress: fold.progress[position] ?? 0,
    position,
  }));

  return (
    <>
      {/* The stack keeps its height while the card is away in the modal. Dropping it would take
          four viewports of runway out of the document, and the browser would clamp the scroll
          position to the new bottom — so closing the modal would return the reader somewhere
          they had never been. */}
      <div className="proxy-stack" ref={stackRef} style={{ height: `${stackHeight}px` }}>
        <div
          className="proxy-card"
          style={{ background: "var(--tile-open)", color: "var(--body)" }}
          data-hidden={modalOpen ? "1" : "0"}
        >
          <div className="proxy-card-title">{d.proxy.cardTitle}</div>
          <div className="proxy-rail proxy-rail-best" data-shown={fold.complete ? "1" : "0"}>
            <span>{d.proxy.best}</span>
            <span className="proxy-rail-line" />
          </div>
          {modalOpen ? (
            <div
              className="proxy-boxes-placeholder"
              style={{ height: FOLDED_HEIGHT * PROXY_INDICES.length }}
            />
          ) : (
            <div className="proxy-boxes" ref={boxesRef}>
              {strips.map((s) => (
                <ProxyStrip
                  key={s.def.index}
                  def={s.def}
                  color={s.color}
                  rank={s.rank}
                  progress={s.progress}
                  // The ⓘ arrives when the ranking does — all at once, once every strip has
                  // folded — rather than one strip at a time on the way down.
                  controlsShown={fold.complete}
                  inModal={false}
                  style={stripStyle(
                    s.progress,
                    naturalHeights[s.position] ?? ASSUMED_NATURAL,
                    s.position === 0,
                  )}
                />
              ))}
            </div>
          )}
          <div className="proxy-card-foot">
            {/* The rails fade in with the finished ranking; the reorder button does not, because
                it is how the reader gets back to a modal they have already dismissed. */}
            <div className="proxy-rail proxy-rail-worst" data-shown={fold.complete ? "1" : "0"}>
              <span className="proxy-rail-line" />
              <span>{d.proxy.worst}</span>
            </div>
            {spent ? (
              <button
                type="button"
                className="proxy-reorder"
                style={{ background: "var(--tile)", color: "var(--ink)" }}
                onClick={openModal}
              >
                {d.proxy.reorder}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {modalOpen ? (
        <ProxyRankModal
          onClose={closeModal}
          setDragging={setDragging}
          order={order}
          setOrder={setOrder}
          defsByIndex={defsByIndex}
          colors={colors}
        />
      ) : null}
    </>
  );
}

interface ModalProps {
  onClose: (submitted: boolean) => void;
  setDragging: (dragging: boolean) => void;
  order: number[];
  setOrder: React.Dispatch<React.SetStateAction<number[]>>;
  defsByIndex: Map<number, ProxyDef>;
  colors: string[];
}

function ProxyRankModal({
  onClose,
  setDragging,
  order,
  setOrder,
  defsByIndex,
  colors,
}: ModalProps) {
  const d = useDict();

  return (
    <>
      <div className="proxy-scrim" onClick={() => onClose(false)} />
      <div
        className="proxy-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="proxy-modal-heading"
        style={{ background: "var(--paper)" }}
      >
        <p className="proxy-modal-eyebrow" style={{ color: "var(--blue)" }}>
          {d.proxy.modal.eyebrow}
        </p>
        <h3
          className="proxy-modal-heading"
          id="proxy-modal-heading"
          style={{ color: "var(--ink)" }}
        >
          {d.proxy.modal.heading}
        </h3>
        <p className="proxy-modal-note" style={{ color: "var(--mute)" }}>
          {d.proxy.modal.instruction}
        </p>
        {/* Strips only. The "Best predictor" / "Worst" rails belong to the card, where the
            instruction above the list already says which end is which — repeating them here costs
            two rows of height in the one place that cannot spare it. */}
        <div className="proxy-modal-slot">
          <SortableProxyList
            order={order}
            setOrder={setOrder}
            defsByIndex={defsByIndex}
            colors={colors}
            onDraggingChange={setDragging}
          />
        </div>
        <p className="proxy-modal-closing" style={{ color: "var(--mute)" }}>
          {d.proxy.modal.closing}
        </p>
        <div className="proxy-modal-actions">
          <button
            type="button"
            className="proxy-skip"
            style={{ background: "var(--tile)", color: "var(--body)" }}
            onClick={() => onClose(false)}
          >
            {d.proxy.modal.skip}
          </button>
          <button
            type="button"
            className="proxy-submit"
            style={{ background: "var(--ink)", color: "var(--paper)" }}
            onClick={() => onClose(true)}
          >
            {d.proxy.modal.submit}
          </button>
        </div>
        <p className="sr-only">
          {fill(d.proxy.currentOrder, {
            order: order.map((i) => defsByIndex.get(i)?.title ?? "").join(", "),
          })}
        </p>
      </div>
    </>
  );
}
