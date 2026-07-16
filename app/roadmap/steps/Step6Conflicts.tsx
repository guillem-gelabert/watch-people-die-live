import ConflictMap from "../charts/ConflictMap";
import RoadmapMarkdown from "../roadmapMarkdown";
import type { ConflictsPayload, CountryFeature } from "../types";

interface Step6ConflictsProps {
  features: CountryFeature[] | null;
  conflicts: ConflictsPayload | null;
  copy: string;
}

export default function Step6Conflicts({ features, conflicts, copy }: Step6ConflictsProps) {
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
            "[conflict fatalities map]": (
              <div
                className="chart-grid"
                aria-label="Where recorded conflict fatalities concentrate"
              >
                <ConflictMap features={features} conflicts={conflicts} />
              </div>
            ),
          }}
        />
      </div>
    </li>
  );
}
