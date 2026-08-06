// Scroll-triggered entrances for the story's prose and figures, and the typewriter on the
// opening chat. Both are driven from StoryClient's single rAF-throttled scroll handler rather
// than from IntersectionObservers: the handler already reads layout every frame for the globe's
// exit, so reusing that read costs nothing, and a fire-once list that shrinks as it drains is
// cheaper than N live observers.

// A block is revealed when its top passes this fraction of the viewport — just inside the
// bottom edge, so copy is already settled by the time the reader's eye arrives.
const REVEAL_LINE = 0.94;
// The chat answer starts typing at mid-screen, later than a reveal: it is a performance, and it
// should not have finished before the reader looks at it.
const TYPE_LINE = 0.5;
// Blocks whose position is already driven by something else, so an entrance would compete for
// the same inline transform.
const NO_REVEAL = ".proxy-stack, .end-block";

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

// Hides every block that hasn't already had its entrance and arms its transition. Returns the
// list the scroll handler drains, and a teardown that puts the styles back — without it, a hot
// reload or a section change would leave orphaned blocks invisible forever.
//
// Blocks already marked `data-rv="done"` are left alone. This runs again whenever the figures
// resolve their data, and re-hiding what the reader is currently looking at would flash the
// screen they are on.
export function prepareReveals(root: HTMLElement): { pending: HTMLElement[]; restore: () => void } {
  const armed = Array.from(root.querySelectorAll<HTMLElement>(".story-section > *"))
    .filter((el) => el.getAttribute("data-rv") !== "done")
    // Blocks that own their own scroll behaviour are left out: the proxy stack is positioned
    // from the scroll offset every frame, and the closing block's transform belongs to the
    // pull gesture. An entrance writing the same properties would fight both.
    .filter((el) => !el.matches(NO_REVEAL));
  const restore = () => {
    for (const el of armed) {
      if (el.getAttribute("data-rv") === "done") continue;
      el.style.opacity = "";
      el.style.transform = "";
      el.style.transitionDelay = "";
      el.removeAttribute("data-rv");
    }
  };
  if (prefersReducedMotion()) return { pending: [], restore };

  armed.forEach((el, i) => {
    // Three blocks share a stagger cycle: enough to read as a cascade when a whole screen
    // enters at once, short enough that the last one is not still arriving.
    //
    // Only the delay is written here. The transition itself lives in the stylesheet, on
    // `.story-section > [data-rv]` — an inline `transition` would win over every rule in the
    // stylesheet and, because it names opacity and transform only, would silently cancel the
    // palette's colour fade on exactly the prose that carries most of it.
    el.setAttribute("data-rv", "");
    el.style.opacity = "0";
    el.style.transform = "translateY(22px)";
    el.style.transitionDelay = `${((i % 3) * 0.06).toFixed(2)}s`;
  });
  return { pending: armed, restore };
}

// Reveals whatever has come into range and removes it from the list, so a block is never
// touched twice and the work per frame falls to zero once the reader is past everything.
export function runReveals(pending: HTMLElement[], viewportHeight: number): void {
  const line = viewportHeight * REVEAL_LINE;
  for (let i = pending.length - 1; i >= 0; i -= 1) {
    const el = pending[i];
    if (!el) {
      pending.splice(i, 1);
      continue;
    }
    if (el.getBoundingClientRect().top < line) {
      el.style.opacity = "1";
      el.style.transform = "none";
      el.setAttribute("data-rv", "done");
      pending.splice(i, 1);
    }
  }
}

export interface Typer {
  el: HTMLElement;
  text: string;
}

// Empties every typewriter target so it can fill in later. The full text stays in the DOM on a
// sibling spacer (see the .chat-typing rules) which is what reserves the box and what assistive
// technology reads — the node typed into is aria-hidden, so nothing is announced per keystroke.
export function prepareTypers(root: HTMLElement): Typer[] {
  const els = Array.from(root.querySelectorAll<HTMLElement>("[data-type]"));
  const reduce = prefersReducedMotion();
  return els.flatMap((el) => {
    const text = el.getAttribute("data-type") ?? "";
    // Already performed, or motion is off: show the finished line and leave it alone. Emptying
    // it again on a re-arm would retype a sentence the reader has already read.
    if (reduce || el.dataset.typed === "1") {
      el.textContent = text;
      el.dataset.typed = "1";
      return [];
    }
    el.textContent = "";
    return [{ el, text }];
  });
}

export function runTypers(
  pending: Typer[],
  viewportHeight: number,
  timers: Set<ReturnType<typeof setTimeout>>,
): void {
  const line = viewportHeight * TYPE_LINE;
  for (let i = pending.length - 1; i >= 0; i -= 1) {
    const entry = pending[i];
    if (!entry) {
      pending.splice(i, 1);
      continue;
    }
    if (entry.el.getBoundingClientRect().top < line) {
      pending.splice(i, 1);
      typeOut(entry, timers);
    }
  }
}

// Types one character at a time at an uneven human-ish pace. The caret is a ::after on the
// typed node, so it survives every textContent write and always sits at the end of the text.
export function typeOut({ el, text }: Typer, timers: Set<ReturnType<typeof setTimeout>>): void {
  el.classList.add("is-typing");
  let n = 0;
  const step = () => {
    n += 1;
    el.textContent = text.slice(0, n);
    if (n < text.length) {
      const t = setTimeout(step, 26 + Math.random() * 30);
      timers.add(t);
    } else {
      el.classList.remove("is-typing");
      el.dataset.typed = "1";
    }
  };
  const first = setTimeout(step, 260);
  timers.add(first);
}
