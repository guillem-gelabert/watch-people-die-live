// The three languages the story is published in, chosen by the `?lang=` query parameter.
//
// English is the bare URL and needs no parameter: `/` is English, `/?lang=ca` is Catalan,
// `/?lang=de` is German. Anything else — a missing parameter, a language we do not publish, a
// typo — is English, because a reader who asked for nothing in particular should get the source
// language rather than an error.
//
// This used to sniff Accept-Language instead, which meant a German browser could not reach the
// English copy at all and no URL named the language it would render. A parameter is shareable,
// linkable, cacheable and reversible; a header is none of those.

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

// The locale a `?lang=` value asks for, or English.
//
// Next hands a repeated parameter over as an array, so `?lang=de&lang=ca` arrives as
// ["de", "ca"] rather than a string. Taking the first is arbitrary but it is a choice: the
// alternative is throwing on a URL a reader can produce by hand, and the first wins matches how
// the rest of the web reads duplicated parameters.
export function resolveLocale(value: string | string[] | undefined): Locale {
  const first = Array.isArray(value) ? value[0] : value;
  const normalised = first?.trim().toLowerCase();
  return isLocale(normalised) ? normalised : DEFAULT_LOCALE;
}

// The URL this locale is published at, site-relative. English is the bare path so the canonical
// address of the story has nothing in it; the other two name themselves.
export function localePath(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? "/" : `/?lang=${locale}`;
}

// The story file each locale reads. English keeps the unsuffixed name it has always had, because
// it is the source the other two are translated from.
export function storyFilename(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? "ROADMAP.md" : `ROADMAP.${locale}.md`;
}
