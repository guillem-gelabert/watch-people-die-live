"use client";

// A small line sample for chart legends, showing both the series color and its dash
// pattern — so the legend communicates the same two-channel (color + line style) encoding
// the chart uses, keeping series distinguishable without relying on color alone.
export default function LineSwatch({ color, dash }: { color: string; dash: string }) {
  return (
    <svg
      width="26"
      height="10"
      viewBox="0 0 26 10"
      aria-hidden="true"
      style={{ verticalAlign: "middle" }}
    >
      <line
        x1="1"
        y1="5"
        x2="25"
        y2="5"
        stroke={color}
        strokeWidth="2.4"
        strokeDasharray={dash || undefined}
        strokeLinecap="round"
      />
    </svg>
  );
}
