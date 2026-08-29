// The rules worth pinning are the ones whose failure is silent: a stale cache shadowing a fresh
// commit, a gate that never fires, a temp file left behind by a failed write.
import { mkdtemp, rm } from "node:fs/promises";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ACLED_SCHEMA_VERSION, type ConflictsPayload } from "./acled-weekly";
import {
  DEFAULT_MAX_AGE_HOURS,
  decideRefresh,
  pickFreshest,
  readSnapshotFile,
  resolveCachePath,
  resolveMaxAgeHours,
  shouldDownloadWorkbooks,
  tryWriteSnapshotFile,
  verifiedAtMs,
  writeSnapshotFile,
} from "./conflict-snapshot";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

async function tempDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "conflict-snapshot-"));
  directories.push(directory);
  return directory;
}

// The minimum that satisfies isCompleteSnapshot — 12 weeks, exactly 6 regional sources, arrays for
// regions and cells. Cheaper than driving ExcelJS through buildSnapshot, and if isCompleteSnapshot
// tightens later this breaks loudly, which is the correct outcome.
function completeSnapshot(overrides: Partial<ConflictsPayload> = {}): ConflictsPayload {
  return {
    schemaVersion: ACLED_SCHEMA_VERSION,
    source: "test",
    license: "test",
    granularity: "week",
    spatialPrecision: "admin1-centroid",
    window: { start: "2026-05-16", end: "2026-08-01", weeks: 12 },
    commonThrough: "2026-08-01",
    generatedAt: "2026-08-21T19:16:15.761Z",
    totalFatalities: 0,
    weeklyStack: {
      keys: [],
      weeks: Array.from({ length: 12 }, (_, i) => ({
        week: `2026-05-${String(16 + i).padStart(2, "0")}`,
        segments: [],
      })),
    },
    regions: [],
    byCountry: [],
    cells: [],
    ewma: {
      halfLifeWeeks: 4,
      clampPercentile: 10,
      lower: 0,
      upper: 0,
      curve: [],
      predictedWeekly: 0,
      annualizedPrediction: 0,
    },
    coverage: {
      regionalSources: Array.from({ length: 6 }, (_, i) => ({
        region: `Region ${i}`,
        latestThrough: "2026-08-01",
        rowsRead: 0,
        rowsRetained: 0,
        invalidRows: 0,
      })),
      unmappedCountries: [],
      droppedFatalities: 0,
      placedFatalities: 0,
    },
    ...overrides,
  };
}

describe("verifiedAtMs", () => {
  it("prefers verifiedAt over generatedAt", () => {
    const payload = completeSnapshot({
      generatedAt: "2026-08-01T00:00:00.000Z",
      verifiedAt: "2026-08-20T00:00:00.000Z",
    });
    expect(verifiedAtMs(payload)).toBe(Date.parse("2026-08-20T00:00:00.000Z"));
  });

  it("falls back to generatedAt when verifiedAt is absent", () => {
    const payload = completeSnapshot({ generatedAt: "2026-08-01T00:00:00.000Z" });
    expect(verifiedAtMs(payload)).toBe(Date.parse("2026-08-01T00:00:00.000Z"));
  });

  it("returns -Infinity for an unparseable timestamp, so it always loses and always checks", () => {
    expect(verifiedAtMs(completeSnapshot({ generatedAt: "not a date" }))).toBe(-Infinity);
  });
});

describe("pickFreshest", () => {
  const committed = completeSnapshot({ generatedAt: "2026-08-01T00:00:00.000Z" });
  const cache = completeSnapshot({ generatedAt: "2026-08-20T00:00:00.000Z" });

  it("takes the cache when it is newer", () => {
    const best = pickFreshest([
      { origin: "committed", payload: committed },
      { origin: "cache", payload: cache },
    ]);
    expect(best?.origin).toBe("cache");
  });

  it("takes the committed file when it is newer", () => {
    const best = pickFreshest([
      { origin: "committed", payload: cache },
      { origin: "cache", payload: committed },
    ]);
    expect(best?.origin).toBe("committed");
  });

  it("breaks an exact tie to the committed file", () => {
    const best = pickFreshest([
      { origin: "committed", payload: committed },
      { origin: "cache", payload: completeSnapshot({ generatedAt: committed.generatedAt }) },
    ]);
    expect(best?.origin).toBe("committed");
  });

  // The failure this prevents: someone rebuilds and commits data/conflicts.json to fix something,
  // and a month-old Railway build-cache entry silently shadows it.
  it("does not let a month-old cache shadow a just-committed snapshot", () => {
    const best = pickFreshest([
      {
        origin: "committed",
        payload: completeSnapshot({ generatedAt: "2026-08-29T12:00:00.000Z" }),
      },
      { origin: "cache", payload: completeSnapshot({ generatedAt: "2026-07-29T12:00:00.000Z" }) },
    ]);
    expect(best?.origin).toBe("committed");
  });

  it("ignores null candidates and returns null when there are none", () => {
    expect(pickFreshest([{ origin: "committed", payload: null }])?.origin).toBeUndefined();
    expect(
      pickFreshest([
        { origin: "committed", payload: null },
        { origin: "cache", payload: cache },
      ])?.origin,
    ).toBe("cache");
  });
});

