"use client";

import { useEffect, useState } from "react";

// The two tables a persona is drawn from, shipped as static JSON and fetched here so the Who
// section's figures describe the same draw the globe makes rather than an illustration of it.

export interface AgeSexEntry {
  m: number[];
  f: number[];
}

export interface MortalityTable {
  // Inclusive [min, max] per age band; the last band's max stands in for "and over".
  bands: [number, number][];
  global: AgeSexEntry;
  countries: Record<string, AgeSexEntry>;
}

// { causeIndex: weight }, one per age band.
type CauseWeights = Record<string, number>;

export interface CauseTable {
  causes: string[];
  global: { m: CauseWeights[]; f: CauseWeights[] };
  countries: Record<string, { m: CauseWeights[]; f: CauseWeights[] }>;
}

export interface PersonaTables {
  mortality: MortalityTable | null;
  causes: CauseTable | null;
}

async function loadJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function usePersonaTables(): PersonaTables {
  const [tables, setTables] = useState<PersonaTables>({ mortality: null, causes: null });

  useEffect(() => {
    let live = true;
    void Promise.all([
      loadJson<MortalityTable>("/data/mortality-age-sex.json"),
      loadJson<CauseTable>("/data/causes.json"),
    ]).then(([mortality, causes]) => {
      if (live) setTables({ mortality, causes });
    });
    return () => {
      live = false;
    };
  }, []);

  return tables;
}

// "85+" for the open-ended last band, "1–4" for the rest.
export function bandLabel(band: [number, number], isLast: boolean): string {
  if (isLast) return `${band[0]}+`;
  if (band[0] === band[1]) return band[0] === 0 ? "<1" : String(band[0]);
  return `${band[0]}–${band[1]}`;
}
