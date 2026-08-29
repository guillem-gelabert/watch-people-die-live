import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALES, storyFilename } from "../../lib/i18n/config";
import { roadmapSections } from "./storySections";
import causes from "../../data/causes.json";
import mortality from "../../data/mortality-age-sex.json";

// The three story files are separate documents, but only their prose is allowed to differ. The
// keys are what useStorySlots() registers every figure against, the skies drive the palette, and
// the bracketed placeholders are what summons a chart — a typo in any of them in a translation
// silently drops a figure out of that language, which is exactly the kind of thing nobody
// notices until a reader in that language reports a blank page.
const SLOT = /^\[[^\]]+\]$/;

function read(locale: (typeof LOCALES)[number]): string {
  return readFileSync(join(process.cwd(), "docs", storyFilename(locale)), "utf8");
}

const slotsOf = (markdown: string) =>
  markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => SLOT.test(line));

describe("story translations", () => {
  const english = roadmapSections(read("en"));

  it("finds every section in English", () => {
    expect(english.length).toBeGreaterThan(8);
  });

  for (const locale of LOCALES.filter((l) => l !== "en")) {
    describe(locale, () => {
      const sections = roadmapSections(read(locale));

      it("has the same sections, in the same order, with the same skies", () => {
        expect(sections.map((s) => s.key)).toEqual(english.map((s) => s.key));
        expect(sections.map((s) => s.sky)).toEqual(english.map((s) => s.sky));
        expect(sections.map((s) => s.heading)).toEqual(english.map((s) => s.heading));
      });

      it("summons the same figures, in the same order", () => {
        expect(slotsOf(read(locale))).toEqual(slotsOf(read("en")));
      });

      it("translates every heading and subtitle", () => {
        for (const [i, section] of sections.entries()) {
          const source = english[i]!;
          if (source.subtitle) expect(section.subtitle).toBeTruthy();
          expect(section.label.length).toBeGreaterThan(0);
          expect(section.body.length).toBeGreaterThan(0);
        }
      });
    });
  }
});

// The who chapter states the data's vintage in prose — "the 2021 estimates", "2023 figures" — in
// all three languages, because those years change only on a manual data commit. This is the
// forcing function for that commit: refresh causes.json or mortality-age-sex.json to a new year
// and forget the prose, and the suite fails instead of the story shipping a stale claim.
describe("who chapter vintages", () => {
  for (const locale of LOCALES) {
    it(`states the current data years in ${locale}`, () => {
      const who = roadmapSections(read(locale)).find((section) => section.key === "who");
      expect(who).toBeDefined();
      expect(who!.body).toContain(String(causes.year));
      expect(who!.body).toContain(String(mortality.year));
    });
  }
});