describe("resolveMaxAgeHours", () => {
  it("uses the fallback for undefined and empty", () => {
    expect(resolveMaxAgeHours(undefined, DEFAULT_MAX_AGE_HOURS).hours).toBe(DEFAULT_MAX_AGE_HOURS);
    expect(resolveMaxAgeHours("", DEFAULT_MAX_AGE_HOURS).hours).toBe(DEFAULT_MAX_AGE_HOURS);
  });

  it("accepts zero, which means always check", () => {
    expect(resolveMaxAgeHours("0", DEFAULT_MAX_AGE_HOURS)).toEqual({ hours: 0 });
  });

  it("accepts a plain number of hours", () => {
    expect(resolveMaxAgeHours("12", DEFAULT_MAX_AGE_HOURS)).toEqual({ hours: 12 });
  });

  it("warns and falls back rather than failing the build on nonsense", () => {
    for (const raw of ["abc", "-1"]) {
      const resolved = resolveMaxAgeHours(raw, DEFAULT_MAX_AGE_HOURS);
      expect(resolved.hours).toBe(DEFAULT_MAX_AGE_HOURS);
      expect(resolved.warning).toContain("CONFLICTS_MAX_AGE_HOURS");
    }
  });
});

describe("decideRefresh", () => {
  const now = Date.parse("2026-08-29T12:00:00.000Z");
  const hoursAgo = (h: number) =>
    completeSnapshot({ generatedAt: new Date(now - h * 3_600_000).toISOString() });
  const base = { now, maxAgeHours: DEFAULT_MAX_AGE_HOURS, force: false, skipRequested: false };

  it("lets the skip flag outrank force", () => {
    expect(
      decideRefresh({ ...base, snapshot: hoursAgo(1), force: true, skipRequested: true }),
    ).toEqual({ action: "skip", reason: "skip-flag" });
  });

  it("skips under the threshold", () => {
    const decision = decideRefresh({ ...base, snapshot: hoursAgo(1) });
    expect(decision.action).toBe("skip");
    expect(decision).toMatchObject({ reason: "age-gate", maxAgeHours: 72 });
  });

  it("checks at and over the threshold", () => {
    expect(decideRefresh({ ...base, snapshot: hoursAgo(72) })).toMatchObject({ action: "check" });
    expect(decideRefresh({ ...base, snapshot: hoursAgo(100) })).toMatchObject({ action: "check" });
  });

  it("checks when there is no snapshot at all, whatever the threshold", () => {
    expect(decideRefresh({ ...base, snapshot: null, maxAgeHours: 10_000 })).toEqual({
      action: "check",
      reason: "no-snapshot",
    });
  });

  it("checks when forced, even on a snapshot from a minute ago", () => {
    expect(decideRefresh({ ...base, snapshot: hoursAgo(1 / 60), force: true })).toEqual({
      action: "check",
      reason: "forced",
    });
  });

  it("always checks at maxAgeHours 0", () => {
    expect(decideRefresh({ ...base, snapshot: hoursAgo(0), maxAgeHours: 0 })).toMatchObject({
      action: "check",
    });
  });
});

