# Mobile parity report — implementation vs. design prototype

Audit of `http://localhost:3001` (implementation) against
`http://localhost:3000/Watch People Die Live - Mobile.dc` (design prototype), both at
**393 × 852**, one device pixel per CSS pixel.

Date: 2026-08-03 · Branch: `redesign/mobile-scrollytelling`

> **Status: closed 2026-08-05.** The parity pass below has landed. What changed, and the three
> decisions that shaped it, are in "Resolution" directly under this line. Seven audit findings
> turned out to be artifacts and were deliberately **not** implemented — they are listed under
> "Corrections", and implementing them would move the build away from the design.

---

## Resolution

**Decisions taken before implementing:** the leave-one-out validation tables were kept but
collapsed behind a disclosure; the conflicts-section prose was left as currently written; the
three implementation-only chart legends and the extra region map were kept.

**One CSS specificity bug accounted for eight findings.** `.story .story-section p` sat at
specificity (0,2,1) and outranked every classed component paragraph at (0,1,0), so
`.chart-copy`, `.chart-note-copy`, `.proxy-strip-body`, `.story-chapter-sub` and friends were all
being forced to 15px/1.68 despite already carrying the correct design values. Scoping it to
`p:where(:not([class]))` — `:where()` so the specificity does not change and the closing block's
own rules still win — fixed the caption scale, the note scale, the proxy body and the chapter
subtitle in one edit.

**The same class of bug caused the contrast failure.** `.story-section :is(h3, h4, h5)` and
`:is(p, li)` set `var(--ink)`/`var(--body)` at (0,1,1), outranking `.proxy-strip-title`/`-body` at
(0,1,0). Every proxy strip was painting the section's near-black ink over its own vivid fill —
not just the royal-blue one where it was visible. Both selectors were raised to
`.proxy-strip .proxy-strip-*`.

Closed, by area:

| Area          | Change                                                                                                                                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type scale    | Caption 12px/18.6, note 11.5px/18.4, chapter sub 1.55, proxy body 14.5px/1.6, tables 12.5px/1.5                                                                                                          |
| Headings      | `text-wrap: balance` on `.story-heading` and `.story-chapter`; the 26px subheadings stay greedy, as in the design                                                                                        |
| Closing block | Serif restored by deleting one `font-family`; the `28ch`/`32ch` measure then widens itself to ~290px                                                                                                     |
| Tables        | Horizontal rules only, no card, no header fill — which is also what makes the eight-column table fit 349px instead of scrolling                                                                          |
| Contrast      | White ink restored on all five proxy strips                                                                                                                                                              |
| Uppercase     | `.roadmap-math-title` and the island eyebrow returned to sentence case                                                                                                                                   |
| Missing       | Six concept tiles (new `ConceptTiles`), two Poisson-modal formula captions, LOO tables behind a disclosure                                                                                               |
| Charts        | Beat strip 44 bars/3px/2px radius; density closeups square with a 22px gap; EWMA segmented presets, time-varying curve, thinned axis; AgeMix bold values and a gutter so the widest share is not clipped |
| Island        | System-UI font, sentence-case eyebrow, red status dot, asymmetric Pause/Close buttons                                                                                                                    |

**Accepted deviations** (documented, deliberately not changed):

- The country-compare control stays a combobox with Switzerland preselected. The design uses a
  bare `<select>` with nothing selected; ours is a superset and avoids an empty first render.
- The proxy figures keep heading-after-lead order. The heading is bound to the reader's dynamic
  "Your #N" note, and moving it would push five prose sentences out of `docs/ROADMAP.md`, which
  is where the story is meant to live. Three of the five "leads" are commentary on the _previous_
  figure anyway.
- The ranking modal still omits the Best/Worst rails, per the existing comment: the instruction
  above the list already says which end is which, and the rails cost two rows in the one place
  that cannot spare them. The card's rails already match the design.
- Archivo is not loaded. The design names it for canvas labels but never loads it, so the
  prototype itself renders a generic sans.
- Region count (3+3), R² values, age bands and ACLED figures are data, not design.

**Verified at 393×852 with the scrollbar suppressed:** caption 12px and note 11.5px computed;
both headings report `text-wrap: balance`; closing copy resolves to Libre Baskerville; all four
table wrappers have `scrollWidth === clientWidth`; both density closeups 349×349 with a 22px gap;
44 beat bars at 3px/2px; three EWMA presets, no sliders, one polyline; tiles collapse to exactly
0px and the open one spans both columns with `aria-expanded` and `inert` correct; no page-level
horizontal overflow. The story is ~2,700px shorter than before the disclosure change.

---

## Requested follow-ups (after the parity pass)

Three design changes to make now that the parity work below has landed. All three are new intent
rather than audit findings — they change the design, they do not close a gap against it.

