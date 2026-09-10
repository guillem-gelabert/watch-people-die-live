---
created: 2026-09-10T12:45:00.000Z
title: The model spans 2015 to 2024 and the story only admits to part of it
area: data
prio: medium
files:
  - docs/ROADMAP.md
  - docs/ROADMAP.ca.md
  - docs/ROADMAP.de.md
  - app/globe/Derivation.tsx
---

## Problem

Every layer of the simulation carries its own vintage, chosen for its own reason, and together
they span nine years:

| Layer | Vintage | Where it comes from |
| --- | --- | --- |
| Population density | **2015** | GPWv4, `data/density-grid.json` |
| Cause of death | **2019** | WHO GHE release 2021, read at 2019 (2026-09-10) |
| Seasonality | measured, **2020–2022 dropped** | `COVID_YEARS` in the pipeline |
| Age × sex | **2023** | UN World Population Prospects |
| Death rate | **2024** | World Bank CDR, `data/rate-grid.json` |
| Conflict | rolling 12-week window | ACLED |

None of this is accidental and none of it is obviously wrong — each layer takes the best year its
source offers for what it is being asked. But the composite is never stated. The who chapter names
two of the six (2023 figures, the 2021 release read at 2019) and stops. A reader is told the
persona's vintages and not the placement's.

**The derivation card shipped the same day made this visible for the first time, and made it
sharper.** It prints `GPWv4 2015` and `World Bank 2024` on adjacent lines of the same
multiplication — a 2015 population times a 2024 rate — with nothing saying they are nine years
apart or why that is defensible.

It is defensible, and that is the point worth writing down rather than leaving to be rediscovered:
`r` is recovered as `SUM w / SUM cellPop` against that same 2015 grid, so the product reproduces
the World Bank's national total exactly. The 2015 population is a *shape*, not a count, and the
2024 rate is scaled to it by construction. The gap is real arithmetic, not an error — but only
someone who has read `build-country-rate.ts` knows that, and the card shows the two numbers to
everyone.

The cause layer is the one with no such reconciliation. 2019 causes are applied to a 2024 death
count with nothing tying them together beyond the assumption that the mix is stable. That
assumption is probably fine and is certainly better than drawing a pandemic as normal, but it is
an assumption the project has now taken deliberately and has not recorded anywhere a reader or a
future maintainer would find it.

## Solution

TBD. Three separable questions, and they do not have to be answered together.

1. **Does the story say it?** A short passage in the who chapter, or near the placement
   explanation, naming the composite and why each year is what it is. Costs prose in three
   languages and the `storyTranslations.test.ts` vintage assertions would want extending to cover
   whichever years the new text names.
2. **Does the card say it?** The source notes are already there (`GPWv4 2015`, `World Bank 2024`);
   what is missing is one line saying the population is a shape the rate is scaled onto. This is
   the cheapest of the three and reaches the reader at the moment they see the two years.
3. **Should the vintages be pulled together instead?** Pinning the CDR to 2019 would make the whole
   model one pre-pandemic year and cost the "live" claim its currency. Almost certainly the wrong
   trade for this project, but it is the alternative and should be rejected explicitly rather than
   by omission.

Prefer 2, then 1. Do not do 3 without a separate decision.
