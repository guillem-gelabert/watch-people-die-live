// Deciding whether a build needs to talk to ACLED at all, and where the snapshot it already has
// might be found. Policy only — every function takes its inputs explicitly and reads neither
// `process.env` nor a module-relative path, so `scripts/build-conflicts.ts` stays a thin switch over
// `decideRefresh` and all of this is testable without a network or a real snapshot.
//
// Why it exists: the build used to contact ACLED on every push and download all six regional
// workbooks nearly every time — Africa's alone expands past 100 MB. On 2026-08-28 that got the
// Railway builder's IP blocked by ACLED's Imunify360 bot protection after seven builds in four
// hours. The guard that was supposed to prevent it compared the upstream cutoff against the
// *committed* data/conflicts.json, and since Railway builds from a fresh git checkout that file is
// whatever was last committed — so the comparison always said "rebuild", and the fresh snapshot the
// build produced was thrown away with the container.
import fs from "node:fs";
import path from "node:path";
import { ACLED_SCHEMA_VERSION, isCompleteSnapshot, type ConflictsPayload } from "./acled-weekly";

// ACLED publishes weekly and its workbooks already lag around two weeks, so checking three times a
// week is well inside the noise of how current the data can possibly be, while turning an unbounded
// per-push request rate into a bounded one. Not seven days: our gate and ACLED's publication do not
// phase-align, so a week-long gate can miss a whole cycle and leave the window three weeks back.
export const DEFAULT_MAX_AGE_HOURS = 72;

const CACHE_SUBDIRECTORY = path.join("node_modules", ".cache", "conflicts");

export type SnapshotOrigin = "committed" | "cache";

export interface SnapshotCandidate {
  origin: SnapshotOrigin;
  payload: ConflictsPayload | null;
}

export interface ResolvedSnapshot {
  origin: SnapshotOrigin;
  payload: ConflictsPayload;
}

// The clock the gate runs on. `verifiedAt` when we have it, `generatedAt` otherwise — both mean
// "when we last had contact with ACLED", which is the only thing that should decide whether to make
// contact again. `commonThrough` cannot do this job: ACLED's own lag means a snapshot built one
// second ago already carries a cutoff two weeks old, so any threshold over it either never fires or
// fires on every build.
export function verifiedAtMs(payload: ConflictsPayload): number {
  const parsed = Date.parse(payload.verifiedAt ?? payload.generatedAt);
  return Number.isNaN(parsed) ? -Infinity : parsed;
}

// Newest wins, ties to `committed`.
//
// Not strict precedence in either direction. "Cache always wins" is the dangerous one: Railway's
// build cache can survive weeks, so a hand-refreshed data/conflicts.json would be silently shadowed
// by a stale entry — breaking the exact mechanism someone would reach for when everything else is
// broken. "Committed always wins" makes the cache dead code, since the committed file is never
// absent. Newest-wins composes both, and the tie breaks to the tracked, auditable artifact.
//
// Known limitation, stated rather than pretended away: a cache entry written by a different git
// revision can win over a committed file rebuilt with new modelling code, if the cache entry is
// newer. Schema-version namespacing in `resolveCachePath` covers shape changes; for a pure numeric
// change — a different EWMA half-life, say — the answer is `--force`.
export function pickFreshest(candidates: SnapshotCandidate[]): ResolvedSnapshot | null {
  let best: ResolvedSnapshot | null = null;
  let bestMs = -Infinity;
  for (const { origin, payload } of candidates) {
    if (!payload) continue;
    const ms = verifiedAtMs(payload);
    // Strictly greater, so an exact tie leaves the earlier candidate standing. Callers pass
    // `committed` first for that reason.
    if (best === null || ms > bestMs) {
      best = { origin, payload };
      bestMs = ms;
    }
  }
  return best;
}

// A bad value must not fail a build over a tuning knob, so anything unparseable falls back to the
// default and says so. Zero is legal and means "always check" — the gate compares with `>=`, so it
// needs no special case.
export function resolveMaxAgeHours(
  raw: string | undefined,
  fallback: number,
): { hours: number; warning?: string } {
  if (raw === undefined || raw.trim() === "") return { hours: fallback };
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return {
      hours: fallback,
      warning: `CONFLICTS_MAX_AGE_HOURS is ${JSON.stringify(raw)}, which is not a number of hours — using ${fallback}h.`,
    };
  }
  return { hours: parsed };
}