1. **Thicker graticule lines.** The map graticules currently stroke at `1.1px`
   (`SubnationalChoroplethMap.tsx`, `DensityMap.tsx`, `BorderRasterCloseup.tsx`,
   `GlobalRandomMap.tsx`) and read too fine. Pick one weight and apply it across all four so the
   maps stay a set.
2. **Globe button: label left of the icon, and make the icon live.** The floating "Globe" control
   currently reads icon-then-text; the text should sit to the _left_ of the globe. And the icon
   should show the **current state of the main three.js globe** — the same rotation and lit face
   the reader just left — rather than a static stand-in, so the button previews what tapping it
   returns to.
3. **Fix the raster cell drawing — no seams, and follow the projection's curvature.** Worst on
   the Japan map. `SubnationalChoroplethMap.tsx` walks a 0.5° lattice and draws each cell as an
   axis-aligned `rect` snapped to whole pixels (around `:167-224`). Two artifacts follow: hairline
   gaps where adjacent snapped rects fail to meet, and cells that stay square while the
   azimuthal-equidistant projection curves underneath them, so the grid visibly disagrees with
   the coastline. The fix is to project each cell as a quad (its four corners through
   `projection()`) and fill the path, rather than positioning a rectangle — `BorderRasterCloseup`
   has the same shape of problem but hides it better behind its dark plate.

---

## Summary

**63 differences** across 10 sections. Both pages carry the same ten chapters in the same
order, and the type system, palette engine and most component geometry already match. The
gap is concentrated in three places: **six missing cards**, **a rewritten war section**, and
**figure-level data and colour**, plus **~3,600px of analysis tables the design does not
have**.

| Severity | Count | What it means                                                           |
| -------- | ----- | ----------------------------------------------------------------------- |
| Blocker  | 5     | Content in one side and not the other; changes what the reader gets     |
| Major    | 22    | Wrong data, wrong chart form, wrong colour treatment, or illegible text |
| Minor    | 27    | Type scale, spacing, geometry, label wording                            |
| Nit      | 9     | Semantic-only or sub-pixel                                              |

The five blockers:

1. Three concept cards missing from the "Who" section.
2. Three concept cards missing from the war section.
3. The war section's prose is entirely different copy.
4. A "How the proxies actually score" block with four nested tables (~2,700px) exists only
   in the implementation.
5. A "Predictions vs. Measured Curve (region)" panel exists only in the implementation.

**Cumulative length:** design 23,072px, implementation 26,869px — the implementation is
**~3,800px (16%) longer**, almost entirely from items 4 and 5.

---

## Method, and what is _not_ comparable

- The prototype renders inside a fixed 393 × 852 `#phone` element with its own scroll
  container; all of its figures are **pre-rendered `<canvas>` rasters**, so their axis
  labels, annotations and colours exist only as pixels. The implementation draws the same
  figures as **SVG** (plus the DensityMap canvas, which is canvas by design).
- Prose, typography, geometry and colour tokens were diffed from the DOM. Figure internals
  were compared from 20 paired screenshots (`design | implementation`), which is the only
  way to read the prototype's canvases.
- Chrome's scrollbar initially stole 15px from the implementation's content box (378 instead
  of 393) and faked dozens of "extra line" differences. It was suppressed for all
  measurements. **Any width or line-count comparison made without doing this is wrong.**
- **The palette is scroll-driven in both pages.** Colour tokens sampled at scroll 0 do not
  reflect what is on screen in a given section. All colour findings below come from
  screenshots taken with the section in view.
- The prototype animates on scroll (headings fade in, tallies count up). A single frame can
  catch an element mid-animation; anything that looked like a difference was re-checked at a
  settled scroll position.

**Not comparable (design canvas is blank or in a default empty state):**

- _A cluster of similar curves_ — the design has no country selected, so the chart is empty.
- _Amplitude by country and region_ — the design's canvas is unrendered (blank dark panel).
- The design's "Concept" info sheet vs. the implementation's `proxy-strip-info` sheet —
  neither was opened.

**Excluded as environment, not design:** the circular "N" badge at bottom-left of the
implementation is the **Next.js dev-tools indicator** (`nextjs-portal`), not app UI. It does
overlap body copy in several frames, but it will not ship.

---

## 1. Systemic findings

These are single fixes that each correct many places at once. Worth doing first.

