import { AGE_BAND_RANGES, explainPersona, type Outcome } from "./persona";
import { explainCellIndex, type Death } from "./stageState";
import type { CellMath } from "./useGlobeData";

// Joins the two halves of a death's derivation — the cell that was drawn, and the person drawn
// inside it — into one view-model for the island's unfolded card.
//
// Both halves are computed on demand. The sim fires roughly twice a second and the card is open
// for a couple of seconds at a time, so doing this work per death would be almost entirely wasted;
// the death carries the inputs instead (m49, cellIndex, eventDate) and this runs when a reader
// actually opens the card.

// How many causes the card lists before collapsing the rest into a remainder. Enough to show that
// the drawn cause competed against real alternatives, few enough to stay readable on a phone.
const TOP_CAUSES = 5;

export interface Derivation {
  cell: CellMath | null;
  sex: { m: number; f: number } | null;
  tier: number | null;
  // The nine bands with their probabilities and printable ranges, drawn band flagged.
  ages: { label: string; p: number; drawn: boolean }[] | null;
  // The top few causes for this country/sex/band, with the drawn one guaranteed present even when
  // it did not place — a card that omitted the outcome it just showed would be describing a
  // different draw.
  causes: { label: string; p: number; drawn: boolean }[] | null;
  causeRanked: number | null;
  causeCount: number;
}

function bandLabel([min, max]: readonly [number, number]): string {
  if (min === max) return `${min}`;
  // The oldest band runs to 200 in the data files but ages are drawn capped at 99, so an open
  // "85+" is both shorter and truer than printing either bound.
  return max >= 99 ? `${min}+` : `${min}–${max}`;
}

export function explainDeath(death: Death): Derivation {
  const cell = explainCellIndex(death.cellIndex);
  const persona = explainPersona(
    death.m49,
    death.cellIndex,
    death.sex,
    death.bandIdx,
    death.eventDate,
  );

  if (!persona) {
    return {
      cell,
      sex: null,
      tier: null,
      ages: null,
      causes: null,
      causeRanked: null,
      causeCount: 0,
    };
  }

  const ages = persona.ages.map((p, i) => ({
    label: bandLabel(AGE_BAND_RANGES[i] as readonly [number, number]),
    p,
    drawn: i === persona.bandIdx,
  }));

  const rank = persona.causes.findIndex((c: Outcome) => c.label === death.cause);
  const top = persona.causes.slice(0, TOP_CAUSES);
  // The drawn cause can sit outside the top few — most causes in a band are rare, and that is
  // part of what the card is showing. Append it rather than dropping it.
  if (rank >= TOP_CAUSES) top.push(persona.causes[rank] as Outcome);

  return {
    cell,
    sex: persona.sex,
    tier: persona.tier,
    ages,
    causes: top.map((c) => ({ label: c.label, p: c.p, drawn: c.label === death.cause })),
    causeRanked: rank >= 0 ? rank + 1 : null,
    causeCount: persona.causes.length,
  };
}
