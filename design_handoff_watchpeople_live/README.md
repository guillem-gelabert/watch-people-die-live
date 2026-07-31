# Handoff: watchpeople.live — mobile scrollytelling redesign

## Overview

A single-page, full-viewport mobile scroll experience for **watchpeople.live**. It opens on a live three.js globe where each flash is a modelled death, then scrolls through a seven-layer narrative that explains how the death model is built: **Where** (global rate → country rate → sub-national region), **When** (seasonality and the search for a proxy), **Who**, conflict deaths, and what is still missing. It closes by letting the reader pull the globe back up.

The defining idea is a **per-section colour system**: every section declares a "sky" colour, and the entire palette for that section — text, panels, chart series, interactive controls — is generated from it at runtime. Nothing is expected to harmonise across the whole page; only what shares a screen has to agree.

## About the Design Files

The files in this bundle are **design references created in HTML** — a working prototype of the intended look and behaviour, not production code to copy directly.

The task is to **recreate this design in watchpeople.live's existing environment**, using its established framework, component patterns and data layer. If no front-end environment exists yet, choose the framework that suits a scroll-driven, canvas-heavy editorial page (a light React or Svelte app, or plain modules — there is no need for a heavy UI framework here) and implement the design there.

Two things in the prototype are scaffolding, not design:

- `support.js` and the `.dc.html` wrapper are the prototyping runtime this file was authored in. **Ignore them entirely.** All meaningful code is the `class Component` block inside the HTML.
- The design is rendered inside a simulated 393 × 852 phone frame (`#device-root` / `#frame` / `#phone`). In production, `#phone` is simply the document scroll container and the frame disappears. Anywhere the prototype measures against `#phone`, production measures against the viewport.

## Fidelity

**High fidelity.** Colours, typography, spacing, motion timings and interaction behaviour are final. Recreate pixel-accurately, but generate colour through the palette system described below rather than hardcoding the values you sample from screenshots — the palette is the design.

---

## Global architecture

### Scroll container

One vertical scroll container holds a `#stage` (sticky, full-height, `z-index:3`, `pointer-events:none`) carrying the globe canvas, and `#flow`, the stacked `<section>` elements. Scroll drives four things every frame, all from one `onScroll` handler:

1. **Phase** — `phase = clamp(scrollTop / (viewportHeight × 0.95), 0, 1)`, smoothstepped. Drives the globe's exit (scale, translate, fade) and the hero copy.
2. **Sky** — the background colour of the scroll container is interpolated between the `data-sky` of the section leaving and the one arriving; on each change the whole palette regenerates and every figure repaints.
3. **Reveal** — `[data-rv]` elements fade/slide in once when they enter.
4. **Section-local scroll mechanics** — currently the proxy card (below).

### Sections

Each `<section>` carries `data-screen-label` (human name) and `data-sky` (its palette seed):

| Label | Sky | Content |
|---|---|---|
| First light | `#2b1c3a` | Opening question, chat exchange, "deaths aren't evenly spaced" |
| Where — global rate | `#e8956d` | Chapter title "Where", ocean/land tally, Poisson vs metronome strips |
| Where — country rate | `#f6c58f` | "A country is not an average", grid maps (West Africa, Benelux), Asia density map with log/linear toggle |
| Where — CDR by region | `#e7e9e4` | Japan polar map, regional rate ramp |
| Where — region | `#a6d2f5` | "Borders are the wrong unit" |
| When — seasonality | `#bcd8ee` | Chapter title "When", country curve chart, **proxy ranking card + modal**, five proxy correlation charts, amplitude map |
| Who | `#d9dbdd` | Persona generation |
| Conflicts | `#eeb87d` | "A war is not a Poisson process" |
| Still missing | `#cf7a68` | Open problems |
| Back to the globe | `#000000` | Pull-up gesture returning to the top |

---

## The palette system (implement this first)

Everything visual derives from the current section's sky colour. Two layers:

### 1. `skinFromSky(sky)` → the section's UI skin

Returns an opaque set of UI tones. `dark = luminance(sky) < 0.2`.

