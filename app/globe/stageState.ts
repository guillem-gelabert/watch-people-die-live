import type { Persona } from "./persona";
import type { CellMath } from "./useGlobeData";

// The simulation fires roughly twice a second. Routing that through React state on any
// component that owns the canvas or the story would re-render those subtrees at the same
// rate; the previous scrolling feed paid for this with a memo around the entire roadmap.
// Instead the latest death lives here and only the island subscribes, so a death re-renders
// one small pill and nothing else.

export interface Death extends Persona {
  lon: number;
  lat: number;
  at: number;
  // The inputs the draw ran on, kept so the island can reconstruct the arithmetic on demand
  // rather than every death paying for an explanation nobody has asked to see.
  m49: number;
  cellIndex: number;
  eventDate: Date;
}

let latest: Death | null = null;
const listeners = new Set<() => void>();

// The live sampler's explainCell, handed over by Earth each time it rebuilds one (init, and on
// every UTC day change). Lives here rather than in a prop because the island is the only reader
// and routing it through the canvas's props would re-render the scene to deliver it.
let explainCell: ((cellIndex: number) => CellMath | null) | null = null;

export function registerExplainer(fn: (cellIndex: number) => CellMath | null): void {
  explainCell = fn;
}

export function explainCellIndex(cellIndex: number): CellMath | null {
  return explainCell?.(cellIndex) ?? null;
}

export function publishDeath(death: Death): void {
  latest = death;
  for (const l of listeners) l();
}

export function subscribeToDeaths(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLatestDeath(): Death | null {
  return latest;
}

// useSyncExternalStore calls this during SSR, where no death has fired yet.
export function getServerDeath(): Death | null {
  return null;
}

// Whether the hero still owns the screen. The scroll handler updates the underlying phase
// every frame, but subscribers here are only notified when the boolean flips, so scrolling
// past the hero costs exactly one render rather than one per frame.
//
// This is the threshold half of the hero's exit — what latches (an open card closes and stays
// closed). The island's opacity is the continuous half, and the scroll handler writes that
// straight to the element rather than through here.
let heroActive = true;
const heroListeners = new Set<() => void>();

export function setHeroActive(next: boolean): void {
  if (next === heroActive) return;
  heroActive = next;
  for (const l of heroListeners) l();
}

export function subscribeToHero(listener: () => void): () => void {
  heroListeners.add(listener);
  return () => {
    heroListeners.delete(listener);
  };
}

export function getHeroActive(): boolean {
  return heroActive;
}
