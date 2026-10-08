// A single shared tooltip <div> (see .chart-tooltip in roadmap.css), positioned by
// direct DOM writes on pointermove so it never triggers a React re-render. Charts call
// showTooltip/moveTooltip/hideTooltip directly from their D3 .on() handlers.
//
// With a finger there is no hover, so the same calls mean something slightly different. A chart
// shows its tooltip on `click` as well as on `pointermove` (a tap produces a click and usually no
// move at all), and a tooltip opened by a finger is pinned: it ignores the `pointerleave` every
// touch fires as the finger lifts, and closes on the next touch anywhere — on the tooltip itself
// included — or when the page scrolls. Touching the same thing again closes it rather than
// reopening it, because the text it would show is the text that touch just closed. And nothing
// opens while a finger is still down, so the `pointermove`s a scroll flick drags across a chart
// before the browser takes the gesture over open nothing.
//
// One rule follows from that, for every caller: never show on `pointerenter`/`pointerover`. A
// touch fires those before `pointerdown`, so the tooltip would open and then be closed by the very
// touch that opened it.
import { computePosition, flip, offset, shift, type VirtualElement } from "@floating-ui/dom";

let el: HTMLDivElement | null = null;

// What the most recent pointer was. A tooltip opened while this is "touch" is pinned.
let lastPointerType = "mouse";
let pinned = false;
// What the current touch closed, so the same touch cannot reopen it: the same text, or anything
// from the same spot on the same element — an animated chart words a place differently a second
// later. Reset on every touch.
let dismissed: { text: string | null; sameSpot: boolean } | null = null;
// Lets a chart undo whatever it drew alongside the tooltip (a ring, a highlighted band) when the
// tooltip is closed by something other than the chart itself.
let onHide: (() => void) | null = null;
// computePosition is asynchronous; a later call supersedes any still in flight.
let placement = 0;
// The touch in progress, and the one that opened the tooltip that is showing.
interface Touch {
  id: number;
  x: number;
  y: number;
  target: EventTarget | null;
  // Whether the finger has lifted. A touch tooltip opens on the way up — the picker's `pointerup`,
  // the `click` after it, a native title — never on the way down or while the finger moves: a
  // scroll flick that starts on a chart drags across its points and fires their `pointermove`
  // before the browser takes the gesture over, and a tooltip opened by that would be pinned to
  // whatever the finger happened to cross, with no tap to explain it.
  up: boolean;
}
let tap: Touch | null = null;
let openedBy: Touch | null = null;
let listening = false;

// Mounted inside the story, not on the body. The palette is a set of custom properties on the scroll
// container (see palette.ts skinToCssVars), so a tooltip parented to the body sat outside every one
// of them: `background: var(--paper)` and `color: var(--ink)` had nothing to resolve against and
// collapsed to transparent, which is why the tooltip had no surface of its own and the chart showed
// through it. Inside the container the same declarations pick up whichever section is in view, and
// follow it when the sky changes. `position: fixed` is unaffected — nothing on the way up to the
// container establishes a containing block for it, so the tooltip is still placed against the
// viewport.
function ensureEl(): HTMLDivElement {
  listen();
  const host = document.querySelector(".story") ?? document.body;
  // The class is set once, at creation, and never touched again — `showTooltip` adds `visible` to
  // this same list and then calls `moveTooltip`, which comes back through here. Re-assigning
  // className on every call therefore stripped `visible` a moment after it was added, and the
  // tooltip sat on the page fully built and permanently at opacity 0.
  if (!el) {
    el = document.createElement("div");
    el.className = "chart-tooltip";
    // The tap that closes a pinned tooltip ends here, not on the chart under it. Attached for good
    // rather than per tap: iOS only sends a click to an element that already had a listener.
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      el?.classList.remove("closing");
    });
  }
  // The parent, unlike the class, is checked on every use. It is load-bearing — the only thing
  // putting the palette in scope — so a node that ended up elsewhere has to be moved rather than
  // left to render with nothing to resolve against. That covers a first tooltip shown before the
  // story mounted, a story remounted underneath it, and a hot reload that kept this module's state
  // while replacing the container.
  if (el.parentElement !== host) host.appendChild(el);
  return el;
}

// The document-level half of the touch behaviour. Installed once, on first use or from the story
// itself (see installTouchTooltips), and never removed: the listeners are passive and cheap.
function listen(): void {
  if (listening || typeof document === "undefined") return;
  listening = true;
  const track = (event: PointerEvent) => {
    lastPointerType = event.pointerType;
  };
  document.addEventListener("pointermove", track, { capture: true, passive: true });
  document.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
  // Capture, so the lift is recorded before any chart's own `pointerup` asks to open.
  document.addEventListener(
    "pointerup",
    (event: PointerEvent) => {
      if (tap && tap.id === event.pointerId) tap.up = true;
    },
    { capture: true, passive: true },
  );
  document.addEventListener("pointerup", onPointerUp, { passive: true });
  document.addEventListener(
    "pointercancel",
    () => {
      tap = null;
    },
    { passive: true },
  );
  // The page moved under a pinned tooltip: it is fixed to the viewport, so it would now point at
  // nothing. A hover tooltip is left alone — the next `pointermove` places it again.
  document.addEventListener(
    "scroll",
    () => {
      if (pinned) hide();
    },
    { capture: true, passive: true },
  );
}

