import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { causeLabel } from "./causes";
import { ca } from "./ca";
import { de } from "./de";
import { en } from "./en";
import { LOCALES } from "./config";

// The cause tables are keyed by the GBD labels in data/causes.json, and nothing in the type
// system connects the two — a new export drops in new labels and every one of them would quietly
// print in English inside a Catalan sentence. This is the connection.
//
// The fallback table in app/globe/persona.ts can also reach a reader, on any country the GBD
// export has no cell for, so its labels are held to the same standard. They are read out of the
// source rather than duplicated here, so adding one there is caught here.

const causesJson = JSON.parse(readFileSync(join(process.cwd(), "data", "causes.json"), "utf8")) as {
  causes: string[];
};

const personaSource = readFileSync(join(process.cwd(), "app", "globe", "persona.ts"), "utf8");
const fallbackLabels = [...personaSource.matchAll(/label: "([^"]+)"/g)].map((m) => m[1] as string);

const reachable = [...new Set([...causesJson.causes, ...fallbackLabels])];

describe("cause labels", () => {
  it("finds both the data file's causes and the fallback table's", () => {
    expect(causesJson.causes.length).toBeGreaterThan(100);
    expect(fallbackLabels).toContain("birth asphyxia");
    // The fallback table names causes the export also has, so the union is the smaller number.
    expect(reachable.length).toBeGreaterThanOrEqual(causesJson.causes.length);
  });

  for (const [name, dictionary] of [
    ["ca", ca],
    ["de", de],
  ] as const) {
    describe(name, () => {
      it("translates every cause a reader can be shown", () => {
        const missing = reachable.filter((label) => !(label in dictionary.causes));
        expect(missing).toEqual([]);
      });

      it("translates nothing the data no longer contains", () => {
        const stale = Object.keys(dictionary.causes).filter((label) => !reachable.includes(label));
        expect(stale).toEqual([]);
      });

      it("never leaves a label as its English self by accident", () => {
        // A handful are genuinely the same word in every language — an acronym, a disease named
        // after a person. Anything else matching its key is an untranslated placeholder.
        const SAME_IN_EVERY_LANGUAGE = new Set([
          "COPD",
          "covid-19", // German capitalises it; Catalan does not
          "asthma",
          "malaria",
          "dengue",
          "diabetes",
          "meningitis",
          "endocarditis",
          "mesothelioma",
          "pancreatitis",
          "appendicitis",
          "leishmaniasis",
          "schistosomiasis",
          "pneumoconiosis",
        ]);
        const untranslated = Object.entries(dictionary.causes)
          .filter(([key, value]) => key === value && !SAME_IN_EVERY_LANGUAGE.has(key))
          .map(([key]) => key);
        expect(untranslated).toEqual([]);
      });
    });
  }
});

describe("causeLabel", () => {
  it("names a cause in the reader's language", () => {
    expect(causeLabel(ca.causes, "lung cancer")).toBe("càncer de pulmó");
    expect(causeLabel(de.causes, "lung cancer")).toBe("Lungenkrebs");
  });

  it("passes an unmapped label through as the English it already was", () => {
    // What a GBD export adding a cause looks like before anyone translates it.
    expect(causeLabel(ca.causes, "some new gbd cause")).toBe("some new gbd cause");
    expect(causeLabel(en.causes, "lung cancer")).toBe("lung cancer");
  });

  it("is the identity for English, which needs no table", () => {
    expect(Object.keys(en.causes)).toEqual([]);
    expect(LOCALES).toContain("en");
  });
});
