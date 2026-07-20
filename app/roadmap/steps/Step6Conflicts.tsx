import ConflictEwmaWidget from "../charts/ConflictEwmaWidget";
import RoadmapMarkdown from "../roadmapMarkdown";
import type { ConflictsPayload } from "../types";

interface Step6ConflictsProps {
  conflicts: ConflictsPayload | null;
  copy: string;
}

export default function Step6Conflicts({ conflicts, copy }: Step6ConflictsProps) {
  return (
    <li className="step done">
      <span className="ring" aria-hidden="true" />
      <div className="step-body">
        <h3>
          <span className="num">6</span> Ongoing Conflicts
        </h3>
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
    </li>
  );
}
