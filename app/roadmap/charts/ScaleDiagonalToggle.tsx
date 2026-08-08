"use client";

import { useDict } from "../I18nContext";

interface ScaleDiagonalToggleProps {
  id: string;
  logOn: boolean;
  onToggle: (logOn: boolean) => void;
}

// The log/linear switch, sitting on the map it controls rather than above it: one square split
// along its anti-diagonal, "Logarithmic" curving up the top-left half and "Linear" running
// straight across the bottom-right. The two words are drawn the way the two scales behave, so the
// control explains the choice it is offering.
export default function ScaleDiagonalToggle({ id, logOn, onToggle }: ScaleDiagonalToggleProps) {
  const t = useDict().charts.densityMap;
  const active = "var(--hi)";
  // The inactive half is the same hue almost all the way to paper: present enough to read as the
  // other option, quiet enough that the active half is unambiguous.
  const inactive = "color-mix(in srgb, var(--hi) 14%, var(--paper))";

  return (
    <button
      type="button"
      className="scale-diagonal"
      aria-pressed={logOn}
      onClick={() => onToggle(!logOn)}
    >
      <span className="sr-only">{t.scaleSpoken}</span>
      <span
        className="scale-diagonal-half is-log"
        style={{ background: logOn ? active : inactive }}
        aria-hidden="true"
      />
      <span
        className="scale-diagonal-half is-linear"
        style={{ background: logOn ? inactive : active }}
        aria-hidden="true"
      />
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <defs>
          <path id={`${id}-log-path`} d="M6,80 C16,34 36,16 84,8" fill="none" />
          <path id={`${id}-linear-path`} d="M36,96 L96,36" fill="none" />
        </defs>
        <text className="scale-diagonal-label" style={{ fill: logOn ? "var(--paper)" : active }}>
          <textPath href={`#${id}-log-path`} startOffset="50%" textAnchor="middle">
            {t.scaleLog}
          </textPath>
        </text>
        <text
          className="scale-diagonal-label is-linear"
          style={{ fill: logOn ? active : "var(--paper)" }}
        >
          <textPath href={`#${id}-linear-path`} startOffset="50%" textAnchor="middle">
            {t.scaleLinear}
          </textPath>
        </text>
      </svg>
    </button>
  );
}
