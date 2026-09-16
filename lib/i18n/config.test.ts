import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, LOCALES, isLocale, localePath, resolveLocale } from "./config";

// The language is a property of the URL. These are the two directions of that: what a `?lang=`
// value resolves to, and what URL a locale is published at. They have to stay inverse, because
// the footer builds links with one and the page reads them back with the other.

describe("resolveLocale", () => {
  it("reads each published language", () => {
    for (const locale of LOCALES) expect(resolveLocale(locale)).toBe(locale);
  });

  it("falls back to English rather than failing on anything else", () => {
    // A reader can type any of these by hand, and none of them should be an error page.
    for (const value of [undefined, "", "   ", "fr", "es", "EN-GB", "null", "../etc/passwd"])
      expect(resolveLocale(value), String(value)).toBe(DEFAULT_LOCALE);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(resolveLocale("DE")).toBe("de");
    expect(resolveLocale(" ca ")).toBe("ca");
  });

  it("takes the first of a repeated parameter", () => {
    // Next hands `?lang=de&lang=ca` over as an array. Throwing on a URL a reader can produce by
    // hand would be worse than picking one, and first-wins is how the web reads duplicates.
    expect(resolveLocale(["de", "ca"])).toBe("de");
    expect(resolveLocale([])).toBe(DEFAULT_LOCALE);
  });
});

describe("localePath", () => {
  it("publishes English at the bare URL", () => {
    // The canonical address of the story has no parameter in it.
    expect(localePath("en")).toBe("/");
  });

  it("names the other languages in the query string", () => {
    expect(localePath("ca")).toBe("/?lang=ca");
    expect(localePath("de")).toBe("/?lang=de");
  });

  it("round-trips every locale through its own URL", () => {
    for (const locale of LOCALES) {
      const param = new URL(localePath(locale), "https://example.test").searchParams.get("lang");
      expect(resolveLocale(param ?? undefined), locale).toBe(locale);
    }
  });
});

describe("isLocale", () => {
  it("accepts exactly the published languages", () => {
    for (const locale of LOCALES) expect(isLocale(locale)).toBe(true);
    for (const value of ["fr", "es", 1, null, undefined, {}]) expect(isLocale(value)).toBe(false);
  });
});
