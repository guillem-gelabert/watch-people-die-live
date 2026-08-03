// The Poisson aside lives behind one word in the prose. The pill that opens it and the sheet
// that answers it are written in different places — the pill mid-sentence, the sheet from its
// own markdown fence — so they are joined here rather than by threading a context through the
// markdown renderer. Same shape as stageState: a value, a listener set, a getter.

// Where the pill was when it was tapped, so the sheet can grow out of it and shrink back into
// it. Null when the sheet is closed.
export interface PillRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface RandState {
  // Non-null while the sheet is on screen at all, including both legs of the journey.
  origin: PillRect | null;
  // Whether the sheet is at its opened size. It goes true one frame after `origin` is set, and
  // false while the rect is still known — which is what gives the sheet somewhere to travel in
  // each direction rather than appearing and disappearing at full size.
  open: boolean;
}

const CLOSED: RandState = { origin: null, open: false };
let state: RandState = CLOSED;
const listeners = new Set<() => void>();

function set(next: RandState): void {
  state = next;
  for (const l of listeners) l();
}

export function openRand(from: PillRect): void {
  set({ origin: from, open: false });
  // The sheet has to be painted at the pill's own size before it is told to grow, or the
  // browser has only one rect and there is nothing to interpolate. The first frame is where
  // React commits that paint; the flip goes in the one after it.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (state.origin) set({ origin: state.origin, open: true });
    });
  });
}

export function closeRand(): void {
  if (!state.origin) return;
  set({ origin: state.origin, open: false });
}

// Called once the sheet has finished shrinking back into the pill.
export function clearRand(): void {
  if (!state.open) set(CLOSED);
}

export function subscribeRand(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getRandState(): RandState {
  return state;
}

export function getServerRandState(): RandState {
  return CLOSED;
}