| #   | Finding                                                                                                                                                                                                                                          | Design                                                                               | Implementation          | Sev   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ----------------------- | ----- |
| S1  | **`text-wrap: balance` is missing on headings.** This alone changes the line break of every multi-line heading in the story.                                                                                                                     | `text-wrap: balance`                                                                 | `text-wrap: wrap`       | Major |
| S2  | **Figure caption type scale is inflated.** Affects every chart caption and note in the story.                                                                                                                                                    | `.chart-copy` 12px/18.6 · `.chart-note-copy` 11.5px/18.4                             | both 15px/25.2          | Major |
| S3  | **The figure "card" treatment is missing.** The design wraps four figures in a rounded card with a salmon/pink 1px border; the implementation has no card at all.                                                                                | rounded card, ~12px radius, pink border                                              | none                    | Major |
| S4  | **Serif replaced by sans in the closing block and accordion.**                                                                                                                                                                                   | Libre Baskerville                                                                    | Public Sans             | Major |
| S5  | **Dark ink on dark cards fails contrast.** Proxy strip 2 and quiz pill 2 (royal blue) get dark ink where the design uses white — the copy is close to illegible.                                                                                 | white on royal blue                                                                  | dark navy on royal blue | Major |
| S6  | Proxy strip body type and ink.                                                                                                                                                                                                                   | 14.5px/23.2, `#fff`                                                                  | 15px/25.2, `#e0e0e2`    | Minor |
| S7  | Table cell type.                                                                                                                                                                                                                                 | 12.5px/18.75                                                                         | 13.6px/`normal`         | Minor |
| S8  | Closing-block copy measure.                                                                                                                                                                                                                      | 290px / 286px                                                                        | 248px / 245px           | Minor |
| S9  | **`text-transform: uppercase` is applied in CSS.** The design gets its caps from Bebas Neue being a caps-only face, so for Bebas elements this is visually identical — but it leaks onto non-Bebas text that the design leaves in sentence case. | "Just now", "1593+ per 100k", "Per-second rate", "Poisson probability mass function" | all uppercased          | Minor |

### S1 in detail

Font sizes match within ~1% everywhere; only the wrap differs.

| Heading                             | Size (design → impl) | Design breaks                      | Implementation breaks              |
| ----------------------------------- | -------------------- | ---------------------------------- | ---------------------------------- |
| A war is not a Poisson process      | 36 → 36px            | `A WAR IS NOT A / POISSON PROCESS` | `A WAR IS NOT A POISSON / PROCESS` |
| Now you know what the flashes mean. | 44 → 44.02px         | `…WHAT / THE FLASHES MEAN.`        | `…WHAT THE / FLASHES MEAN.`        |
| What is still missing               | 72 → 70.74px         | `WHAT IS / STILL MISSING`          | `WHAT IS STILL / MISSING`          |

Chapter sizes that already match: Where 148 → 149.34, When 148 → 149.34, Who 164 → 165.06,
section headings 36 → 36.

### S3 — which figures lose their card

_National guess against regional truth_ · _Sampling order_ · _Deaths by age, and what they
die of_ · _Where the trailing year's fatalities are_.

---

## 2. Missing from the implementation

| #   | Finding                                                                                                                                                                                                                                                                        | Sev     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| M1  | **"Who" concept cards — 3 cards absent.** `Method / One global clock`, `Why it failed / Deaths in the ocean`, `Concept / Poisson process`. Light rounded cards, 171×104, 2-column grid, `+` expander. The implementation goes straight from the age chart to the next chapter. | Blocker |
| M2  | **War concept cards — 3 cards absent.** `Method / Rate relative to the global mean`, `What I learned / Crude really means crude`, `Map / Why a cartogram`. Same treatment.                                                                                                     | Blocker |
| M3  | **War prose is different copy.** Four designed paragraphs are replaced by five older, more tutorial-toned ones. See §4.8.                                                                                                                                                      | Blocker |
| M4  | **EWMA preset buttons replaced.** Design: three segmented buttons `Half-life 1 month` / `Half-life 3 months` (selected) / `Flat 12-month mean`, 111×52, 10px radius. Implementation: two orange range sliders + a checkbox.                                                    | Major   |
| M5  | Ranking quiz is missing the **`BEST PREDICTOR`** and **`WORST`** scale labels (each a small caps label with a rule) that bracket the five pills.                                                                                                                               | Minor   |
| M6  | Explainer modal is missing the caption **"An annual average of roughly 61.6 million deaths."** under the per-second-rate formula.                                                                                                                                              | Minor   |
| M7  | In the explainer modal, "Run it for each _k_…" is a **separate paragraph before** the Euler paragraph in the design; the implementation appends it to the end of that paragraph.                                                                                               | Nit     |

---

## 3. Implementation-only additions

