// A single shared tooltip <div> (see .chart-tooltip in roadmap.css), positioned by
// direct DOM writes on pointermove so it never triggers a React re-render. Charts call
// showTooltip/moveTooltip/hideTooltip directly from their D3 .on() handlers.
let el: HTMLDivElement | null = null;

// Mounted inside the story, not on the body. The palette is a set of custom properties on the scroll
// container (see palette.ts skinToCssVars), so a tooltip parented to the body sat outside every one
// of them: `background: var(--paper)` and `color: var(--ink)` had nothing to resolve against and
// collapsed to transparent, which is why the tooltip had no surface of its own and the chart showed
// through it. Inside the container the same declarations pick up whichever section is in view, and
// follow it when the sky changes. `position: fixed` is unaffected — nothing on the way up to the
// container establishes a containing block for it, so the tooltip is still placed against the
// viewport.
function ensureEl(): HTMLDivElement {
  const host = document.querySelector(".story") ?? document.body;
  el ??= document.createElement("div");
  el.className = "chart-tooltip";
  // Checked on every use, not just on creation. The parent is load-bearing here — it is the only
  // thing putting the palette in scope — so any node that ended up somewhere else has to be moved
  // rather than left to render with nothing to resolve against. That covers a first tooltip shown
  // before the story mounted, a story remounted underneath it, and a hot reload that kept this
  // module's state while replacing the container.
  if (el.parentElement !== host) host.appendChild(el);
  return el;
}

export function showTooltip(text: string, clientX: number, clientY: number): void {
  const node = ensureEl();
  node.textContent = text;
  node.classList.add("visible");
  moveTooltip(clientX, clientY);
}

export function moveTooltip(clientX: number, clientY: number): void {
  const node = ensureEl();
  const pad = 12;
  const rect = node.getBoundingClientRect();
  let x = clientX + pad;
  let y = clientY + pad;
  if (x + rect.width > window.innerWidth) x = clientX - rect.width - pad;
  if (y + rect.height > window.innerHeight) y = clientY - rect.height - pad;
  node.style.left = `${Math.max(0, x)}px`;
  node.style.top = `${Math.max(0, y)}px`;
}

export function hideTooltip(): void {
  el?.classList.remove("visible");
}
