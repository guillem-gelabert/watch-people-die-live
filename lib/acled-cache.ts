import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ConflictsPayload } from "./acled-weekly";

export const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;

export async function readSnapshotFile(
  filename: string,
  validate: (value: unknown) => value is ConflictsPayload,
): Promise<ConflictsPayload | null> {
  try {
    const value: unknown = JSON.parse(await readFile(filename, "utf8"));
    return validate(value) ? value : null;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      console.warn("ACLED weekly snapshot could not be read; treating it as missing.");
    }
    return null;
  }
}

export async function writeSnapshotAtomic(
  filename: string,
  payload: ConflictsPayload,
): Promise<void> {
  await mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.tmp-${process.pid}-${Date.now()}`;
  try {
    await writeFile(temporary, JSON.stringify(payload), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, filename);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

function ageHours(payload: ConflictsPayload, now: () => number): number | null {
  const generated = Date.parse(payload.generatedAt);
  if (!Number.isFinite(generated)) return null;
  return Math.max(0, now() - generated) / (60 * 60 * 1000);
}

function withFreshness(
  payload: ConflictsPayload,
  status: "fresh" | "stale",
  now: () => number,
): ConflictsPayload {
  return {
    ...payload,
    freshness: {
      status,
      ageHours: ageHours(payload, now),
      refreshedAt: payload.generatedAt,
    },
  };
}

export interface SnapshotManagerOptions {
  cacheFile: string | null;
  build: () => Promise<ConflictsPayload>;
  validate: (value: unknown) => value is ConflictsPayload;
  empty: (note: string) => ConflictsPayload;
  now?: () => number;
  ttlMs?: number;
}

export interface SnapshotResult {
  payload: ConflictsPayload;
  needsRefresh: boolean;
}

export class SnapshotManager {
  private loaded = false;
  private current: ConflictsPayload | null = null;
  private refreshPromise: Promise<ConflictsPayload> | null = null;
  private readonly now: () => number;
  private readonly ttlMs: number;

  constructor(private readonly options: SnapshotManagerOptions) {
    this.now = options.now ?? Date.now;
    this.ttlMs = options.ttlMs ?? SNAPSHOT_TTL_MS;
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    if (!this.options.cacheFile) return;
    this.current = await readSnapshotFile(this.options.cacheFile, this.options.validate);
  }

  private fresh(payload: ConflictsPayload): boolean {
    const generated = Date.parse(payload.generatedAt);
    return Number.isFinite(generated) && this.now() - generated < this.ttlMs;
  }

  async get(): Promise<SnapshotResult> {
    await this.load();
    if (this.current) {
      const fresh = this.fresh(this.current);
      return {
        payload: withFreshness(this.current, fresh ? "fresh" : "stale", this.now),
        needsRefresh: !fresh,
      };
    }

    try {
      return {
        payload: withFreshness(await this.refresh(), "fresh", this.now),
        needsRefresh: false,
      };
    } catch {
      return { payload: this.options.empty("ACLED weekly refresh failed"), needsRefresh: false };
    }
  }

  refresh(): Promise<ConflictsPayload> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      const next = await this.options.build();
      if (!this.options.validate(next))
        throw new Error("ACLED refresh produced an incomplete snapshot");
      if (this.options.cacheFile) await writeSnapshotAtomic(this.options.cacheFile, next);
      this.current = next;
      this.loaded = true;
      return next;
    })().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }
}