| #   | Finding                                                                                                                                                                                                                                                                                   | Size     | Sev     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| A1  | **"How the proxies actually score"** — heading, intro paragraph, and a `Predictions vs. Measured Curve` panel containing a 6-column summary table plus three `loo-cohorts` tables (by cohort, by absolute latitude, by Köppen–Geiger sub-class, ~17 rows). Nothing like it in the design. | ~2,700px | Blocker |
| A2  | **"Predictions vs. Measured Curve (region)"** panel with a 3-column table.                                                                                                                                                                                                                | ~430px   | Major   |
| A3  | An **extra region/country map figure** (349×261) plus a `regions / countries (outline)` legend after "Bordering regions, not just bordering countries".                                                                                                                                   | ~280px   | Major   |
| A4  | Choropleth legend bar — `377 … 1593+ per 100k`.                                                                                                                                                                                                                                           | 9px      | Minor   |
| A5  | Amplitude legend — `0% … 23% monthly deviation strength`.                                                                                                                                                                                                                                 | 14px     | Minor   |
| A6  | EWMA readout — `Predicted today: 734.8 deaths/day (plain average: 709.1)`.                                                                                                                                                                                                                | 50px     | Minor   |
| A7  | A `Percentile / Cap / Meaning` table. The design conveys this in one sentence instead.                                                                                                                                                                                                    | 172px    | Minor   |
| A8  | Three extra chart notes: "Dot opacity carries income per head…", "13 countries are missing from this chart entirely…", "Rings are measured Admin-1 regions…".                                                                                                                             | —        | Minor   |
| A9  | Trailing-fatalities note gains appended statistics: "72,484 fatal events over 365 days. Showing the 2,590 of 5,173 cells…".                                                                                                                                                               | —        | Minor   |
| A10 | Epidemics accordion copy gains a leading sentence: "Epidemics raise mortality in specific regions and periods by a measurable amount."                                                                                                                                                    | —        | Nit     |
| A11 | Weights table gains a `Note` column with "Yesterday / most recent day".                                                                                                                                                                                                                   | —        | Nit     |

---

## 4. Section by section

### 4.1 Hero

| Element        | Design                                                           | Implementation                                                                              | Sev   |
| -------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----- |
| Globe texture  | Near-black **night side**: city lights only, land barely visible | Bright blue **daylight marble**: oceans, clouds, land                                       | Major |
| Globe framing  | Fills the width, **cropped** — no limb visible at the edges      | Whole sphere with space around it, limb visible                                             | Major |
| Persona pill   | **Dark translucent** capsule, red status dot                     | **Near-white opaque** capsule, grey dot                                                     | Major |
| Persona format | `Woman 92 · chronic kidney disease · United States` (middot)     | `Woman 44, diabetes – Korea, Dem. People's Rep.` (comma + en dash)                          | Minor |
| Persona detail | Country only (single line)                                       | Adds coordinates `· 39.0° north, 125.7° east` → wraps to 2 lines, pushing buttons down 30px | Minor |
| Pill buttons   | `Resume` / `Close`, 100×37 and 98×37                             | `Pause` / `Close`, both 95×34                                                               | Nit   |

Matching: `h1` "Every flash is a death." (Bebas Neue 86px/74, 349×149, identical position),
the `What? ↓` cue, and the `Globe` button.

### 4.2 Opening ("ask the machine")

| Element                                                                                                   | Design                                        | Implementation                                  | Sev   |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------- | ----- |
| **Beat strips** — both present, but styled differently. A recent commit moved these away from the design. | 44 bars · 3px gap · 5px wide · **2px radius** | 32 bars · 5px gap · 6.1px wide · **999px pill** | Minor |
| Beat strip bar colour                                                                                     | `rgb(80,78,105)` / `rgb(119,118,140)`         | `rgb(89,74,104)` / `rgb(127,115,140)`           | Nit   |
| Chat bubble (user)                                                                                        | 288 wide → text fits **1 line**               | 260 wide → text wraps to **2 lines**            | Minor |
| Chat bubble fill                                                                                          | `rgb(47,71,239)`                              | `rgb(43,69,236)`                                | Nit   |

Matching: container 349×38 and `flex-end` alignment on both strips, metronome bars all 22px,
Poisson range 5–38px, the assistant bubble, the `randomly` pill (99×29, 14px radius,
`rgb(80,78,105)`), and all body copy.

### 4.3 Where

| Element                          | Design                                           | Implementation                           | Sev |
| -------------------------------- | ------------------------------------------------ | ---------------------------------------- | --- |
| Dart tally cell                  | 12px radius · `12px 10px 11px` padding · 87 tall | 14px radius · `10px 11px 11px` · 82 tall | Nit |
| "Uninhabited"/"Inhabited" labels | plain `div`                                      | `abbr` (adds a dotted underline)         | Nit |

Matching: chapter word, both 349×349 figures, tally cell grid (111px cells at x22/141/260,
8px gaps), the `actual → expected` arrow format, and all body copy.

### 4.4 A country is not an average

| Element                 | Design                                         | Implementation                                        | Sev   |
| ----------------------- | ---------------------------------------------- | ----------------------------------------------------- | ----- |
| The two density figures | **349 × 349 square** each                      | **349 × 233 landscape** each                          | Major |
| Cell rendering          | Clean stepped colour regions, **no gridlines** | **Per-cell gridlines drawn** — reads like graph paper | Major |
| Gap between the two     | 22px                                           | 43px                                                  | Minor |
| Map extent              | Wider crop; sea occupies ~40% of figure 1      | Tighter crop; sea ~20%                                | Minor |
| DensityMap colour ramp  | Muted, dark teal-green — reads "mostly empty"  | Vivid saturated mint — reads as a solid bright mass   | Major |

