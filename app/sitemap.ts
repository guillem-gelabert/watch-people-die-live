import type { MetadataRoute } from "next";
import { LOCALES, localeHref } from "@/lib/i18n/config";
import { absoluteUrl } from "@/lib/site";

// Three URLs, because the locale rides in `?lang=` rather than a path segment (see
// lib/i18n/config.ts) — so `/`, `/?lang=ca` and `/?lang=de` really are three addresses serving
// three translations of one page, and each is listed with the full alternates set. That set is
// the same promise the page's own hreflang links make; a sitemap is just the form of it a
// crawler reads before it has fetched anything.
export default function sitemap(): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(LOCALES.map((l) => [l, absoluteUrl(localeHref(l))]));

  return LOCALES.map((locale) => ({
    url: absoluteUrl(localeHref(locale)),
    changeFrequency: "monthly" as const,
    priority: locale === "en" ? 1 : 0.8,
    alternates: { languages },
  }));
}
