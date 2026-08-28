// The three languages the story is published in, auto-detected from Accept-Language header.
//
// Detection rules:
// - Spanish or Catalan → Catalan
// - German → German
// - Everything else → English

export const LOCALES = ["en", "ca", "de"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

// Each language named in itself.
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  ca: "Català",
  de: "Deutsch",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

// Detect locale from Accept-Language header. Parses the header to extract language codes and
// returns the best match, falling back to English.
// Examples: "es-ES,es;q=0.9" → "ca", "de-DE" → "de", "fr-FR" → "en"
export function resolveLocaleFromHeader(acceptLanguage: string | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  // Parse Accept-Language header: "es-ES,es;q=0.9,en;q=0.8" → ["es", "ca", "en", ...]
  const languages = acceptLanguage
    .split(",")
    .map((lang) => lang.trim().split(";")[0]?.split("-")[0]?.toLowerCase())
    .filter((lang): lang is string => Boolean(lang));

  for (const lang of languages) {
    if (lang === "es" || lang === "ca") return "ca";
    if (lang === "de") return "de";
  }

  return DEFAULT_LOCALE;
}

// The story file each locale reads. English keeps the unsuffixed name it has always had, because
// it is the source the other two are translated from.
export function storyFilename(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? "ROADMAP.md" : `ROADMAP.${locale}.md`;
}
