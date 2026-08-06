import type { Dictionary } from "@/lib/i18n/en";

// The five candidate proxies for a country's seasonal swing, in identity order. That order is the
// design's `data-proxy` index: it decides each proxy's colour and which chart carries the reader's
// "Your #N" note, so it is fixed regardless of how the reader ranks them — and regardless of what
// language the write-ups are in.
//
// The copy itself lives in the dictionaries (lib/i18n/*.ts). These five write-ups used to sit in
// docs/ROADMAP.md as a static grid, moved here when the card took over presenting them, and moved
// on again when the story gained a second and third language.
export interface ProxyDef {
  index: number;
  title: string;
  body: string;
}

// Identity indices, in the order the dictionary lists them.
export const PROXY_INDICES = [0, 1, 2, 3, 4];

export function proxyDefs(d: Dictionary): ProxyDef[] {
  return d.proxy.defs.map((def, index) => ({ index, ...def }));
}