Matching: the log/linear toggle badge (position, size, blue/white diagonal), the 349×349
density map, and the `Toggle between log and linear scale…` italic (348×44 in both).

### 4.5 CDR by region

| Element             | Design                                           | Implementation                   | Sev   |
| ------------------- | ------------------------------------------------ | -------------------------------- | ----- |
| Choropleth backdrop | Transparent — sits directly on the peach section | **Dark charcoal panel**          | Major |
| Graticule           | Faint or absent                                  | **Prominent white graticule**    | Major |
| Colour ramp         | Pale pink → cream, very low contrast             | Saturated hot pink / magenta     | Major |
| Legend              | none                                             | adds `377 … 1593+ per 100k` (A4) | Minor |

### 4.6 Borders are the wrong unit

| Element                   | Design                                        | Implementation                                                                                | Sev   |
| ------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------- | ----- |
| Chart card                | Rounded card with pink border (S3)            | none                                                                                          | Major |
| Region count              | **4 per country (8 total)**                   | **3 per country (6 total)** — matches the "six regions" caption, which the design contradicts | Major |
| Spain regions             | Asturias, Galicia, Madrid, Canary Islands     | Asturias, Comunitat Valenc…, Melilla                                                          | Major |
| France regions            | Limousin, Corsica, Île-de-France, Rhône-Alpes | Limousin, Franche-Comté, Mayotte                                                              | Major |
| National values           | Spain **940**, France **960**                 | Spain **890**, France **940**                                                                 | Major |
| Limousin value            | 1310                                          | 1300                                                                                          | Minor |
| Below-national bar colour | Light grey / taupe                            | **Steel blue**                                                                                | Minor |
| Caption                   | 1 line (12px)                                 | 2 lines (15px) — S2                                                                           | Major |
| Note                      | 2 lines (11.5px)                              | 3 lines (15px) — S2                                                                           | Major |
| Region label              | fits                                          | `Comunitat Valenc…` truncated                                                                 | Nit   |

### 4.7 When

| Element                       | Design                                                                  | Implementation                                                                 | Sev   |
| ----------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----- |
| Country-compare default       | **No country selected** — empty chart, placeholder `Compare countries…` | **Switzerland preselected**, curve drawn                                       | Major |
| Control type                  | Native `<select>` + `Clear all`, one row                                | Pill combobox `Add a country or category…` + chips row + `Clear all`, two rows | Major |
| Cluster chart height          | 262px                                                                   | 222px                                                                          | Minor |
| Latitude scatter **R²**       | `countries R² = 0.63 · regions R² = 0.53`                               | `countries R² = 0.10 · regions R² = 0.07`                                      | Major |
| Latitude scatter y-axis       | 0–30%, 10% steps                                                        | 0–25%, 5% steps                                                                | Major |
| Latitude scatter shape        | Tight positive trend peaking ~30% at 45°                                | Diffuse cloud peaking ~20%                                                     | Major |
| Proxy-figure order            | heading → intro → chips → chart                                         | intro → **heading** → chips → chart                                            | Minor |
| Series chip labels            | `Countries` / `Regions`                                                 | `each country` / `each region`                                                 | Minor |
| Proxy strip 2/quiz pill 2 ink | white                                                                   | dark navy — illegible (S5)                                                     | Major |
| Proxy strip heights           | 276/368/322/322/299                                                     | 344/420/445/470/370 (S6 + longer copy)                                         | Minor |
| Proxy body copy               | 3 paragraphs differ in wording                                          | see below                                                                      | Minor |
| Quiz scale labels             | `BEST PREDICTOR` / `WORST`                                              | absent (M5)                                                                    | Minor |

Proxy copy drift (word-level):

- **Climatic zone** — design "…and we risk zones that are too big… leaving no donor
  countries inside them." → impl "…and _to apply to our mortality numbers. Furthermore,_ we
  risk _choosing a classification whose_ zones are too big… leaving _zones with_ no donor
  countries _to take data from._"
- **Latitude** — design "a second degree proxy… Nevertheless, Lisbon and Beijing sit at
  almost the same parallel:" → impl "a second-degree proxy… Nevertheless, _if we take a look
  at_ Lisbon and Beijing _— both around_ the same parallel _— we can see that extremely
  different climates can coexist at a single latitude:_"
- **Neighbouring countries** — one added word: "very close in longitude and _in_ latitude".

Matching: all five proxy strip cards (323 wide, 16px radius, `16px 16px 17px` padding), the
sticky proxy card (`top: 12px`), the ranking quiz pills and their colour ramp, the `i` info
buttons, and the `Skip` / `Submit my ranking` buttons.

### 4.8 Who

