// A single shared tooltip <div> (see .chart-tooltip in roadmap.css), positioned by
// direct DOM writes on pointermove so it never triggers a React re-render. Charts call
// showTooltip/moveTooltip/hideTooltip directly from their D3 .on() handlers.
let el: HTMLDivElement | null = null;

function ensureEl(): HTMLDivElement {
  if (el) return el;
  el = document.createElement("div");
  el.className = "chart-tooltip";
  document.body.appendChild(el);
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
