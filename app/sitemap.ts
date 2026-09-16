import type { MetadataRoute } from "next";
import { LOCALES, localePath } from "@/lib/i18n/config";
import { absoluteUrl } from "@/lib/site";

// One entry per language. The story used to be a single URL whose language was sniffed from the
// Accept-Language header, which meant two of the three translations had no address at all and
// nothing could link to or index them. Each now names itself in the query string, and `alternates`
// tells a crawler the three are the same work rather than three pages of thin duplicate content.
export default function sitemap(): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(LOCALES.map((l) => [l, absoluteUrl(localePath(l))]));
  return LOCALES.map((locale) => ({
    url: absoluteUrl(localePath(locale)),
    changeFrequency: "monthly" as const,
    // English is the source the other two are translated from, so it is the copy to prefer when
    // a crawler has to pick one.
    priority: locale === "en" ? 1 : 0.8,
    alternates: { languages },
  }));
}