| Token | Light sky | Dark sky |
|---|---|---|
| `paper` | `mix(sky, white, 0.82)` | `mix(sky, white, 0.11)` |
| `ink` | `#1d1822` | `#ffffff` |
| `body` | `mix(sky, #1d1822, 0.94)` | `mix(sky, white, 0.88)` |
| `mute` | `mix(sky, #1d1822, m)` where `m` = 0.9 / 0.8 / 0.7 as luminance < 0.36 / < 0.5 / else | `mix(sky, white, 0.72)` |
| `tile` | `mix(sky, white, 0.58)` | `mix(sky, white, 0.16)` |
| `tileMuted` | `mix(sky, white, 0.40)` | `mix(sky, white, 0.09)` |
| `tileOpen` | `mix(sky, white, 0.84)` | `mix(sky, white, 0.26)` |
| `rule` | `rgba(29,24,34,.24)` | `rgba(255,255,255,.26)` |
| `dataRGB` | `tone(sky, 0.12)` | `tone(sky, 0.30)` |
| `hiRGB` | `tone(invert(sky), 0.18)` | same |

`mix(a,b,t)` is per-channel lerp; `tone(c,l)` pushes a colour to a target lightness keeping hue.

### 2. `schemes(el, vivid, anchor)` → the section's colour harmonies

From the section's sky hue (or from `anchor`, an explicit colour), generate **all** classical harmonies at once:

```
base              hue + 0
complementary     [0, 180]
splitComplementary[0, 150, 210]
triadic           [0, 120, 240]
tetradic          [0, 90, 180, 270]
analogous         [0, 30, -30, 60, -60]
mono(n)           n steps of lightness at constant hue
```

- Saturation: `vivid ? 0.94 : clamp(skySat + 0.2, 0.4, 0.82)`
- Lightness: `vivid ? 0.5 - i*0.04 : dark ? 0.62 + i*0.07 : 0.46 - i*0.07`
- `mono(n)` lightness ramp: dark sky `0.34 → 0.84`, light sky `0.72 → 0.22`
- Cache per sky; invalidate when the sky changes.

`harmony(n, el, vivid)` is the convenience picker: n=1 base, 2 complementary, 3 split-complementary, 4 tetradic, ≤6 analogous + complement, else `mono(n)`.

### 3. `marks(cols, el)` — legibility pass for data ink

Chart canvases are **transparent**, so marks composite over the sky itself. Any colour used for dots, rings or hairlines must be pushed through `contrastFix`: convert to HSL and step lightness away from the sky (−0.03 if sky luminance > 0.4, else +0.03, max 26 steps) until WCAG contrast against the sky reaches **3:1**. Large solid fills (the proxy strips) skip this — they are already legible and the vivid tier is the point.

### 4. Figure re-skinning

Every figure is authored with literal colours and re-expressed in the section palette at draw time. `mapColor(str, P)`:

