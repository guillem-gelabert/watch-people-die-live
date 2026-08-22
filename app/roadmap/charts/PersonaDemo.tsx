"use client";

import { useMemo } from "react";
import { usePersonaTables, type CauseTable, type MortalityTable } from "./usePersonaTables";
import { useDict } from "../I18nContext";
import { fill } from "@/lib/i18n/fill";
import { causeLabel, type CauseLabels } from "@/lib/i18n/causes";

// The country the example is drawn for. Spain reports its own age/sex table and skews old
// enough that the modal draw is a recognisable sentence rather than a statistical shrug.
const SPAIN_M49 = "724";
const SPAIN = "Spain";

interface Likeliest {
  sex: "m" | "f";
  age: string;
  cause: string;
}

// The single most likely draw: the heaviest (sex, age band) cell, then the heaviest cause
// inside it. Not a sample — the mode of the same distribution the globe samples from.
function likeliest(
  mortality: MortalityTable,
  causes: CauseTable,
  undetermined: string,
  labels: CauseLabels,
): Likeliest | null {
  const entry = mortality.countries[SPAIN_M49] ?? mortality.global;
  if (!entry) return null;

  let best = { sex: "f" as "m" | "f", band: -1, weight: -1 };
  for (const sex of ["m", "f"] as const) {
    entry[sex].forEach((weight, band) => {
      if (weight > best.weight) best = { sex, band, weight };
    });
  }
  if (best.band < 0) return null;

  const cell = (causes.countries[SPAIN_M49] ?? causes.global)?.[best.sex]?.[best.band];
  let cause = undetermined;
  if (cell) {
    let top = -1;
    for (const [index, weight] of Object.entries(cell)) {
      // "Other causes" is a bucket, not a cause — naming it would say nothing. The test is on
      // the English label, never on the translated one: the bucket keeps its English key in
      // every language, which is the whole reason the key is the identity.
      const label = causes.causes[Number(index)];
      if (!label || label === "other causes") continue;
      if (weight > top) {
        top = weight;
        cause = causeLabel(labels, label);
      }
    }
  }

  const band = mortality.bands[best.band];
  const isLast = best.band === mortality.bands.length - 1;
  const age = band ? (isLast ? `${band[0]}+` : `${band[0]}–${band[1]}`) : "?";
  return { sex: best.sex, age, cause };
}

// How a persona is built, and what the most likely one looks like. The order is the whole
// point: a cause is only ever drawn from the age and sex that plausibly dies of it.
export default function PersonaDemo() {
  const { mortality, causes } = usePersonaTables();
  const d = useDict();
  const t = d.charts.personaDemo;
  const draw = useMemo(
    () => (mortality && causes ? likeliest(mortality, causes, t.undetermined, d.causes) : null),
    [mortality, causes, t.undetermined, d.causes],
  );

  return (
    <div className="persona-demo">
      <div className="persona-chain">
        {t.steps.map((step, i) => (
          <span className="persona-step" key={step}>
            <span className="persona-step-name" data-last={i === t.steps.length - 1 ? "1" : "0"}>
              {step}
            </span>
            {i < t.steps.length - 1 && (
              <span className="persona-arrow" aria-hidden="true">
                →
              </span>
            )}
          </span>
        ))}
      </div>
      {draw ? (
        <>
          <p className="persona-draw">
            {draw.sex === "f" ? t.woman : t.man} {draw.age} · {draw.cause} · {SPAIN}
          </p>
          <p className="persona-note">
            {fill(t.note, {
              country: SPAIN,
              group: draw.sex === "f" ? t.womenOf : t.menOf,
              age: draw.age,
            })}
          </p>
        </>
      ) : (
        <p className="persona-note">{t.loading}</p>
      )}
    </div>
  );
}
