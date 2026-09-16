---
created: 2026-09-15T21:30:00.000Z
title: Urban cores win no grid cell, so their deaths are drawn with a neighbour's pyramid
area: data
prio: medium
files:
  - scripts/build-region-keys.ts
  - data/region-keys.json
  - data/subnational-age-sex.json
---

## Problem

`build-region-keys.ts` assigns each 0.5° cell to one region by area majority on a 5×5 sub-cell
lattice. A region smaller than a cell can therefore win nothing, and the ones that lose are
systematically the densest places on earth.

**This is not new.** `04-03-SUMMARY.md:74` and `04-UAT.md:111` both name Delhi, Jakarta, Ōsaka and
Mexico City as regions that win no cells, and `04-05-SUMMARY.md:60` records the Delhi spot check
concluding "yes — the Delhi enclave is east of the cell". It was understood and accepted as a
property of the vote. What has never been done is **cost it**, and the answer is larger than the
prose implies.

Measured 2026-09-15 by summing `rate-grid.json` cell weights through `region-keys.json` and joining
to `subnational-age-sex.json`. **Count at the GBD location level, not the region-key level**: the
474 region keys resolve to only **444 distinct GBD locations**, because GBD models the UK at
NUTS-1 while the project keys NUTS-2 — five `Greater London` keys share location 4624, five
`Scotland` keys share 434, and so on for 12 locations in all. A unit is only undrawable if *every*
key sharing its location wins no cell.

**17 of the 444 GBD locations receive zero grid weight.** Against the death counts in the source
export (measure=Deaths, metric=Number):

| country | locations | undrawable | GBD deaths | in undrawable units | share | units |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| JPN | 47 | 2 | 1,617k | 195k | **12.0%** | Ōsaka 109k, Saitama 86k |
| PHL | 80 | 5 | 658k | 123k | **18.7%** | National Capital Region 81k, Cebu 27k, Tarlac 10k, + 2 |
| IND | 30 | 1 | 9,822k | 95k | 1.0% | Delhi 95k |
| MEX | 32 | 1 | 797k | 65k | 8.2% | Mexico City 65k |
| IDN | 33 | 1 | 1,872k | 61k | 3.3% | Jakarta 61k |
| GBR | 12 | 1 | 668k | 53k | 7.9% | Greater London 53k |
| PAK | 7 | 2 | 1,373k | 38k | 2.8% | Azad Jammu & Kashmir 27k, Islamabad 11k |
| ETH | 11 | 3 | 736k | 35k | 4.7% | Addis Ababa 29k, Dire Dawa 4k, Harari 2k |
| USA | 51 | 1 | 3,092k | 5k | 0.2% | District of Columbia 5k |

BRA, IRN, ITA, NGA, POL and ZAF lose nothing — their units are all larger than a cell.

**2.59% of the matched set's GBD deaths sit in units the grid never draws.**

The deaths are not lost; they are misattributed. Those cells go to the surrounding region, so an
urban core's deaths are drawn with a suburban or rural pyramid. That is a **directional** error,
not noise: cities skew younger and their mortality profile differs from the hinterland that
absorbs them. Japan is the worst case at 12% of a country whose age structure the story leans on.

It also has a new consequence that did not exist when the vote was accepted. The subnational cause
export (`2026-09-10-gbd-subnational-causes.md`) would buy cause data per region. **Buying Delhi,
Jakarta, Mexico City or Greater London changes nothing today** — no cell resolves to them, so no
draw would ever read the row. Any download schedule built on region death weights scores those
units at zero and correctly declines to buy them, which is the right answer to the wrong question.

## Solution

TBD, and the first question is whether the vote is the thing to change.

- **Allow a cell more than one region, weighted.** The honest fix: a cell's deaths split across the
  regions it overlaps by area share, rather than winner-take-all. Costs the `keyIdx|-1` per-cell
  contract, which `region-keys.json` deliberately keeps to one integer per cell.
- **Let a region that wins nothing claim its best cell anyway.** Much cheaper — a second pass where
  any region with zero cells takes the cell it holds the largest share of, breaking the tie against
  whichever region currently holds it. Distorts the neighbour slightly; fixes the bias for 24 units.
- **Finer cells.** Out of scope: the 0.5° grid is load-bearing for the ACLED join
  (`useGlobeData.ts` keys on `"lon,lat"`) and `climate_fallback.py` unpacks exactly four values.
- **Accept and state it.** The status quo, but written down where a reader can see it rather than
  in a phase summary. Belongs with `2026-09-10-mixed-vintages-unstated.md`.

Prefer measuring the second option before choosing. It is a contained change to one script with an
existing output contract, and its cost is one number: how much the donor regions move.

**Do not schedule any subnational cause download against region death weights until this is
settled** — the weights say these 24 units are worthless, and that is an artefact of the vote.

## A second thing the same measurement turned up

The 474 region keys carry only **444 distinct GBD locations**, so 30 keys are duplicates that ship
a byte-identical pyramid. Twelve GBD locations are shared, all but one of them British: GBD models
the UK at NUTS-1 (`Greater London`, `Scotland`, `North West England`) while `region-keys.json` keys
NUTS-2, and Poland's `PL91`/`PL92` both resolve to `Mazowieckie`.

This is not wrong — the grid needs NUTS-2 keys for the CDR layer, and resolving several of them to
one GBD pyramid is the correct fallback. But it matters for anything priced per location:

- A download schedule must count **444**, not 474. Buying five `Greater London` keys buys one row.
- Coverage claims phrased as "474 regions" overstate the distinct geography by 6.3%.
- The London and Scotland pyramids are NUTS-1 estimates presented at NUTS-2 resolution, which the
  derivation card does not distinguish from a genuine NUTS-2 estimate.
