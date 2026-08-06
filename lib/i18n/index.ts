import { ca } from "./ca";
import { de } from "./de";
import { en, type Dictionary } from "./en";
import type { Locale } from "./config";

// Imported by the server component only. Pulling all three dictionaries into the client bundle
// to pick one at runtime would ship two languages nobody on that request is reading; the page
// resolves the locale on the server and hands the chosen dictionary down as a prop.
const DICTIONARIES: Record<Locale, Dictionary> = { en, ca, de };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

export type { Dictionary };