- Parse to RGB + alpha. Compute saturation and relative luminance `L`.
- **Greys** (`saturation < 26`): map onto the paper→ink axis by `t = clamp((0.76 − L) / 0.7, 0, 1)`.
- **Warm/red family** (`r >= b`): map onto `hiRGB` (the sky's complement).
- **Blue family**: map onto `dataRGB` (the sky's own dark tone).
- Relative lightness is preserved, so ramps stay ramps and highlights stay highlights.

The canvas context is wrapped in a proxy that runs every `fillStyle` / `strokeStyle` / gradient stop through `mapColor`. DOM figures get the same treatment via `mapInline`, which restores each element's original inline style before remapping so repeated theme changes can't drift.

**Port note:** if the target codebase prefers explicit tokens, generate the palette once per section into CSS custom properties on the section element and let components read them. The runtime canvas proxy is only needed for the canvas figures.

---

## Screen: the proxy ranking card (the most complex interaction)

Lives in the **When — seasonality** section. Three states: **stack**, **modal**, **result**.

### State 1 — the sticky stack

Markup:

```
#proxy-stack        position:relative, explicit height set in JS = round(vh*0.55*5 + vh*0.22)
  #proxy-card       position:sticky; top:12px; padding:14px 13px 15px; border-radius:18px
                    background = skin.tileOpen, color = skin.body
    #proxy-title    "Potential seasonality proxies" — flex centred, min-height 38px,
                    Bebas Neue 23px, color skin.ink
    #proxy-best     "BEST PREDICTOR" + rule — 700 8.5px Public Sans, .09em, uppercase,
                    skin.mute at 60%, opacity 0 until all boxes are folded
    #proxy-boxes    the five boxes
    #proxy-foot
      #proxy-worst  rule + "WORST", same treatment
      #proxy-reorder  hidden until the modal has been dismissed once
```

Each box (`[data-proxy="0..4"]`):

- `box-sizing:border-box; overflow:hidden; border-radius:16px; padding:16px 16px 17px; margin-top:12px` (0 for the first)
- Background = `schemes(section, vivid=true).analogous[i]` — **keyed to the `data-proxy` index, never to DOM position**, so reordering never repaints.
- Text colour chosen by fill luminance: `luminance > 0.55 ? skin.ink : #ffffff`.
- Contents: a flex row (`align-items:center; gap:9px`) holding the rank number (Bebas 21px, opacity .62, min-width 15px), the title `h3` (Bebas 24px, `flex:1; min-width:0`), and a controls group (`[data-proxy-ctl]`, opacity 0 until folded) with an ⓘ button and two screen-reader-only "Move up" / "Move down" buttons; below the row, the explanatory paragraph (Public Sans 14.5px / 1.6).

**The fold.** Progress is derived from the sticky card's travel:

```
travel = stackHeight − vh*0.5
raw    = clamp((containerTop + 12 − stackTop) / travel, 0, 1)
P      = raw × (5 + 0.25)
```

For each box at **DOM position** `i` (not its attribute index — a reordered list must still fold top-down):

```
k = clamp(P − i, 0, 1);  e = k*k*(3 − 2k)       // smoothstep
height        = 46 + (naturalHeight − 46) × (1 − e)
paddingTop    = 10 + 6 × (1 − e)
paddingBottom = 10 + 7 × (1 − e)
marginTop     = i ? 6 + 6 × (1 − e) : 0
paragraph opacity = 1 − min(1, e / 0.55)
```

Once `e > 0.55` the paragraph is set to `display:none` and the box becomes `display:flex; flex-direction:column; justify-content:center`, so the title sits exactly mid-strip; the title also gets `white-space:nowrap; overflow:hidden; text-overflow:ellipsis` so long labels ride one line. Natural heights are measured once per width (temporarily setting `height:auto` with full padding) and cached.

No CSS transitions on these properties — scroll drives them raw. The card is **not** height-capped; it hugs its boxes and shrinks as they fold.

### State 2 — the modal

When the last box reaches `e > 0.995`, the card is promoted into a full-screen modal (once per session).

- Scrim: `position:fixed; inset:0; background:rgba(8,10,16,.55); backdrop-filter:blur(3px)`, fades in over 350ms.
- Modal: `position:fixed; inset:0; display:flex; flex-direction:column; justify-content:center; padding:52px 20px 26px`, background `skin.paper`, `opacity 0 → 1` and `scale(1.02) → scale(1)` over 340/380ms `cubic-bezier(.22,1,.36,1)`.
- The card element is **moved into** the modal (`position:static`, transparent background) and moved back on close. Its own title is hidden while in the modal.
- Body scroll is locked while open.

Content order:

1. Eyebrow — "Before we look at the data", 700 10px Public Sans, .13em tracking, uppercase, accent colour (`mapColor("#2f4bff", skin)`).
2. `h3` — "Which of these tracks seasonality?", Bebas Neue 38px / .98, `skin.ink`.
3. Paragraph — "Order the five candidates from the strongest predictor of a country's seasonal swing down to the weakest. Drag a row to move it; tap **i** to reread the case for each.", 500 13px / 1.55, `skin.mute`.
4. The list (scrollable if needed). In the modal the strips grow: height 62px, padding 14px, margin-top 9px, title 27px (22px if the label is longer than 22 characters), rank 24px, ⓘ 24px, `cursor:grab`.
5. Paragraph — "Then we'll put each one against the countries that do report monthly deaths, and see which holds up."
6. Buttons row, `gap:9px`, height 46px, radius 13px, 600 13px Public Sans: **Skip** (`flex:1`, background `skin.tile`, colour `skin.body`) and **Submit my ranking** (`flex:1.5`, background `skin.ink`, colour `skin.paper`).

**Shuffle hint.** 700ms after the modal opens, the strips animate a single visible shuffle and return, so the affordance is obvious:

- `transition: transform .54s cubic-bezier(.22,1,.36,1)`
- offsets `[+1, −1, 0, +1, −1] × rowHeight` (rowHeight = the measured pitch between strips)
- at 790ms all return to `translateY(0)`; at 1430ms transitions and transforms are cleared.

**Reordering** (modal only — the strips are inert in the page):

- *Drag*: `pointerdown` on a strip (ignoring the ⓘ and the a11y buttons) lifts it (`scale(1.03)`, `0 10px 24px rgba(20,16,26,.32)`, `z-index:3`). On `pointermove`, whichever strip's bounds contain the pointer's Y becomes the target index; the dragged node is re-inserted and displaced siblings animate with FLIP (`transform .26s cubic-bezier(.22,1,.36,1)` from their recorded offset). Drop springs back with `transform .42s cubic-bezier(.34,1.56,.64,1)`.
- *Arrows*: the two screen-reader-only buttons swap the strip with its neighbour, animated with the same FLIP.
- Scroll-driven folding is suspended while dragging and while the modal is open.
- Rank numbers renumber by DOM position after every move.

**ⓘ tooltip.** Each strip's ⓘ carries that proxy's paragraph text as `data-tip`. Tap toggles a tooltip: `max-width min(240px, containerWidth − 28)`, `padding 9px 11px`, `border-radius 10px`, background `skin.tileOpen`, colour `skin.body`, `1px solid skin.rule`, positioned above the icon or below if it would clip.

**Close** — Submit, Skip or the scrim. On Submit only, the DOM order is stored as the reader's ranking. Either way the modal never auto-opens again; a **"Reorder the proxies"** button appears in the card foot (height 36px, radius 11px, background `skin.tile`, colour `skin.ink`) to reopen it.

### State 3 — the result echo

If the reader submitted, each correlation chart heading downstream gains an inline note reading **"Your #N"** — 700 9.5px Public Sans, .08em, uppercase, `skin.mute`, `margin-left:9px`, vertically centred. Headings are tagged `data-proxy-for="<proxy index>"`:

| Heading | Proxy |
|---|---|
| Latitude correlation | 3 |
| Amplitude by climate zone | 2 |
| Amplitude vs. population 65+ | 4 |
| Amplitude vs. GDP per capita | 0 |
| Amplitude vs. neighbouring countries | 1 |

The five proxies, in `data-proxy` order: **0** GDP per capita, **1** Neighbouring countries, **2** Climatic zone, **3** Latitude, **4** Share of population over 65.

---

## Charts

All charts are `<canvas>` with `aspect-ratio` set in CSS, `background:transparent`, `border-radius:10px`. Sized at draw time to `clientWidth/Height × devicePixelRatio` (capped at 2). Each redraws when the section palette changes.

Each proxy chart takes its palette from **its own proxy's colour**: `schemes(el, vivid=true, anchor=proxyColour[i])`, then the scheme matching the number of series, then `marks()` for legibility.

### Latitude correlation (`data-chart="latitude"`, proxy 3, complementary)

Two series against absolute latitude, each toggleable by a checkbox above the canvas (17px square, radius 5px, filled with the series colour and a white ✓ when on, `inset 0 0 0 1.6px skin.rule` when off; label `skin.ink` / `skin.mute`). The last active series cannot be switched off.

- x: 0–70°, ticks every 10° labelled `n°`, axis caption "absolute latitude".
- y: amplitude as a percentage `(amplitude − 1) × 100`, grid every 10% (5% when the max is ≤ 25), labelled `n%`.
- **Countries**: filled dots, r = 3.1, series colour.
- **Regions**: hollow rings, r = 3.1, 1.2px stroke, complement colour at 60% alpha, drawn behind.
- Dotted vertical guides at **23.44°** ("Tropic") and **66.56°** ("Polar Circle"), `setLineDash([2,3])`, `skin.rule`, labels above the plot in `skin.mute`.
- Italic annotation at the top left, 9.5px: `countries R² = 0.63 · regions R² = 0.53` — computed live from whichever series are visible.

Margins `{l:36, r:14, t:46, b:30}`.

### Amplitude by climate zone (`data-chart="koppen"`, proxy 2, split-complementary)

One column per Köppen zone: `Af Aw BWh BSk Csa Cfa Cfb Dfb Dfc`. The point of the chart is packing — a tight column means climate is a good proxy.

- Behind each column, a rounded band (radius 6px) spanning the 10th–90th percentile of that bucket, accent colour at 10% alpha, width 68% of the column.
- Regions: hollow rings r = 2.5, 1.1px, second scheme colour at 42% alpha, deterministic x-jitter ±24% of column width.
- Countries: filled dots r = 2.7, accent, jitter ±20%.
- Mean: 1.8px horizontal line across 68% of the column, third scheme colour.
- y in percent with 10% grid; zone codes below in 600 9.5px; caption "Köppen-Geiger zone".

Margins `{l:36, r:10, t:20, b:42}`.

### Amplitude scatters (`amp65`, `ampGdp`, `ampNeighbour` — proxies 4, 0, 1, tetradic)

Amplitude (y, percent, gridlines at 0/10/20/30%) against the proxy value (x). Filled dots whose alpha encodes income; a dashed regression line (1.5px, `setLineDash([5,4])`, second scheme colour) and an `r = 0.39` label in the top-right corner.

### Other figures

Maps (globe, hex, stipple/density, close-ups, Japan polar, amplitude choropleth, conflict) all follow the same rule: authored in literal colours, re-expressed through `mapColor` at draw time. The Asia density map has a **log/linear toggle** overlaid on the map itself: a 20%-wide square inset 10px from the top-left, radius 9px, split by its anti-diagonal — "Logarithmic" set on a logarithmic SVG `textPath` in the top-left half, "Linear" on a diagonal path in the bottom-right. The active half is filled solid with the palette complement and its label is `skin.paper`; the inactive half is a 14%-tint of the same hue with the label in the complement. Clicking anywhere toggles.

---

## Interactions & motion summary

| Interaction | Behaviour | Timing |
|---|---|---|
| Globe exit | scale/translate/fade driven by scroll phase | continuous, smoothstep |
| Sky transition | interpolate between adjacent sections' `data-sky`; regenerate palette; repaint figures | continuous |
| Reveal | `[data-rv]` fades and slides in on enter, once | ~0.5s ease |
| Proxy fold | height/padding/margin/paragraph-opacity from scroll | continuous, no CSS transition |
| Modal open | scrim fade + modal fade/scale | 340ms / 380ms `cubic-bezier(.22,1,.36,1)` |
| Shuffle hint | out then back | starts 700ms after open; 540ms per leg; returns at 790ms; cleared at 1430ms |
| Drag reorder | lift, FLIP displacement, spring drop | 180 / 260 / 420ms |
| ⓘ tooltip | toggle on tap | 160ms |
| Density toggle | half fills swap | 180ms ease |
| Pull-up ending | upward drag fills a progress bar; release scrolls back to the top | bar tracks the gesture |

## State

| State | Type | Notes |
|---|---|---|
| `phase` | number 0–1 | globe exit / hero |
| `theme` | palette object | regenerated on sky change |
| `stipLog` | boolean | density map scale, default true |
| `latShow` | `{countries, regions}` | latitude series toggles, both true |
| `seasPick` | Set of country names | curve chart selection, defaults to Switzerland |
| `proxyDragging` / `_proxyModal` / `_proxyDone` | booleans | suppress scroll writes, modal open, modal already seen |
| `proxyGuess` | array of proxy indices | saved on Submit only; drives the "Your #N" notes |

All figure data is embedded as constant arrays in the prototype (`C` country table, `SEAS` seasonality table, `HOTSPOTS`, `TILES`, `DEFS`). In production these should come from the real data layer; the shapes are documented inline in the source.

## Design tokens

**Typography**

| Role | Font | Size / line-height | Weight |
|---|---|---|---|
| Hero | Bebas Neue | 86px / 0.86 | 400 |
| Chapter title | Bebas Neue | 148–164px / 0.84 | 400 |
| Section heading | Bebas Neue | 36px / 1.02 | 400 |
| Sub-heading | Bebas Neue | 26px / 1.05 | 400 |
| Card title | Bebas Neue | 23–24px | 400 |
| Modal heading | Bebas Neue | 38px / 0.98 | 400 |
| Body | Libre Baskerville | 15px / 1.68 | 400 |
| Card body | Public Sans | 14.5px / 1.6 | 400 |
| Note / caption | Public Sans | 12.5–13px / 1.5 | 500 |
| Micro label | Public Sans | 8.5–10px, .08–.13em, uppercase | 700 |
| Chart labels | Public Sans | 9.5px | 500–600 |

**Spacing** — 6, 8, 9, 10, 12, 14, 16, 18, 20, 22, 26 px. Section padding `26px 22px`. Paragraph rhythm `margin-top: 14px`.

**Radius** — 5 (checkbox), 9–10 (chart, toggle), 11–13 (buttons), 16 (proxy box), 18 (card), 20 (sheet), 999 (chips).

**Shadow** — drag lift `0 10px 24px rgba(20,16,26,.32)`; sheet `0 -12px 44px rgba(0,0,0,.35)`; tooltip `0 10px 26px rgba(0,0,0,.18)`.

**Accent** — `#2f4bff` mapped through `mapColor` into the current section's palette.

## Assets

- **Fonts**: Bebas Neue, Public Sans, Libre Baskerville (Google Fonts).
- **Globe**: three.js sphere with a night-lights texture; the prototype falls back to a CSS radial-gradient poster (`#globe-poster`) before the WebGL scene is ready — keep that fallback.
- **Geography**: Natural Earth land, countries and 50m outlines fetched at runtime through d3-geo; the graticule is generated, not an asset.
- No raster images or icon sets. The ⓘ, arrows and ✓ are text glyphs.

## Accessibility notes

- Reordering must stay operable without pointer drag: the visually-hidden "Move up" / "Move down" buttons on each strip are the keyboard/AT path and must survive the port.
- The ⓘ tooltip content duplicates the strip's own paragraph — expose it as accessible text, not only as a hover/tap affordance.
- The contrast pass (`marks`, 3:1 against the sky) applies to data ink. Body and heading tones come from `skin.body` / `skin.ink`, which are already tuned per sky.
- Honour `prefers-reduced-motion`: skip the shuffle hint and the globe animation, keep the scroll fold (it is positional, not decorative).

## Screenshots

`screenshots/` holds reference captures of the key states:

| File | State |
|---|---|
| `01-hero.png` | Opening screen — globe + hero line |
| `02-proxy-stack-folding.png` | Sticky proxy card mid-fold (two strips collapsed, one expanded) |
| `03-ranking-modal.png` | Full-screen ranking modal |
| `04-latitude-correlation.png` | Latitude chart — countries (filled) vs regions (rings) |
| `05-climate-zone.png` | Köppen columns with spread bands and means |
| `06-your-rank-note.png` | A correlation heading carrying the reader's "Your #N" |
| `07-density-log-linear-toggle.png` | Diagonal log/linear toggle from the Asia density map |

Colours in these captures are whatever the section palette resolved to at capture time — treat them as layout and behaviour references, and generate colour from the palette rules above.

## Files

- `Watch People Die Live - Mobile.dc.html` — the full design. All logic lives in the `class Component` block near the bottom; markup is above it. Key methods: `skinFromSky`, `schemes`, `harmony`, `marks`, `contrastFix`, `mapColor`, `skinCtx`, `mapInline`, `applyInk`, `stackProxies`, `openProxyModal`, `shuffleHint`, `wireProxyDrag`, `latScatter`, `strips`, `ampScatter`.
- `support.js` — prototyping runtime. **Not part of the design; do not port.**
