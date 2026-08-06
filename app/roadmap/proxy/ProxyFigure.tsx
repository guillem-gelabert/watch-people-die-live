"use client";

import type { ReactNode } from "react";
import { useDict } from "../I18nContext";
import { fill } from "@/lib/i18n/fill";
import { useProxyRank } from "./ProxyGuessContext";

interface ProxyFigureProps {
  proxyIndex: number;
  title: string;
  children: ReactNode;
}

// One of the five proxy charts, with its own heading. The heading lives here rather than in the
// markdown so it can carry the reader's own ranking for this proxy — the payoff for having guessed
// before seeing the data. Nothing appears if they skipped.
export default function ProxyFigure({ proxyIndex, title, children }: ProxyFigureProps) {
  const d = useDict();
  const rank = useProxyRank(proxyIndex);
  return (
    <section className="proxy-figure">
      <h3 className="roadmap-subheading">
        {title}
        {rank != null ? (
          <span className="proxy-rank-note">
            {fill(d.proxy.rankNote, { n: rank })}
            <span className="sr-only">{d.proxy.rankNoteSr}</span>
          </span>
        ) : null}
      </h3>
      {children}
    </section>
  );
}
