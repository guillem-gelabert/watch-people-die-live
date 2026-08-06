import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Metadata } from "next";
import StoryClient from "./roadmap/StoryClient";
import { LOCALES, localeHref, resolveLocale, storyFilename } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";

interface PageProps {
  searchParams: Promise<{ lang?: string | string[] }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const locale = resolveLocale((await searchParams).lang);
  const { meta } = getDictionary(locale);
  const url = localeHref(locale);
  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: url,
      languages: Object.fromEntries(LOCALES.map((l) => [l, localeHref(l)])),
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

export default async function Page({ searchParams }: PageProps) {
  const locale = resolveLocale((await searchParams).lang);
  // The whole story — running order, section skies and prose — is authored as one markdown file
  // per language and sliced client-side by roadmapSections(). The section keys inside it are
  // shared across all three, because they are what the figures are registered against.
  const markdown = await readFile(join(process.cwd(), "docs", storyFilename(locale)), "utf8");
  return <StoryClient markdown={markdown} locale={locale} dictionary={getDictionary(locale)} />;
}
