import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { SnapshotManager, writeSnapshotAtomic } from "./acled-cache";
import { ACLED_SCHEMA_VERSION, isCompleteSnapshot, type ConflictsPayload } from "./acled-weekly";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

function payload(generatedAt: string, fatalities = 1): ConflictsPayload {
  const weeks = Array.from({ length: 12 }, (_, index) => ({
    week: `2026-${String(index + 1).padStart(2, "0")}-01`,
    values: [fatalities],
    othersBreakdown: [],
  }));
  return {
    schemaVersion: ACLED_SCHEMA_VERSION,
    source: "test",
    license: "test",
    granularity: "week",
    spatialPrecision: "admin1-centroid",
    window: { start: weeks[0]!.week, end: weeks[11]!.week, weeks: 12 },
    commonThrough: weeks[11]!.week,
    generatedAt,
    totalFatalities: fatalities * 12,
    weeklyStack: { countries: ["Others"], weeks },
    regions: [],
    byCountry: [],
    cells: [],
    ewma: {
      halfLifeWeeks: 4,
      clampPercentile: 10,
      lower: fatalities,
      upper: fatalities,
      curve: Array(12).fill(fatalities),
      predictedWeekly: fatalities,
      annualizedPrediction: fatalities * (365 / 7),
    },
    coverage: {
      regionalSources: Array.from({ length: 6 }, (_, index) => ({
        region: String(index),
        latestThrough: weeks[11]!.week,
        rowsRead: 1,
        rowsRetained: 1,
        invalidRows: 0,
      })),
      unmappedCountries: [],
      droppedFatalities: 0,
      placedFatalities: fatalities * 12,
    },
    freshness: { status: "fresh", ageHours: 0, refreshedAt: generatedAt },
  };
}

async function cachePath(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "acled-cache-test-"));
  directories.push(directory);
  return path.join(directory, "snapshot.json");
}

function manager(
  filename: string,
  build: () => Promise<ConflictsPayload>,
  now = Date.parse("2026-08-19T12:00:00Z"),
) {
  return new SnapshotManager({
    cacheFile: filename,
    build,
    validate: isCompleteSnapshot,
    empty: (note) => ({ ...payload(new Date(now).toISOString(), 0), note }),
    now: () => now,
  });
}

describe("ACLED persisted snapshot cache", () => {
  it("serves a fresh complete snapshot without refreshing", async () => {
    const filename = await cachePath();
    await writeSnapshotAtomic(filename, payload("2026-08-19T00:00:00Z"));
    let builds = 0;
    const result = await manager(filename, async () => {
      builds++;
      return payload("2026-08-19T12:00:00Z", 2);
    }).get();
    expect(result.needsRefresh).toBe(false);
    expect(result.payload.freshness.status).toBe("fresh");
    expect(builds).toBe(0);
  });

  it("serves stale immediately and replaces it only after a complete refresh", async () => {
    const filename = await cachePath();
    await writeSnapshotAtomic(filename, payload("2026-08-17T00:00:00Z"));
    const snapshots = manager(filename, async () => payload("2026-08-19T12:00:00Z", 3));
    const stale = await snapshots.get();
    expect(stale.needsRefresh).toBe(true);
    expect(stale.payload.freshness.status).toBe("stale");
    await snapshots.refresh();
    expect(JSON.parse(await readFile(filename, "utf8")).totalFatalities).toBe(36);
  });

  it.each(["missing", "corrupt"])("waits for a cold %s cache to refresh", async (state) => {
    const filename = await cachePath();
    if (state === "corrupt") await writeFile(filename, "not-json");
    const result = await manager(filename, async () => payload("2026-08-19T12:00:00Z", 4)).get();
    expect(result.payload.totalFatalities).toBe(48);
    expect(result.payload.freshness.status).toBe("fresh");
  });

  it("deduplicates concurrent refreshes", async () => {
    const filename = await cachePath();
    let builds = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const snapshots = manager(filename, async () => {
      builds++;
      await gate;
      return payload("2026-08-19T12:00:00Z", 5);
    });
    const first = snapshots.refresh();
    const second = snapshots.refresh();
    expect(builds).toBe(1);
    release();
    await Promise.all([first, second]);
    expect(builds).toBe(1);
  });

  it("never replaces the last complete snapshot after a partial refresh failure", async () => {
    const filename = await cachePath();
    const previous = payload("2026-08-17T00:00:00Z", 2);
    await writeSnapshotAtomic(filename, previous);
    const snapshots = manager(filename, async () => {
      throw new Error("region 4 download failed");
    });
    expect((await snapshots.get()).payload.totalFatalities).toBe(24);
    await expect(snapshots.refresh()).rejects.toThrow("region 4");
    expect(JSON.parse(await readFile(filename, "utf8"))).toEqual(previous);
  });
});