| Element                     | Design                                                          | Implementation                                                                                                   | Sev     |
| --------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------- |
| Concept cards               | 3 cards                                                         | **absent** (M1)                                                                                                  | Blocker |
| Sampling-order card         | Rounded card, pink border, **divider rule** under the steps row | No card, no divider                                                                                              | Major   |
| Persona example             | `Woman 78 · breast cancer · Spain`                              | `Woman 85+ · ischaemic heart disease · Spain`                                                                    | Minor   |
| Persona note                | 2 lines, 11.5px                                                 | 4 lines, 15px, different copy                                                                                    | Minor   |
| Deaths-by-age **age bands** | **6**: 0–4, 5–29, 30–49, 50–64, 65–79, 80+                      | **9**: <1, 1–4, 5–14, 15–29, 30–49, 50–64, 65–74, 75–84, 85+                                                     | Major   |
| Deaths-by-age **causes**    | **3, greyscale**: Everything else, Cancers, Respiratory         | **5, categorical colour**: ischaemic heart disease, a stroke, COPD, lower respiratory infection, everything else | Major   |
| Percentages                 | 4/4/7/16/32/37                                                  | 2/6/2/4/9/17/20/22/18                                                                                            | Major   |
| Chart height                | 216px                                                           | 294px                                                                                                            | Minor   |
| Chart card                  | pink-bordered card                                              | none (S3)                                                                                                        | Major   |
| `22%` value label           | fits                                                            | **clipped at the right edge**                                                                                    | Minor   |
| Section palette             | Pale blue                                                       | **Pink**                                                                                                         | Major   |

### 4.9 A war is not a Poisson process

**The prose is a wholesale rewrite.** The design's four editorial paragraphs with **bold**
pull-phrases are replaced by five different paragraphs using _italic_ emphasis.

Design copy absent from the implementation:

1. "Conflict deaths sit outside the crude death rate for the year they happen in — they
   arrive far too late for the World Bank series. So they are added separately, at runtime."
2. "The route pulls **fatal events from ACLED** over the trailing twelve months, aggregates
   their fatalities onto the same half-degree grid… Without credentials the payload comes
   back empty and the layer simply disappears."
3. "The hard part is not the data, it is the shape. **Conflict deaths cluster violently in
   time and space** — a single day can carry a month of fatalities in one town…"
4. "Every other layer multiplies a base rate by a factor. This one arrives as counted deaths
   — yesterday's — so the question is what factor to derive from them…"
5. "The 10th and 90th percentiles give the caps — 20.6 and 52.8 — and the series is clipped
   into them."
6. "Then each day gets a weight. The half-life sets how fast a day's influence halves… This
   one is 4, landed on by trial and error."
7. "The weighted average of the capped series is **28.4** — that is the figure the globe
   fires from today, with the single 90-fatality day damped instead of dominating."

| Element                | Design                                                              | Implementation                                             | Sev     |
| ---------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------- | ------- |
| Concept cards          | 3 cards                                                             | **absent** (M2)                                            | Blocker |
| Emphasis style         | **bold** (`<b>`)                                                    | _italic_ (`<em>`)                                          | Minor   |
| EWMA controls          | 3 preset buttons                                                    | 2 sliders + checkbox + readout (M4, A6)                    | Major   |
| Half-life unit         | **months** ("1 month", "3 months")                                  | **days** ("4 days")                                        | Major   |
| EWMA plot backdrop     | Transparent on peach, light gridlines                               | **Dark charcoal panel**                                    | Major   |
| EWMA bar colour        | Light grey / taupe                                                  | Dark brown / umber                                         | Major   |
| EWMA mean overlay      | **Varying blue curve** labelled "Weighted mean, half-life 3 months" | **Flat black dashed line** labelled "today ≈ 734.8/day"    | Major   |
| EWMA y-axis            | 0–1900, 475 steps                                                   | 0–1200, 200 steps                                          | Minor   |
| EWMA x-axis            | 12 month labels (Aug…Jun)                                           | `Jul, 5, 6, 7, 8, 9, 11, …17` — mixed and apparently wrong | Major   |
| Trailing map card      | pink-bordered card                                                  | none (S3)                                                  | Major   |
| Trailing map labels    | Ukraine, Sudan, Sahel, Somalia, Myanmar, **Haiti**                  | Ukraine, **Palestine**, Sudan, Myanmar                     | Major   |
| Trailing map dots      | Small discrete dots                                                 | Large overlapping translucent blobs                        | Major   |
| Weights table layout   | **Horizontal** (Day as header row 1–7, Weight as one row)           | **Vertical** (Day / Weight / Note columns, 7 rows)         | Minor   |
| Capped table headers   | `Reported` / `Capped`                                               | `Original value` / `Capped value`                          | Minor   |
| Unchanged rows         | `—`                                                                 | `Unchanged`                                                | Minor   |
| 7-day fatalities table | Fits 349px                                                          | **393px in a 347px wrapper → needs horizontal scrolling**  | Minor   |
| Section palette        | Peach / tan at the heading                                          | Pale cream — transitions later                             | Major   |

