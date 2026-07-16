"use client";

import { useEffect, useState } from "react";

const LAMBDA_PER_SECOND = 2;

function nextGap() {
  return (-Math.log(1 - Math.random()) / LAMBDA_PER_SECOND) * 1000;
}

export default function PoissonPulse() {
  const [pulseVersions, setPulseVersions] = useState([0, 0, 0, 0]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let nextDot = 0;

    const schedule = () => {
      timeout = setTimeout(() => {
        if (cancelled) return;
        const dot = nextDot;
        setPulseVersions((versions) =>
          versions.map((version, index) => (index === dot ? version + 1 : version)),
        );
        nextDot = (nextDot + 1) % 4;
        schedule();
      }, nextGap());
    };

    schedule();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  return (
    <section
      className="chart-panel wide"
      aria-label="Four dots lighting in sequence with Poisson-distributed timing"
    >
      <div className="pulse-example">
        <div className="pulse-line" aria-hidden="true">
          {pulseVersions.map((version, index) => (
            <span
              className={version ? "pulse-dot once" : "pulse-dot"}
              key={`${index}-${version}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
