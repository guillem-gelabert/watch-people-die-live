"use client";

import Link from "next/link";
import { LOCALES, LOCALE_NAMES, LOCALE_SHORT, localeHref } from "@/lib/i18n/config";
import { useI18n } from "./I18nContext";

// Three links, always visible in the top corner. Links rather than a select: the locale is part
// of the URL, so each language is a real address a reader can bookmark or send to someone, and a
// crawler following them is exactly what the hreflang set in the page's metadata promises.
//
// `scroll={false}` because switching language mid-story should not throw the reader back to the
// globe — the section they were reading is the same section in the other file.
//
// `prefetch={false}` because these three sit in the corner of the opening screen, so Next was
// prefetching all of them the moment the globe appeared. Each one is a full RSC payload of the
// whole story — the server rereads the markdown and re-renders every section for it — and the
// trace showed five of them going out during the load of a page almost nobody switches away from.
// The switch is a deliberate act with a navigation's worth of patience behind it; it does not
// need to be instant, and it should not be paid for by every reader who never touches it.
export default function LanguageSwitcher() {
  const { locale, d } = useI18n();

  return (
    <nav id="story-lang" aria-label={d.chrome.languageChoose}>
      {LOCALES.map((code) => (
        <Link
          key={code}
          href={localeHref(code)}
          scroll={false}
          prefetch={false}
          hrefLang={code}
          lang={code}
          className="story-lang-link"
          aria-current={code === locale ? "true" : undefined}
        >
          <span aria-hidden="true">{LOCALE_SHORT[code]}</span>
          <span className="sr-only">{LOCALE_NAMES[code]}</span>
        </Link>
      ))}
    </nav>
  );
}