### 4.10 What is still missing · Now you know

| Element                 | Design                          | Implementation                                            | Sev   |
| ----------------------- | ------------------------------- | --------------------------------------------------------- | ----- |
| Accordion status font   | Libre Baskerville (serif)       | Public Sans (sans) — S4                                   | Major |
| Accordion first rule    | No rule above item 1            | Rule above item 1                                         | Nit   |
| Closing paragraphs font | Libre Baskerville (serif)       | Public Sans (sans) — S4                                   | Major |
| Closing copy measure    | 290 / 286 wide → 6 lines        | 248 / 245 wide → 7 lines                                  | Minor |
| Closing copy ink        | `rgb(224,224,226)`              | `rgba(255,255,255,.62)` / `.5`                            | Minor |
| Heading tags            | `h2` (closing), `h3` (sections) | `h3` (closing), `h2` (sections) — inverted heading levels | Nit   |
| Epidemics copy          | as designed                     | leading sentence added (A10)                              | Nit   |

Matching: the three accordion items and their `+` affordances, the `↑ PULL UP FOR THE GLOBE`
label with its rule, and the dark end-state palette.

---

## 5. Corrections — things that look different but are not

Recording these so they are not "fixed" by mistake.

**Found while implementing** — seven findings in this report are void. Implementing any of them
would move the build _away_ from the design:

| Finding                                                            | Why it is void                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Four figures need a rounded card with a salmon/pink border"       | The outline is the prototype's own `auditPink()` review helper (design file ~line 946), which paints `box-shadow: 0 0 0 2px rgba(255,45,150,.85)` on `[data-new-chart]` to mark charts the designer drafted. The design's figures are bare transparent canvases at `border-radius: 10px`; `roadmap.css` already documents keeping them chrome-less. |
| "Bar colours differ (taupe vs steel blue)"                         | Both sides are `mapColor("#ff3b30")` / `mapColor("#2f4bff")` at `.75`/`.5`. The screenshots differed only because the two pages were in different palette states.                                                                                                                                                                                   |
| "Choropleth should lose its dark panel"; "density ramp too bright" | Both draw a literal `#251f2b` plate and fixed ramps on a deliberately _unskinned_ canvas context — the design does `const raw = ctx.canvas.getContext("2d") // literal colours` for exactly this.                                                                                                                                                   |
| "Hero globe is day where the design is night"                      | Same day/night terminator shader; the two captures were simply taken at different real times.                                                                                                                                                                                                                                                       |
| "Persona pill is white in ours, dark in the design"                | Ours is already `background: #000`. Misread from a screenshot; the real deltas were the type and button treatment.                                                                                                                                                                                                                                  |
| "Chat bubble is too narrow (260 vs 288)"                           | The design's markup is byte-identical — `max-width: 82%`, `padding: 11px 14px`, `border-radius: 16px 16px 5px`, `500 14px/1.5`. The 288 was a mis-settled measurement.                                                                                                                                                                              |
| "Ranking quiz is missing the BEST PREDICTOR / WORST rails"         | Already implemented on the card, correctly gated on fold completion. The audit compared a frame where the design showed the card against one where ours showed the modal.                                                                                                                                                                           |
| "Section palette progression differs"                              | The ten sky colours in `docs/ROADMAP.md` are byte-identical to the design's `data-sky` values.                                                                                                                                                                                                                                                      |

The prototype's own README explains why most of the colour findings dissolved:

> Recreate pixel-accurately, but **generate colour through the palette system rather than
> hardcoding sampled values — the palette IS the design. Screenshots show whatever the palette
> resolved to at capture time.**

| Apparent difference                                                                   | Reality                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Beat strips look implementation-only                                                  | **Present in both.** They contain no text, so a text-based DOM extract misses them entirely. Only their styling differs (§4.2).                                                              |
| Ranking quiz looks missing                                                            | **Present in both.** It mounts on scroll, so it is absent from a static DOM snapshot. It is also an in-flow gate: dismissing it shrinks the design by 787px and the implementation by 278px. |
| "randomly" explainer modal looks missing                                              | **Present in both.** It mounts on click. Content matches except M6 and M7.                                                                                                                   |
| Dart tally shows `0` / `0%` in the design                                             | Animation state, not format. Once in view the design shows `4` / `80% → 71%` — the same `actual → expected` format as the implementation.                                                    |
| "Borders are the wrong unit" heading looks absent in the design                       | Caught mid scroll-reveal. Fully visible at a settled position.                                                                                                                               |
| Design has black text on a dark background ("Clear all", "Countries", checkbox ticks) | Palette-state artifact of sampling at scroll 0. In situ the section is light and the text is legible.                                                                                        |
| The design's "WHEN" looked washed out vs. a solid dark implementation                 | Mid-fade during the scroll reveal. At a settled position both render dark.                                                                                                                   |
| Implementation has a floating "N" badge                                               | Next.js dev-tools indicator, not app UI.                                                                                                                                                     |
| `h1`, chapter words, body copy and proxy geometry looked off by one line              | Scrollbar artifact — the implementation's content box was 378 not 393. Gone once suppressed.                                                                                                 |

