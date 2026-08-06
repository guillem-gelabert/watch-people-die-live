"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { en, type Dictionary } from "@/lib/i18n/en";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

interface I18nValue {
  locale: Locale;
  d: Dictionary;
}

// English is the default value rather than a throwing one: the story is rendered under a
// provider in every real path, and a component pulled into a test or a story shell should still
// have words rather than an exception.
const I18nContext = createContext<I18nValue>({ locale: DEFAULT_LOCALE, d: en });

export function I18nProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: ReactNode;
}) {
  // The root layout is a shared server component that never sees the locale, so the document's
  // own language is set here — it is what a screen reader picks a voice from.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <I18nContext.Provider value={{ locale, d: dictionary }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

// The common case: a component only wants the words.
export function useDict(): Dictionary {
  return useContext(I18nContext).d;
}