describe("shouldDownloadWorkbooks", () => {
  const snapshot = completeSnapshot({ commonThrough: "2026-08-01" });

  it("skips the six downloads when upstream is still on our week", () => {
    expect(shouldDownloadWorkbooks({ snapshot, upstreamCutoff: "2026-08-01", force: false })).toBe(
      false,
    );
  });

  it("downloads when upstream has moved on", () => {
    expect(shouldDownloadWorkbooks({ snapshot, upstreamCutoff: "2026-08-15", force: false })).toBe(
      true,
    );
  });

  it("downloads when there is no snapshot", () => {
    expect(
      shouldDownloadWorkbooks({ snapshot: null, upstreamCutoff: "2026-08-01", force: false }),
    ).toBe(true);
  });

  // The case equality cannot see: the modelling changed, the cutoff did not.
  it("downloads when forced even though the cutoff matches", () => {
    expect(shouldDownloadWorkbooks({ snapshot, upstreamCutoff: "2026-08-01", force: true })).toBe(
      true,
    );
  });
});

describe("readSnapshotFile", () => {
  it("reads a complete snapshot back", async () => {
    const file = path.join(await tempDirectory(), "conflicts.json");
    writeSnapshotFile(file, completeSnapshot({ commonThrough: "2026-08-15" }));
    expect(readSnapshotFile(file)?.commonThrough).toBe("2026-08-15");
  });

  it("returns null for missing, invalid JSON, and valid JSON of the wrong shape", async () => {
    const directory = await tempDirectory();
    expect(readSnapshotFile(path.join(directory, "absent.json"))).toBeNull();

    const broken = path.join(directory, "broken.json");
    fs.writeFileSync(broken, "{");
    expect(readSnapshotFile(broken)).toBeNull();

    const wrongShape = path.join(directory, "wrong.json");
    fs.writeFileSync(wrongShape, JSON.stringify({ schemaVersion: 1 }));
    expect(readSnapshotFile(wrongShape)).toBeNull();
  });

  it("prunes a corrupt file only when asked, so the cache self-heals and the commit is untouched", async () => {
    const directory = await tempDirectory();

    const kept = path.join(directory, "kept.json");
    fs.writeFileSync(kept, "{");
    expect(readSnapshotFile(kept)).toBeNull();
    expect(fs.existsSync(kept)).toBe(true);

    const pruned = path.join(directory, "pruned.json");
    fs.writeFileSync(pruned, "{");
    expect(readSnapshotFile(pruned, { pruneOnCorrupt: true })).toBeNull();
    expect(fs.existsSync(pruned)).toBe(false);
  });
});

describe("writeSnapshotFile", () => {
  it("round-trips and leaves no temp file behind", async () => {
    const directory = await tempDirectory();
    const file = path.join(directory, "conflicts.json");
    writeSnapshotFile(file, completeSnapshot());
    expect(readSnapshotFile(file)).not.toBeNull();
    expect(fs.readdirSync(directory).filter((n) => n.includes(".tmp-"))).toEqual([]);
  });

  it("cleans up its temp file when the write fails", async () => {
    const directory = await tempDirectory();
    const readOnly = path.join(directory, "read-only");
    fs.mkdirSync(readOnly);
    const file = path.join(readOnly, "conflicts.json");
    fs.chmodSync(readOnly, 0o500);
    try {
      expect(() => {
        writeSnapshotFile(file, completeSnapshot());
      }).toThrow();
      expect(fs.readdirSync(readOnly).filter((n) => n.includes(".tmp-"))).toEqual([]);
    } finally {
      fs.chmodSync(readOnly, 0o700);
    }
  });

  it("tryWriteSnapshotFile reports failure instead of throwing", async () => {
    const directory = await tempDirectory();
    const readOnly = path.join(directory, "read-only");
    fs.mkdirSync(readOnly);
    fs.chmodSync(readOnly, 0o500);
    try {
      expect(tryWriteSnapshotFile(path.join(readOnly, "conflicts.json"), completeSnapshot())).toBe(
        false,
      );
    } finally {
      fs.chmodSync(readOnly, 0o700);
    }
  });
});

describe("resolveCachePath", () => {
  it("defaults under the build-cache mount, namespaced by schema version", () => {
    expect(resolveCachePath("/app", undefined)).toBe(
      `/app/node_modules/.cache/conflicts/v${ACLED_SCHEMA_VERSION}/conflicts.json`,
    );
  });

  it("honours an explicit directory", () => {
    expect(resolveCachePath("/app", "/tmp/elsewhere")).toBe("/tmp/elsewhere/conflicts.json");
  });

  it("treats an empty override as disabling the layer", () => {
    expect(resolveCachePath("/app", "")).toBeNull();
    expect(resolveCachePath("/app", "   ")).toBeNull();
  });
});
