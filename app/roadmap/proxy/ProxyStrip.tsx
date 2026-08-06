"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import type { ProxyDef } from "./proxyDefs";

interface ProxyStripProps {
  def: ProxyDef;
  color: string;
  rank: number;
  // 0 while the write-up is fully open, 1 once collapsed to a single row.
  progress: number;
  // Whether the ⓘ and the move buttons are available yet — true once the whole stack has folded.
  controlsShown: boolean;
  // In the modal the strips are a fixed, roomier height and the write-up is behind the ⓘ.
  inModal: boolean;
  onMove?: (direction: -1 | 1) => void;
  onPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
  style?: CSSProperties;
}

// White on every strip, as in the design. The fills are all vivid analogous members at one
// lightness, so they read as a set; switching some rows to dark ink by measured luminance broke
// that set apart and was the visible difference against the design.
const STRIP_INK = "#ffffff";

// Long titles drop a size in the modal rather than wrapping to two lines and pushing the row out
// of its fixed height.
const LONG_TITLE = 22;

export default function ProxyStrip({
  def,
  color,
  rank,
  progress,
  controlsShown,
  inModal,
  onMove,
  onPointerDown,
  style,
}: ProxyStripProps) {
  const paragraphRef = useRef<HTMLParagraphElement | null>(null);
  const tipRef = useRef<HTMLSpanElement | null>(null);
  const [tipOpen, setTipOpen] = useState(false);
  // Which side of the ⓘ the tip hangs from. It sits above by default and drops below when there
  // is not enough room, which is the case for the top row of the modal.
  const [tipBelow, setTipBelow] = useState(false);
  const ink = STRIP_INK;
  // The title clips to one line just before the write-up finishes leaving, so the row is already
  // a single line by the time it is the only thing left.
  const folded = inModal || progress > 0.5;

  // The tooltip and the paragraph are the same words; closing on any outside pointer keeps a tap
  // on another strip's ⓘ from leaving two open. Scrolling closes it too — it is anchored to a row
  // that is about to move.
  useEffect(() => {
    if (!tipOpen) return;
    const close = () => setTipOpen(false);
    window.addEventListener("pointerdown", close, { capture: true });
    window.addEventListener("scroll", close, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", close, { capture: true });
      window.removeEventListener("scroll", close);
    };
  }, [tipOpen]);

  // Measured as the tip mounts rather than in an effect: the node is only in the DOM while the
  // tip is open, so its arrival is exactly when there is something to measure.
  const measureTip = useCallback((node: HTMLSpanElement | null) => {
    tipRef.current = node;
    setTipBelow(node ? node.getBoundingClientRect().top < 8 : false);
  }, []);

  return (
    <div
      className="proxy-strip"
      data-proxy={def.index}
      data-folded={folded ? "1" : "0"}
      data-in-modal={inModal ? "1" : "0"}
      style={{ background: color, color: ink, ...style }}
      onPointerDown={onPointerDown}
    >
      <div className="proxy-strip-row">
        <span className="proxy-strip-rank">{rank}</span>
        <h3
          className="proxy-strip-title"
          style={inModal && def.title.length > LONG_TITLE ? { fontSize: "22px" } : undefined}
        >
          {def.title}
        </h3>
        {/* Controls appear only once the strip has folded: while the write-up is open the words are
            right there, and there is nothing to reorder yet. */}
        <span className="proxy-strip-controls" data-shown={controlsShown ? "1" : "0"}>
          <button
            type="button"
            className="proxy-strip-info"
            aria-expanded={tipOpen}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setTipOpen((v) => !v);
            }}
          >
            i<span className="sr-only"> — the case for {def.title}</span>
          </button>
          {onMove ? (
            <>
              <button
                type="button"
                className="sr-only"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onMove(-1)}
              >
                Move {def.title} up
              </button>
              <button
                type="button"
                className="sr-only"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onMove(1)}
              >
                Move {def.title} down
              </button>
            </>
          ) : null}
        </span>
      </div>
      <p
        className="proxy-strip-body"
        ref={paragraphRef}
        style={
          inModal
            ? { display: "none" }
            : {
                opacity: 1 - Math.min(1, progress / 0.55),
                display: progress > 0.55 ? "none" : undefined,
              }
        }
      >
        {def.body}
      </p>
      {tipOpen ? (
        <span className="proxy-tip" role="note" ref={measureTip} data-below={tipBelow ? "1" : "0"}>
          {def.body}
        </span>
      ) : null}
    </div>
  );
}
