import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { headers } from "next/headers";
import type { Metadata } from "next";
import StoryClient from "./roadmap/StoryClient";
import { I18nProvider } from "./roadmap/I18nContext";
import { LOCALES, resolveLocaleFromHeader, storyFilename } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { absoluteUrl } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const locale = resolveLocaleFromHeader(headersList.get("accept-language") || undefined);
  const { meta } = getDictionary(locale);
  const url = "/";
  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: url,
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

export default async function Page() {
  const headersList = await headers();
  const locale = resolveLocaleFromHeader(headersList.get("accept-language") || undefined);
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
