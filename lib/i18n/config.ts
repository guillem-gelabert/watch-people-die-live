// The three languages the story is published in, and the rules for picking one.
//
// The locale rides in a `?lang=` search param rather than a path segment: the whole site is one
// route that reads one markdown file, and a `[locale]` segment would have meant a middleware, a
// redirect and three copies of every data URL for no reader-visible gain.

export const LOCALES = ["en", "ca", "de"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

// Each language named in itself, which is the only naming a switcher can use — a reader looking
// for Catalan is looking for "Català", not for "Catalan" spelled out in a language they don't read.
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  ca: "Català",
  de: "Deutsch",
};

// The short form on the switcher itself, where there is room for two letters and not for eight.
export const LOCALE_SHORT: Record<Locale, string> = {
  en: "EN",
  ca: "CA",
  de: "DE",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

// Anything that is not one of the three falls back to English rather than erroring: a locale
// comes off a URL, and a URL can say anything.
export function resolveLocale(value: string | string[] | undefined): Locale {
  const first = Array.isArray(value) ? value[0] : value;
  return isLocale(first) ? first : DEFAULT_LOCALE;
}

// The story file each locale reads. English keeps the unsuffixed name it has always had, because
// it is the source the other two are translated from.
export function storyFilename(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? "ROADMAP.md" : `ROADMAP.${locale}.md`;
}

// The href that switches to a locale. English drops the param rather than carrying `?lang=en`,
// so the canonical URL of the story stays `/`.
export function localeHref(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? "/" : `/?lang=${locale}`;
}
