// Pins the label-from-source derivation: a causes.json built from ghe-2023-deaths.csv must never
// again say 2021 because a literal said so.
import { describe, expect, it } from "vitest";
import { yearFromSourceName } from "./build-causes";

describe("yearFromSourceName", () => {
  it("reads the release year from the fetcher's filename pattern", () => {
    expect(yearFromSourceName("ghe-2021-deaths.csv")).toBe(2021);
    expect(yearFromSourceName("ghe-2023-deaths.csv.gz")).toBe(2023);
    expect(yearFromSourceName("/some/where/data/source/who-ghe/ghe-2022-deaths.csv")).toBe(2022);
  });

  it("returns null rather than guessing when the name does not match", () => {
    expect(yearFromSourceName("deaths.csv")).toBeNull();
    expect(yearFromSourceName("ghe-21-deaths.csv")).toBeNull();
    expect(yearFromSourceName("ghe-2021-deaths.xlsx")).toBeNull();
    expect(yearFromSourceName("")).toBeNull();
  });
});