---

## 6. Appendix

### Block map

All ten chapters are present in both, in the same order.

| #   | Chapter                        | Design y | Impl y | Figures (design → impl)        |
| --- | ------------------------------ | -------- | ------ | ------------------------------ |
| 0   | Hero                           | 0        | 0      | 1 canvas → 1 canvas            |
| 1   | Opening / ask the machine      | 920      | 852    | 2 beat strips → 2 beat strips  |
| 2   | Where                          | 1943     | 1941   | 2 → 2                          |
| 3   | A country is not an average    | 4127     | 4158   | 3 → 3                          |
| 4   | CDR by region                  | 6433     | 6304   | 1 → 1 + legend                 |
| 5   | Borders are the wrong unit     | 7387     | 7248   | 1 → 1                          |
| 6   | When                           | 7846     | 7766   | 8 → 8 + 5 tables + 1 extra map |
| 7   | Who                            | 16542    | 20773  | 2 → 2, minus 3 cards           |
| 8   | A war is not a Poisson process | 18296    | 22388  | 2 → 2, minus 3 cards           |
| 9   | What is still missing          | 21002    | 25730  | 0 → 0                          |
| 10  | Now you know                   | 21717    | 26601  | 0 → 0                          |

### Type scale reference

| Role                    | Design                            | Implementation                |
| ----------------------- | --------------------------------- | ----------------------------- |
| Hero `h1`               | Bebas Neue 86 / 73.96             | Bebas Neue 86.46 / 74.36 ✓    |
| Chapter (Where/When)    | Bebas 148 / 124.32                | Bebas 149.34 / 125.45 ✓       |
| Chapter (Who)           | Bebas 164                         | Bebas 165.06 ✓                |
| Chapter (still missing) | Bebas 72                          | Bebas 70.74 ✓                 |
| Section heading         | Bebas 36 / 36.72                  | Bebas 36 / 36.72 ✓            |
| Sub-heading             | Bebas 26 / 27.3                   | Bebas 26 / 27.3 ✓             |
| Chart title             | Bebas 21 / 24.15                  | Bebas 21 / 24.15 ✓            |
| Body                    | Libre Baskerville 15 / 25.2       | Libre Baskerville 15 / 25.2 ✓ |
| Chapter sub             | LB 15 / **23.25**, `#b8b8bc`      | LB 15 / **25.2**, `#e0e0e2` ✗ |
| Chart copy              | LB **12** / 18.6                  | LB **15** / 25.2 ✗            |
| Chart note              | LB **11.5** / 18.4                | LB **15** / 25.2 ✗            |
| Proxy strip body        | LB **14.5** / 23.2, `#fff`        | LB **15** / 25.2, `#e0e0e2` ✗ |
| Table cell              | LB **12.5** / 18.75               | LB **13.6** / normal ✗        |
| Accordion status        | **Libre Baskerville** 12          | **Public Sans** 12 / 16.8 ✗   |
| Closing copy            | **Libre Baskerville** 14.5 / 23.2 | **Public Sans** 14.5 / 23.2 ✗ |
| Persona step            | **Archivo** 14 / 800              | **Public Sans** 14 / 700 ✗    |
| Persona draw            | Public Sans 15 / **21.75**        | Public Sans 15 / **25.2** ✗   |

Shared families: Bebas Neue (display), Libre Baskerville (body serif), Public Sans (UI).
**Archivo** appears in the design's persona steps and is not used in the implementation.

### Proxy strip colour ramp

Sampled at scroll 0, where both pages are in their dark palette state. In view (light
palette) strip 1 matches; the ramp offsets below still differ.

| Rank                          | Design           | Implementation   |
| ----------------------------- | ---------------- | ---------------- |
| 1 GDP per capita              | `rgb(8,142,247)` | `rgb(8,8,247)`   |
| 2 Neighbouring countries      | `rgb(8,22,247)`  | `rgb(128,8,247)` |
| 3 Climatic zone               | `rgb(7,228,214)` | `rgb(7,117,228)` |
| 4 Latitude                    | `rgb(113,8,247)` | `rgb(247,8,247)` |
| 5 Share of population over 65 | `rgb(8,247,113)` | `rgb(8,247,247)` |

### Artifacts

Paired screenshots (`design | implementation`) and raw extracts:

```
<scratchpad>/audit/shots/pair-*.png     20 paired frames
<scratchpad>/audit/proto-outline.clean.txt / impl-outline.clean.txt
<scratchpad>/audit/proto-full.clean.txt  / impl-full.clean.txt
<scratchpad>/audit/text-diff.txt         aligned prose diff
```