function onPointerDown(event: PointerEvent): void {
  lastPointerType = event.pointerType;
  dismissed = null;
  tap =
    event.pointerType === "touch"
      ? { id: event.pointerId, x: event.clientX, y: event.clientY, target: event.target, up: false }
      : null;
  if (!el || !pinned || !el.classList.contains("visible")) return;
  dismissed = {
    text: el.textContent,
    sameSpot:
      openedBy !== null &&
      openedBy.target === event.target &&
      Math.hypot(event.clientX - openedBy.x, event.clientY - openedBy.y) < 24,
  };
  // Closed by a tap on the tooltip itself: it stays a tap target until that tap's click has landed
  // on it, or the click would fall through to whatever chart is underneath and open a new one.
  if (event.target instanceof Node && el.contains(event.target)) {
    const node = el;
    node.classList.add("closing");
    window.setTimeout(() => node.classList.remove("closing"), 600);
  }
  hide();
}

// A native `title` is a desktop tooltip that a phone never shows. A tap on anything carrying one
// shows it in the shared tooltip instead. On pointerup rather than click, because iOS sends no
// click to a plain <span> or SVG <text> that has no listener of its own.
function onPointerUp(event: PointerEvent): void {
  // `tap` is left in place: the click that follows is what opens most chart tooltips, and they
  // record it as the touch that opened them.
  const start = tap;
  if (!start || start.id !== event.pointerId) return;
  if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) return;
  const found = titleAt(event.target);
  if (found) showTooltipAt(found.text, found.anchor);
}

function titleAt(target: EventTarget | null): { text: string; anchor: Element } | null {
  for (
    let node = target instanceof Element ? target : null;
    node && node !== document.body;
    node = node.parentElement
  ) {
    if (node === el) return null;
    // A link's title rides on a tap that navigates away; there is nothing to show it on.
    if (node instanceof HTMLAnchorElement) return null;
    if (node instanceof HTMLElement && node.title) return { text: node.title, anchor: node };
    if (node instanceof SVGElement) {
      const title = Array.from(node.children).find((c) => c.tagName.toLowerCase() === "title");
      if (title?.textContent) return { text: title.textContent, anchor: node };
    }
  }
  return null;
}

// Call once from the story so a tap on a native `title` works before any chart tooltip has been
// shown. Everything else installs the listeners lazily.
export function installTouchTooltips(): void {
  listen();
}

interface TooltipOptions {
  onHide?: () => void;
}

// Shows the tooltip at a point. Returns false when it did not open, which happens only when the
// touch in progress is the one that just closed the same text.
export function showTooltip(
  text: string,
  clientX: number,
  clientY: number,
  options?: TooltipOptions,
): boolean {
  if (!open(text, options)) return false;
  moveTooltip(clientX, clientY);
  return true;
}

// Shows the tooltip against an element rather than a point: for focus, and for taps on things too
// small to point at precisely.
export function showTooltipAt(text: string, anchor: Element, options?: TooltipOptions): boolean {
  if (!open(text, options)) return false;
  place(anchor, 8);
  return true;
}

function open(text: string, options?: TooltipOptions): boolean {
  if (lastPointerType === "touch" && dismissed && (text === dismissed.text || dismissed.sameSpot))
    return false;
  // A finger still down is not asking: see Touch.up.
  if (lastPointerType === "touch" && tap && !tap.up) return false;
  const node = ensureEl();
  const next = options?.onHide ?? null;
  // Another chart's tooltip replaced without a hide in between — a mouse moving straight from one
  // figure to the next — still owes that chart its cleanup.
  if (onHide && onHide !== next) onHide();
  onHide = next;
  pinned = lastPointerType === "touch";
  openedBy = pinned ? tap : null;
  node.textContent = text;
  node.classList.toggle("pinned", pinned);
  node.classList.add("visible");
  return true;
}

export function moveTooltip(clientX: number, clientY: number): void {
  const point: VirtualElement = {
    getBoundingClientRect: () => ({
      x: clientX,
      y: clientY,
      top: clientY,
      left: clientX,
      right: clientX,
      bottom: clientY,
      width: 0,
      height: 0,
    }),
  };
  place(point, pinned ? 16 : 12);
}

// A cursor sits on top of what it points at, so the tooltip hangs below and to the right of it. A
// finger covers what is under it and the hand covers what is below, so a tapped tooltip goes above.
// Either flips when there is no room, and is pushed back inside the viewport sideways.
function place(reference: Element | VirtualElement, gap: number): void {
  const node = ensureEl();
  const id = ++placement;
  // Measured from the left edge, so a tooltip last shown near the right does not arrive squeezed
  // into whatever width was left there.
  node.style.left = "0px";
  node.style.top = "0px";
  const cursor = !pinned && !(reference instanceof Element);
  void computePosition(reference, node, {
    strategy: "fixed",
    placement: pinned ? "top" : cursor ? "bottom-start" : "bottom",
    middleware: [
      offset(cursor ? { mainAxis: gap, crossAxis: gap } : gap),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
    ],
  }).then(({ x, y }) => {
    if (id !== placement) return;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
  });
}

function hide(): void {
  el?.classList.remove("visible", "pinned");
  pinned = false;
  const done = onHide;
  onHide = null;
  done?.();
}

// Wired straight to `pointerleave` across the charts, so it is handed the event. A finger lifting
// fires one on every tap, and is not the reader leaving: a touch tooltip stays until the next touch.
export function hideTooltip(event?: unknown): void {
  if ((event as { pointerType?: string } | undefined)?.pointerType === "touch") return;
  hide();
}