export type RefreshDecision =
  | { action: "skip"; reason: "skip-flag" }
  | { action: "skip"; reason: "age-gate"; ageHours: number; maxAgeHours: number }
  | { action: "check"; reason: "stale" | "forced" | "no-snapshot" };

export function decideRefresh(input: {
  snapshot: ConflictsPayload | null;
  now: number;
  maxAgeHours: number;
  force: boolean;
  skipRequested: boolean;
}): RefreshDecision {
  // An explicit "do not touch the network" outranks "refresh now" — SKIP_CONFLICTS_BUILD is the
  // hotfix hatch for an upstream outage, and a --force left in a command line should not defeat it.
  if (input.skipRequested) return { action: "skip", reason: "skip-flag" };
  if (input.force) return { action: "check", reason: "forced" };
  if (!input.snapshot) return { action: "check", reason: "no-snapshot" };

  const ageHours = (input.now - verifiedAtMs(input.snapshot)) / 3_600_000;
  if (ageHours >= input.maxAgeHours) return { action: "check", reason: "stale" };
  return { action: "skip", reason: "age-gate", ageHours, maxAgeHours: input.maxAgeHours };
}

// Asked only after `upstreamCutoff()` has answered. Equality means ACLED is still publishing the
// same week we already hold, so the six workbook downloads would reproduce what we have.
//
// `--force` overrides equality deliberately: it is the only way to rebuild after a change to the
// modelling that produces different numbers from an unchanged cutoff.
export function shouldDownloadWorkbooks(input: {
  snapshot: ConflictsPayload | null;
  upstreamCutoff: string;
  force: boolean;
}): boolean {
  if (input.force || !input.snapshot) return true;
  return input.snapshot.commonThrough !== input.upstreamCutoff;
}

// `undefined` gives the default location under the build-cache mount Railway provides
// (`--mount=type=cache,...,target=/app/node_modules/.cache`, seen in the build logs). Deliberately
// not `.next/cache`: that mount belongs to Next, which prunes it, and a Next upgrade can invalidate
// it — our persistence should not be a hostage to someone else's cache policy.
//
// Namespacing by schema version means a bump invalidates every entry for free rather than relying on
// `isCompleteSnapshot` to reject them one at a time. An empty string disables the layer.
export function resolveCachePath(root: string, override: string | undefined): string | null {
  if (override !== undefined && override.trim() === "") return null;
  const directory =
    override === undefined
      ? path.join(root, CACHE_SUBDIRECTORY, `v${ACLED_SCHEMA_VERSION}`)
      : override;
  return path.join(directory, "conflicts.json");
}

// Missing and corrupt are deliberately indistinguishable: both mean "no usable snapshot here", and
// every caller does the same thing with that answer.
//
// `pruneOnCorrupt` is for the cache only, so a poisoned entry does not re-cost a parse on every
// later build. Never pass it for data/conflicts.json — the cache is ours and disposable, the
// committed file is a tracked artifact we do not delete.
export function readSnapshotFile(
  file: string,
  options: { pruneOnCorrupt?: boolean } = {},
): ConflictsPayload | null {
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
  try {
    const value: unknown = JSON.parse(text);
    if (isCompleteSnapshot(value)) return value;
  } catch {
    // Fall through to the prune below.
  }
  if (options.pruneOnCorrupt) {
    try {
      fs.rmSync(file, { force: true });
    } catch {
      // A cache we cannot tidy is still a cache we can ignore.
    }
  }
  return null;
}

export function writeSnapshotFile(file: string, payload: ConflictsPayload): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Written via a temp file in the same directory so an interrupted build cannot leave a
  // half-written snapshot where the next one would read it as truth. The temp is removed on failure
  // rather than left behind to accumulate.
  const temporary = `${file}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(payload)}\n`, "utf8");
    fs.renameSync(temporary, file);
  } catch (error) {
    try {
      fs.rmSync(temporary, { force: true });
    } catch {
      // The original error is the one worth reporting.
    }
    throw error;
  }
}

// For the cache, where a write failure is not worth a build. An accelerator that can fail a build is
// not an accelerator.
export function tryWriteSnapshotFile(file: string, payload: ConflictsPayload): boolean {
  try {
    writeSnapshotFile(file, payload);
    return true;
  } catch (error) {
    console.warn(
      `conflicts: could not write the build cache at ${file} — ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
}
