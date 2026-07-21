import ConflictEwmaWidget from "../charts/ConflictEwmaWidget";
import RoadmapMarkdown from "../roadmapMarkdown";
import type { ConflictsPayload } from "../types";

interface Step6ConflictsProps {
  conflicts: ConflictsPayload | null;
  copy: string;
}

export default function Step6Conflicts({ conflicts, copy }: Step6ConflictsProps) {
  return (
    <section className="step step-06 done">
      <header className="step-header">
        <span className="step-sphere" aria-hidden="true" />
        <div>
          <p className="step-eyebrow">Step 06 · Implemented</p>
          <h2>Ongoing Conflicts</h2>
        </div>
      </header>
      <div className="step-body">
        <RoadmapMarkdown
          source={copy}
          slots={{
            "[widget to update half life, curve smoothness, and see prediction]": (
              <div
                className="chart-grid"
                aria-label="Robust exponentially-weighted moving average of conflict fatalities"
              >
                <section className="chart-panel wide">
                  <h4 className="chart-title">Robust EWMA — today&apos;s conflict deaths</h4>
                  <ConflictEwmaWidget dailyStack={conflicts?.dailyStack} />
                </section>
              </div>
            ),
          }}
        />
      </div>
    </section>
  );
}
