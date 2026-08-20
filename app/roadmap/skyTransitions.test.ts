import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The sky cross-fade is declared twice, once on body in globe.css and once on .story in
// roadmap.css, because the two surfaces live in different files (see the comments on both
// rules). Each has its own reduced-motion twin that snaps the transition off instead of
// leaving it to run — StoryClient now writes body's colour in a layout effect specifically
// so that snap lands in the same frame as .story's, and a reduced-motion rule that drifts out
// of sync on either side turns that guarantee back into a flash of the previous sky. This test
// reads both stylesheets from disk and asserts each half of the pairing is still there.
//
// postcss is only a transitive dependency here — stylelint pulls it in, not this project — and
// pnpm's strict node_modules layout means importing it directly from a project file fails
// module resolution. So this is a small hand-rolled scan, sized to exactly the CSS shapes
// globe.css and roadmap.css actually use: flat rules and one level of @media nesting, comments
// stripped before parsing.

interface CssRule {
  selectors: string[];
  body: string;
  mediaPrelude: string | null;
}

function parseRules(css: string): CssRule[] {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: CssRule[] = [];

  function parseBlock(text: string, mediaPrelude: string | null): void {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf("{", i);
      if (open === -1) break;
      const prelude = text.slice(i, open).trim();
      // Walk to the matching close brace. The stylesheets here only ever nest one level deep
      // (a plain rule, or an @media wrapping plain rules), so a simple depth count is enough.
      let depth = 1;
      let j = open + 1;
      while (j < text.length && depth > 0) {
        if (text[j] === "{") depth++;
        else if (text[j] === "}") depth--;
        j++;
      }
      const body = text.slice(open + 1, j - 1);
      if (prelude.startsWith("@media")) {
        parseBlock(body, prelude);
      } else if (!prelude.startsWith("@") && prelude.length > 0) {
        rules.push({ selectors: prelude.split(",").map((s) => s.trim()), body, mediaPrelude });
      }
      i = j;
    }
  }

  parseBlock(stripped, null);
  return rules;
}

function declarations(body: string): Array<{ property: string; value: string }> {
  return body
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const colon = d.indexOf(":");
      return { property: d.slice(0, colon).trim(), value: d.slice(colon + 1).trim() };
    });
}

const REDUCED_MOTION = /prefers-reduced-motion:\s*reduce/;
const ZERO_DURATION = /^(0s|0\.01ms)$/i;

function declaresBackgroundColorTransition(body: string): boolean {
  return declarations(body).some(
    (d) => d.property === "transition" && d.value.includes("background-color"),
  );
}

function disablesTransition(body: string): boolean {
  return declarations(body).some((d) => {
    if (d.property === "transition") {
      return d.value === "none" || d.value.split(/\s+/).some((token) => ZERO_DURATION.test(token));
    }
    if (d.property === "transition-duration") return ZERO_DURATION.test(d.value);
    return false;
  });
}

function rulesFor(rules: CssRule[], selector: string, reducedMotion: boolean): CssRule[] {
  return rules.filter((r) => {
    if (!r.selectors.includes(selector)) return false;
    const inReducedMotion = r.mediaPrelude !== null && REDUCED_MOTION.test(r.mediaPrelude);
    return inReducedMotion === reducedMotion;
  });
}

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const PAIRS = [
  { file: "app/globe.css", selector: "body" },
  { file: "app/roadmap/roadmap.css", selector: ".story" },
] as const;

describe("sky cross-fade and its reduced-motion twin stay paired", () => {
  for (const { file, selector } of PAIRS) {
    describe(`${file} (${selector})`, () => {
      const rules = parseRules(read(file));

      it("declares a background-color transition outside prefers-reduced-motion", () => {
        const matches = rulesFor(rules, selector, false);
        expect(matches.some((r) => declaresBackgroundColorTransition(r.body))).toBe(true);
      });

      it("turns that transition off under prefers-reduced-motion: reduce", () => {
        const matches = rulesFor(rules, selector, true);
        expect(matches.some((r) => disablesTransition(r.body))).toBe(true);
      });
    });
  }
});
