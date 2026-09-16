import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Metadata } from "next";
import StoryClient from "./roadmap/StoryClient";
import { I18nProvider } from "./roadmap/I18nContext";
import { LOCALES, localePath, resolveLocale, storyFilename } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { absoluteUrl } from "@/lib/site";

// Next passes search params to a server page as a promise, and reading them is what opts this
// route out of static rendering — which it has to be, since the same path renders three
// languages.
type Search = Promise<Record<string, string | string[] | undefined>>;

// The three copies, for the hreflang set. `x-default` points at English because that is the bare
// URL and the language a reader gets when they express no preference.
const LANGUAGE_ALTERNATES: Record<string, string> = {
  ...Object.fromEntries(LOCALES.map((l) => [l, localePath(l)])),
  "x-default": "/",
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Search;
}): Promise<Metadata> {
  const locale = resolveLocale((await searchParams).lang);
  const { meta } = getDictionary(locale);
  const url = localePath(locale);
  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      // Each language is its own canonical URL now that each has one. Pointing all three at "/"
      // would tell a crawler the Catalan and German copies are duplicates of the English.
      canonical: url,
      languages: LANGUAGE_ALTERNATES,
    },
    openGraph: {
      type: "website",
      title: meta.title,
      description: meta.ogDescription,
      url,
      images: [{ url: "/social-preview.png", width: 1200, height: 630 }],
      siteName: meta.title,
      locale,
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.twitterDescription,
      images: ["/social-preview.png"],
    },
  };
}

export default async function Page({ searchParams }: { searchParams: Search }) {
  const locale = resolveLocale((await searchParams).lang);
  const { meta } = getDictionary(locale);
  // The whole story — running order, section skies and prose — is authored as one markdown file
  // per language and sliced client-side by roadmapSections(). The section keys inside it are
  // shared across all three, because they are what the figures are registered against.
  const markdown = await readFile(join(process.cwd(), "docs", storyFilename(locale)), "utf8");

  // The page is one long canvas-and-SVG scroll, so a crawler reading it gets a title, a
  // description and very little else it can attribute to the site as a whole. This states the
  // three things the markup cannot: that these are three translations of one work, what it is,
  // and which language this copy is in. Deliberately no `Article` — that would want an author
  // and a publication date, and the story carries neither.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: meta.title,
    description: meta.description,
    url: absoluteUrl("/"),
    inLanguage: LOCALES,
  };

  return (
    <I18nProvider locale={locale} dictionary={getDictionary(locale)}>
      <script
        type="application/ld+json"
        // The payload is three dictionary strings and a URL this file built, so there is nothing
        // reader-supplied in it; JSON.stringify is the escaping.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <StoryClient markdown={markdown} />
    </I18nProvider>
  );
}
