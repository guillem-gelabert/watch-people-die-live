import { describe, expect, it } from "vitest";
import { en } from "./en";
import { getDictionary } from "./index";
import { LOCALES, DEFAULT_LOCALE } from "./config";

// fill() replaces `{name}` by a regex and leaves anything it cannot match in place. So a
// translation that drops a placeholder does not throw — it silently ships a line missing the
// number it existed to carry ("1 in of the world's a year"), and one that invents a placeholder
// ships a literal brace to the reader. Neither is a type error, because both sides are `string`.
//
// This walks every translated string against the English original and holds the placeholder sets
// equal. It covers the whole dictionary, not just the keys added last.

const placeholders = (value: string): string[] =>
  [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string).sort();

type Node = { [key: string]: Node | string };

function walk(source: Node, target: Node, path: string[], out: [string, string[], string[]][]) {
  for (const [key, value] of Object.entries(source)) {
    const other = target?.[key];
    const here = [...path, key];
    if (typeof value === "string") {
      // A missing key is the type system's job; this only speaks to the ones that exist.
      if (typeof other === "string")
        out.push([here.join("."), placeholders(value), placeholders(other)]);
    } else if (value && typeof value === "object") {
      walk(value, (other ?? {}) as Node, here, out);
    }
  }
}

describe("dictionary placeholders", () => {
  const others = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

  it.each(others)("%s carries exactly the placeholders English does", (locale) => {
    const rows: [string, string[], string[]][] = [];
    walk(en as unknown as Node, getDictionary(locale) as unknown as Node, [], rows);

    const mismatched = rows
      .filter(([, source, target]) => source.join("|") !== target.join("|"))
      .map(([key, source, target]) => `${key}: en {${source}} vs ${locale} {${target}}`);

    expect(mismatched).toEqual([]);
    // A guard on the walk itself: if it ever stops descending, the assertion above passes
    // vacuously and this is what notices.
    expect(rows.length).toBeGreaterThan(100);
  });

  it("checks the derivation's own templates", () => {
    // Named explicitly because these are the newest and the most placeholder-dense.
    expect(placeholders(en.globe.math.share)).toEqual(["odds", "total"]);
    expect(placeholders(en.globe.math.cellOf)).toEqual(["country"]);
    expect(placeholders(en.globe.math.seasonalIn)).toEqual(["month"]);
    expect(placeholders(en.globe.math.causeOptions)).toEqual(["count"]);
  });
});
