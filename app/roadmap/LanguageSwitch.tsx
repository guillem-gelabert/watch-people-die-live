"use client";

import { LOCALE_NAMES, localePath, type Locale } from "@/lib/i18n/config";
import { useI18n } from "./I18nContext";

// Display order, which is not LOCALES' order. LOCALES is the schema — hreflang, the JSON-LD
// language set, the translation tests all iterate it — so reordering it to suit a footer would
// move things that have nothing to do with a footer.
const ORDER: Locale[] = ["en", "de", "ca"];

// The three translations, at the foot of the story.
//
// Plain anchors, not buttons and not a router push. The language is a property of the URL, so
// changing it is a navigation: the link is shareable, middle-clickable, crawlable, and works with
// no JavaScript at all. A button calling router.replace() would be none of those, and the server
// has to re-render anyway — the prose is a different markdown file per language, not a dictionary
// swap the client could do on its own.
//
// The labels are the language codes the URL uses, so the control shows what the link does. The
// endonym goes in the accessible name instead, since "ca" read aloud is not a language.
export default function LanguageSwitch() {
  const { locale } = useI18n();
  return (
    <nav id="story-langs" aria-label="Language">
      <ul>
        {ORDER.map((l) => (
          <li key={l}>
            {l === locale ? (
              // The current language is not a link. It would navigate to the page you are already
              // on, and `aria-current` is what tells a screen reader which one is active.
              <span aria-current="true" lang={l}>
                {l}
              </span>
            ) : (
              <a href={localePath(l)} hrefLang={l} lang={l} title={LOCALE_NAMES[l]}>
                {l}
              </a>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
