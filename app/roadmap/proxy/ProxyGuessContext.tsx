"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface ProxyGuessValue {
  // The reader's ranking, best first, as proxy indices. Null until they submit one — skipping the
  // modal deliberately leaves this empty, so the charts downstream stay unannotated.
  guess: number[] | null;
  submit: (order: number[]) => void;
  // True once the modal has been closed by any route. The auto-open is spent after that; only the
  // card's own button reopens it.
  spent: boolean;
  markSpent: () => void;
}

const ProxyGuessContext = createContext<ProxyGuessValue>({
  guess: null,
  submit: () => {},
  spent: false,
  markSpent: () => {},
});

export function ProxyGuessProvider({ children }: { children: ReactNode }) {
  const [guess, setGuess] = useState<number[] | null>(null);
  const [spent, setSpent] = useState(false);

  const submit = useCallback((order: number[]) => {
    setGuess(order);
    setSpent(true);
  }, []);
  const markSpent = useCallback(() => setSpent(true), []);
  const value = useMemo(
    () => ({ guess, submit, spent, markSpent }),
    [guess, submit, spent, markSpent],
  );

  return <ProxyGuessContext.Provider value={value}>{children}</ProxyGuessContext.Provider>;
}

export function useProxyGuess(): ProxyGuessValue {
  return useContext(ProxyGuessContext);
}

// Where a proxy ended up in the reader's ranking, 1-based, or null if they never submitted one.
export function useProxyRank(proxyIndex: number): number | null {
  const { guess } = useProxyGuess();
  if (!guess) return null;
  const at = guess.indexOf(proxyIndex);
  return at < 0 ? null : at + 1;
}
