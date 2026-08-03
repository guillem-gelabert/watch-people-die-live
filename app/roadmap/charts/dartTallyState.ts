// The dart map and the tally beside it are two figures with prose between them, so they cannot
// be one component — but they have to be one experiment: every dart the map throws is a dart the
// tally counts, including the ones that land outside the visible crop. A module-level store keeps
// them in step, the same way stageState.ts couples the globe to its hero.
import { useSyncExternalStore } from "react";
import type { Bucket } from "./dartField";

export interface DartTally {
  ocean: number;
  uninhabited: number;
  inhabited: number;
  // The share each bucket converges to, once the masks exist to compute it.
  limits: { ocean: number; uninhabited: number; inhabited: number } | null;
}

// The tally starts over every 500 darts. Left running it would converge and stop moving, and a
// counter that never changes stops reading as a live experiment.
const RESET_AT = 500;

const EMPTY: DartTally = { ocean: 0, uninhabited: 0, inhabited: 0, limits: null };

let state: DartTally = EMPTY;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function bumpDart(bucket: Bucket) {
  const total = state.ocean + state.uninhabited + state.inhabited;
  const base =
    total >= RESET_AT ? { ocean: 0, uninhabited: 0, inhabited: 0, limits: state.limits } : state;
  state = { ...base, [bucket]: base[bucket] + 1 };
  emit();
}

export function setDartLimits(limits: NonNullable<DartTally["limits"]>) {
  state = { ...state, limits };
  emit();
}

export function resetDartTally() {
  state = { ...EMPTY, limits: state.limits };
  emit();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function getSnapshot() {
  return state;
}

function getServerSnapshot() {
  return EMPTY;
}

export function useDartTally(): DartTally {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
