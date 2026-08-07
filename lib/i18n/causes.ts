import type { Dictionary } from "./en";

// The per-language cause table: GBD label in, words out.
export type CauseLabels = Dictionary["causes"];

// Looking up a cause of death in the reader's language.
//
// The GBD label is the identity — it is the key in data/causes.json and what every weight is
// indexed against — so nothing translates it in place. It is turned into words at the last
// moment, here, and an unmapped label falls through as the English it already was. That is what
// lets a new GBD export ship new causes without a translation pass blocking it, at the cost of a
// few English labels in a Catalan sentence until someone adds them; lib/i18n/causes.test.ts
// fails when that happens for a cause the current export actually contains.
export function causeLabel(causes: CauseLabels, gbdLabel: string): string {
  return causes[gbdLabel] ?? gbdLabel;
}
