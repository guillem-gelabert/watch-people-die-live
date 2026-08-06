"use client";

import { useSkin } from "../SkinContext";
import { useDict } from "../I18nContext";

export interface SeriesChip {
  key: string;
  label: string;
  color: string;
  on: boolean;
}

interface SeriesChipsProps {
  series: SeriesChip[];
  onToggle: (key: string, on: boolean) => void;
}

// The layer switches above a scatter. Each box wears its own series' colour when on, so the legend
// and the control are the same object — there is no separate key to look up. Real checkboxes
// underneath: the boxes are styled labels, not divs pretending to be inputs.
//
// The last visible series cannot be switched off. An empty chart is never what the reader wanted,
// and disabling the control says so before they try.
export default function SeriesChips({ series, onToggle }: SeriesChipsProps) {
  const { skin } = useSkin();
  const d = useDict();
  const lastOn = series.filter((s) => s.on).length <= 1;

  return (
    <div className="series-chips" role="group" aria-label={d.charts.common.layers}>
      {series.map((s) => {
        const locked = s.on && lastOn;
        return (
          <label className="series-chip" key={s.key} data-on={s.on ? "1" : "0"}>
            <input
              type="checkbox"
              className="sr-only"
              checked={s.on}
              disabled={locked}
              onChange={(e) => onToggle(s.key, e.target.checked)}
            />
            <span
              className="series-chip-box"
              aria-hidden="true"
              style={{
                background: s.on ? s.color : "transparent",
                boxShadow: s.on ? "none" : `inset 0 0 0 1.6px ${skin.rule}`,
                color: s.on ? "#fff" : "transparent",
              }}
            >
              ✓
            </span>
            <span style={{ color: s.on ? skin.ink : skin.mute }}>{s.label}</span>
          </label>
        );
      })}
    </div>
  );
}
