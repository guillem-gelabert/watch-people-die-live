# Handoff: watchpeople.live — mobile scrollytelling redesign

## Overview

A single-page, full-viewport mobile scroll experience for **watchpeople.live**. It opens on a live globe where each flash is a modelled death, then scrolls through a narrative explaining how the death model is built: **Where** (global rate → country rate → sub-national region), **When** (seasonality and the search for a proxy), **Who**, conflict deaths, and what is still missing. It closes by letting the reader pull the globe back up.

The defining idea is a **per-section colour system**: every section declares a "sky" colour, and the entire palette for that section — text, panels, chart series, interactive controls — is generated from it at runtime. Nothing is expected to harmonise across the whole page; only what shares a screen has to agree.

## About the design files

The bundle is a **design reference authored in HTML** — a working prototype of the intended look and behaviour, not production code to copy directly.

The task is to **recreate this design in watchpeople.live's environment**, using its established framework and data layer. If no front-end environment exists yet, pick something light suited to a scroll-driven, canvas-heavy editorial page (small React/Svelte app or plain ES modules).

What in the bundle is design vs scaffolding:

- **`Watch People Die Live - Mobile.dc.html` is the source of truth.** Everything meaningful is in it: all markup (top of file), all logic and data (the single `class Component` block, ~2,400 lines). Line references below are into this file.
- `support.js` is the prototyping runtime the file was authored against. **Ignore it; do not port it.**
- The design renders inside a simulated 393 × 852 phone (`#device-root` / `#frame` / `#phone`). In production `#phone` is the document scroll container and the frame disappears. Anywhere the code measures `#phone`, production measures the viewport. Section padding uses `cqh` (container-query height) units against the phone frame — swap for `vh`/`svh` in production.

## Fidelity

**High fidelity.** Typography, spacing, motion timings and interaction behaviour are final. Recreate pixel-accurately, but generate colour through the palette system rather than hardcoding sampled values — the palette IS the design. Screenshots show whatever the palette resolved to at capture time.

---

## Global architecture

### Scroll container

One vertical scroll container (`#phone`) holds `#stage` (sticky full-height, `z-index:3`, `pointer-events:none`, carrying the three.js globe canvas and the live tallies) and `#flow`, the stacked `<section>` elements. One `onScroll` handler drives, per frame:

1. **Phase** — `clamp(scrollTop / (vh × 0.95), 0, 1)`, smoothstepped: globe exit (scale/translate/fade) and hero copy.
2. **Sky** — `applySky()` interpolates the container background between the `data-sky` of the leaving and arriving sections; each change regenerates the palette (`applyTheme`) and repaints every figure (`repaintFigures`).
3. **Reveal** — `[data-rv]` elements fade/slide in once when entering (`runReveal`); typewriter blocks use `runType`/`typeOut`.
4. **Section-local mechanics** — the proxy fold (`stackProxies`) and the end-of-page pull-up (`wirePull`).

### Sections

Each `<section>` carries `data-screen-label` and `data-sky`:

| Label | Sky | Content |
|---|---|---|
| First light | `#2b1c3a` | Opening question, chat exchange, "deaths aren't evenly spaced" |
| Where - global rate | `#e8956d` | Chapter "Where", ocean/sparse/dense dart tally (`bumpCount`/`limits`), Poisson vs metronome strips |
| Where - country rate | `#f6c58f` | "A country is not an average", grid maps, Asia density map with the log/linear toggle |
| Where - CDR by region | `#e7e9e4` | Japan polar map, regional rate ramp |
| Where - region | `#a6d2f5` | "Borders are the wrong unit", closeup + subnational maps |
| When - seasonality | `#bcd8ee` | Chapter "When", country curve chart (`curveMulti` + `seasChips`), **proxy ranking card + modal**, five proxy charts, amplitude map |
| Who | `#d9dbdd` | Persona generation (`personaDemo`) |
| Conflicts | `#eeb87d` | "A war is not a Poisson process", conflict map |
| Still missing | `#cf7a68` | Open problems |
| Back to the globe | `#000000` | Pull-up gesture returning to the top (`wirePull`) |

---

## The palette system (implement this first)

All colour derives from the current section's sky. Methods named here exist verbatim in the source.

### 1. `skinFromSky(sky)` → UI skin

`dark = luminance(sky) < 0.2`. Returns:

| Token | Light sky | Dark sky |
|---|---|---|
| `paper` | `mix(sky, white, .82)` | `mix(sky, white, .11)` |
| `ink` | `#1d1822` | `#ffffff` |
| `body` | `mix(sky, #1d1822, .94)` | `mix(sky, white, .88)` |
| `mute` | `mix(sky, #1d1822, m)`, m = .9/.8/.7 by sky luminance < .36/< .5/else | `mix(sky, white, .72)` |
| `tile` | `mix(sky, white, .58)` | `mix(sky, white, .16)` |
| `tileMuted` | `mix(sky, white, .40)` | `mix(sky, white, .09)` |
| `tileOpen` | `mix(sky, white, .84)` | `mix(sky, white, .26)` |
| `rule` | `rgba(29,24,34,.24)` | `rgba(255,255,255,.26)` |
| `dataRGB` | `tone(sky, .12)` | `tone(sky, .30)` |
| `hiRGB` | `tone(invert(sky), .18)` | same |

`mix` = per-channel lerp; `tone(c, l)` pushes to a target lightness keeping hue.

### 2. `schemes(el, vivid, anchor)` → colour harmonies

From the sky hue (or `anchor`) generate **all** classical harmonies at once: `base`, `complementary` [0,180], `splitComplementary` [0,150,210], `triadic` [0,120,240], `tetradic` [0,90,180,270], `analogous` [0,30,−30,60,−60], and `mono(n)` (lightness ramp at constant hue: dark sky .34→.84, light .72→.22).

- Saturation: `vivid ? .94 : clamp(skySat + .2, .4, .82)`
- Lightness: `vivid ? .5 − i·.04 : dark ? .62 + i·.07 : .46 − i·.07`
- Cached per sky; invalidated on sky change.

`harmony(n, el, vivid)` picks by count: 1 base, 2 complementary, 3 split-comp, 4 tetradic, ≤6 analogous+complement, else mono.

### 3. `marks(cols, el)` / `contrastFix(col, bg, min)` — legibility pass for data ink

Chart canvases are **transparent**; marks composite over the sky itself. Every colour used for dots, rings, hairlines or chart lines goes through `contrastFix`: step HSL lightness away from the sky (−.03 if sky luminance > .4, else +.03, ≤26 steps) until WCAG contrast against the sky ≥ **3:1**. Large solid fills (the proxy strips) skip this — the vivid tier is the point. `proxyMarks(idx, n, el)` = `marks(proxyHarmony(idx, n, el))`.

### 4. Figure re-skinning — `mapColor(str, P)`

Every figure is authored in literal colours and re-expressed at draw time:

- Parse to RGB + alpha; compute saturation and relative luminance `L`.
- **Greys** (saturation < 26): map onto the paper→ink axis by `t = clamp((.76 − L)/.7, 0, 1)`.
- **Warm/red family** (`r ≥ b`): map onto `hiRGB` (sky's complement).
- **Blue family**: map onto `dataRGB` (sky's own dark tone).
- Relative lightness is preserved, so ramps stay ramps.

`skinCtx` wraps each canvas context in a Proxy that runs every `fillStyle`/`strokeStyle`/gradient stop through `mapColor`. DOM figures use `mapInline`, which restores the element's **original** inline style before remapping so repeated sky changes can't drift. `applyInk`/`stylePanels` re-ink text and panels per section.

**Port note:** if the target codebase prefers tokens, emit the palette as CSS custom properties per section; the canvas Proxy is only needed for canvas figures.

### 5. Proxy identity colours — `proxyCols(el)`

The five ranking strips wear `schemes(section, vivid).analogous`, **keyed to `data-proxy` index, never DOM position** — reordering never repaints. Strip text colour: fill luminance > .55 → `skin.ink`, else white.

---

## Screen: the proxy ranking card (the most complex interaction)

Lives in **When - seasonality**. Three states: **stack → modal → result**. Methods: `stackProxies`, `openProxyModal`, `modalStrips`, `shuffleHint`, `wireProxyDrag`, `moveProxy`, `saveProxyGuess`, `paintProxyNotes`, `rankProxies`, `closeProxyModal`.

### State 1 — the sticky stack

```
#proxy-stack     position:relative; height set in JS = round(vh·0.55·5 + vh·0.22)
  #proxy-card    position:sticky; top:12px; padding:14px 13px 15px; radius:18px
                 background skin.tileOpen; colour skin.body — NOT height-capped;
                 it hugs its boxes and shrinks as they fold
    #proxy-title "Potential seasonality proxies" — flex-centred, min-height 38px, Bebas 23px, skin.ink
    #proxy-best  "BEST PREDICTOR" + rule — 700 8.5px Public Sans, .09em, uppercase,
                 60% mute, opacity 0 until all folded
    #proxy-boxes the five strips
    #proxy-foot  rule + "WORST" (same treatment) and a "Reorder the proxies" button
                 (hidden until the modal has been dismissed once; 36px, radius 11,
                 skin.tile / skin.ink)
```

Each strip `[data-proxy="0..4"]`: `border-radius:16px; padding:16px 16px 17px; margin-top:12px` (first 0); flex row (`gap:9px`) of rank number (Bebas 21px, opacity .62), title `h3` (Bebas 24px, `flex:1`), and `[data-proxy-ctl]` (opacity 0 until folded) holding the ⓘ button and two visually-hidden Move up/Move down buttons; below, the explanation paragraph (Public Sans 14.5px/1.6).

**The fold** (scroll-driven, no CSS transitions):

```
travel = stackHeight − vh·0.5
raw    = clamp((containerTop + 12 − stackTop) / travel, 0, 1)
P      = raw × 5.25
per strip at DOM position i (not attribute index):
  k = clamp(P − i, 0, 1);  e = smoothstep(k)
  height        = 46 + (natural − 46)(1 − e)      // 46px min strip
  paddingTop    = 10 + 6(1 − e)
  paddingBottom = 10 + 7(1 − e)
  marginTop     = i ? 6 + 6(1 − e) : 0
  paragraph opacity = 1 − min(1, e/.55)
```

Past `e > .55` the paragraph is `display:none` and the strip becomes a centred flex column, title `nowrap/ellipsis`. Natural heights are measured once per width and cached. Folding is suspended while dragging or while the modal is open.

### State 2 — the modal

When the last strip passes `e > .995`, the card is promoted to a full-screen modal — **auto-opens once per session**; afterwards only the "Reorder the proxies" button reopens it.

- Scrim `rgba(8,10,16,.55)` + `blur(3px)`, 350ms fade. Clicking it closes.
- Modal `position:fixed; inset:0; flex column; justify-content:center; padding:52px 20px 26px`, background `skin.paper`, opacity 0→1 + `scale(1.02)→1`, 340/380ms `cubic-bezier(.22,1,.36,1)`. Body scroll locked.
- The card node is **moved into** the modal slot (`position:static`, transparent) and moved back on close; its own title hides while inside.

Content order: eyebrow "Before we look at the data" (700 10px, .13em, uppercase, accent = `mapColor('#2f4bff')`); `h3` "Which of these tracks seasonality?" (Bebas 38px/.98, skin.ink); instruction paragraph ("Order the five candidates… drag a row to move it; tap **i** to reread the case for each", 500 13px/1.55, skin.mute); the list (strips grow: 62px height, padding 14px, margin 9px, title 27px — 22px past 22 chars — rank 24px, `cursor:grab`); closing paragraph ("Then we'll put each one against the countries that do report monthly deaths…"); button row (`gap:9px`, 46px, radius 13, 600 13px): **Skip** (`flex:1`, skin.tile/skin.body) and **Submit my ranking** (`flex:1.5`, skin.ink/skin.paper).

**Shuffle hint** — 700ms after open, one visible shuffle and back: `transform .54s cubic-bezier(.22,1,.36,1)`, offsets `[+1,−1,0,+1,−1] × rowPitch`; return at 790ms; transitions cleared at 1430ms.

**Reordering** (modal only):

- *Drag*: `pointerdown` (ignoring ⓘ/a11y buttons) lifts the strip (`scale(1.03)`, shadow `0 10px 24px rgba(20,16,26,.32)`, z-index 3, 180ms). On `pointermove` the strip whose bounds contain pointer-Y becomes the target; re-insert, displaced siblings FLIP (`transform .26s cubic-bezier(.22,1,.36,1)`). Drop springs back `.42s cubic-bezier(.34,1.56,.64,1)`.
- *Buttons*: Move up/down swap with the neighbour via the same FLIP (`moveProxy`).
- Rank numbers renumber by DOM position after every move (`rankProxies`).

**ⓘ tooltip** — each ⓘ carries its strip's paragraph as `data-tip`; tap toggles a tooltip (max-width `min(240px, w−28)`, padding 9 11, radius 10, skin.tileOpen / skin.body, 1px skin.rule, above the icon or below if clipping).

**Close** — Submit, Skip, or the scrim. Submit stores the DOM order as `proxyGuess` (`saveProxyGuess`); either close sets `_proxyDone` so it never auto-opens again.

### State 3 — the result echo

If submitted, each downstream chart heading tagged `data-proxy-for="<idx>"` gains an inline **"Your #N"** note (700 9.5px, .08em, uppercase, skin.mute, margin-left 9px, vertically centred), re-inked on sky change (`paintProxyNotes`).

| Heading | Proxy |
|---|---|
| Latitude correlation | 3 |
| Amplitude by climate zone | 2 |
| Amplitude vs. population 65+ | 4 |
| Amplitude vs. GDP per capita | 0 |
| Amplitude vs. neighbouring countries | 1 |

`data-proxy` order: **0** GDP per capita, **1** Neighbouring countries, **2** Climatic zone, **3** Latitude, **4** Share of population over 65.

---

## Charts

All charts are `<canvas>` with CSS `aspect-ratio`, transparent background, radius 10px, sized at draw time to `clientWidth × devicePixelRatio` (capped at 2), redrawn on every palette change via `repaintFigures`. Shared scaffolding: `setup` (sizing), `frame`/`ticks` (axes), `legend`.

Each proxy chart anchors its palette to **its own proxy colour**: `schemes(el, vivid, anchor = proxyCols[i])`, scheme by series count, then `marks()`.

### Latitude correlation — `latScatter` (proxy 3, complementary)

Two series vs absolute latitude, toggleable via checkboxes (`latChips`: 17px, radius 5, filled with series colour + white ✓ when on, `inset 0 0 0 1.6px skin.rule` off; the last active series can't be switched off; state `latShow`).

- x 0–70°, ticks every 10°, caption "absolute latitude"; y = `(amplitude − 1) × 100` in %, grid every 10% (5% when max ≤ 25).
- Countries: filled dots r 3.1; Regions: hollow rings r 3.1, 1.2px, complement at 60% alpha, behind.
- Dashed guides (`[2,3]`) at **23.44°** "Tropic" and **66.56°** "Polar Circle", labels above the plot.
- Live italic annotation top-left: `countries R² = … · regions R² = …` (`fitR2`, computed from visible series).
- Margins `{l:36, r:14, t:46, b:30}`.

### Amplitude by climate zone — `strips` (proxy 2, split-complementary)

One column per Köppen code `Af Aw BWh BSk Csa Cfa Cfb Dfb Dfc`. The story is packing: a tight column ⇒ good proxy.

- Behind each column a rounded band (radius 6) spanning the 10th–90th percentile, accent at 10% alpha, 68% column width.
- Regions: rings r 2.5, 1.1px, second colour at 42% alpha, deterministic jitter ±24%; countries: dots r 2.7, accent, jitter ±20%; mean: 1.8px line across 68%, third colour.
- y in % with 10% grid; codes below 600 9.5px; caption "Köppen-Geiger zone". Margins `{l:36, r:10, t:20, b:42}`.

### Amplitude scatters — `ampScatter` (proxies 4, 0, 1, tetradic)

Amplitude (y, %, grid 0/10/20/30) vs proxy value (x). Filled dots, alpha encodes income; dashed regression (1.5px, `[5,4]`, second colour); `r = …` label top-right.

### Seasonality curves — `curveMulti` + `seasChips`

Monthly mortality curves for user-picked countries (state `seasPick`, default Switzerland, chips toggle). Line colours: `marks(harmony(n))`.

### Maps — `conicMap`, `randomMap`, `centroidMap`, `fourColour`, `closeup`, `gridFlashes`, `japanMap`, `subnational`, `conflictMap`, `hexMap`, `stippleMap`, `bokehMap`, `contourMap`

All share one dispatcher (~line 2385) that builds a d3-geo projection per `kind` (orthographic closeups, conic equal-area for South America/Asia, azimuthal for Japan/Europe, Natural Earth for world) plus a rasterised land-mask (`mask`) for point-in-land tests. All draw through `skinCtx`, so they re-skin automatically.

The Asia density map (`stipple`) carries the **log/linear toggle** (`paintDensToggle`, state `stipLog`): a 20%-wide square inset 10px top-left, radius 9, split on the anti-diagonal — "Logarithmic" on a curved SVG `textPath` in the upper-left half, "Linear" diagonal in the lower-right. Active half: solid palette complement, label `skin.paper`; inactive: 14% tint, label in the complement. Clicking anywhere on it toggles.

### The dart tally (Where - global rate)

`bumpCount` classifies random globe points as ocean / sparse / dense (`settled` = within ~245km of a HOTSPOTS centre); tally resets every 500 draws; `limits` Monte-Carlo-samples the convergence shares shown alongside.

---

## Interactions & motion summary

| Interaction | Behaviour | Timing |
|---|---|---|
| Globe exit | scale/translate/fade from scroll phase | continuous, smoothstep |
| Sky transition | lerp adjacent `data-sky`; regen palette; repaint figures | continuous |
| Reveal | `[data-rv]` fade/slide once on enter | ~.5s ease |
| Typewriter | chat bubbles type on | `runType` |
| Proxy fold | height/padding/opacity from scroll | continuous, raw |
| Modal open | scrim fade + fade/scale | 340/380ms `cubic-bezier(.22,1,.36,1)` |
| Shuffle hint | one shuffle out and back | +700ms; .54s legs; return 790ms; clear 1430ms |
| Drag reorder | lift, FLIP, spring drop | 180/260/420ms |
| ⓘ tooltip | tap toggle | 160ms |
| Density toggle | halves swap fills | 180ms |
| Pull-up ending | upward drag fills a bar; release scrolls to top | tracks gesture; snap-back 320ms |

## State

| State | Type | Notes |
|---|---|---|
| `phase` | 0–1 | globe exit / hero |
| `theme` | palette object | regenerated on sky change |
| `stipLog` | bool | density scale, default true |
| `latShow` | `{countries, regions}` | both true |
| `seasPick` | Set<string> | default `{"Switzerland"}` |
| `_proxyDragging` / `_proxyModal` / `_proxyDone` | bool | suppress fold; modal open; auto-open spent |
| `proxyGuess` | number[] | set on Submit only; drives "Your #N" |
| `counts` / `_lim` | tallies | dart demo |

## Data

All figure data is embedded as constants in the source — `HOTSPOTS` (populated centres), `C` (country table: name, lat, amplitude, GDP, 65+, region…), `SEAS` (monthly seasonality), `DEFS` (proxy definitions/copy), `TILES`. Geography (land, countries, 50m outlines) is fetched at runtime via d3-geo from Natural Earth. In production, wire these to the real data layer; shapes are documented inline.

## Design tokens

**Typography** — Bebas Neue (display), Libre Baskerville (body), Public Sans (UI), Google Fonts.

| Role | Font | Size / lh | Weight |
|---|---|---|---|
| Hero | Bebas Neue | 86px / .86 | 400 |
| Chapter title | Bebas Neue | 148–164px / .84 | 400 |
| Section heading | Bebas Neue | 36px / 1.02 | 400 |
| Sub-heading | Bebas Neue | 26px / 1.05 | 400 |
| Card/strip title | Bebas Neue | 23–27px | 400 |
| Modal heading | Bebas Neue | 38px / .98 | 400 |
| Body | Libre Baskerville | 15px / 1.68 | 400 |
| Card body | Public Sans | 14.5px / 1.6 | 400 |
| Note / caption | Public Sans | 12.5–13px / 1.5 | 500 |
| Micro label | Public Sans | 8.5–10px, .08–.13em, uppercase | 700 |
| Chart labels | Public Sans | 9.5px | 500–600 |

Hero copy sits at `top:66%` of the first viewport, centred, white with `text-shadow 0 2px 26px rgba(0,0,17,.8)`.

**Spacing** — 6/8/9/10/12/14/16/18/20/22/26px; section padding `26px 22px`; paragraph rhythm `margin-top:14px`.

**Radius** — 5 checkbox · 9–10 chart/toggle · 11–13 buttons · 16 strip · 18 card · 20 sheet · 999 chips.

**Shadow** — drag `0 10px 24px rgba(20,16,26,.32)`; sheet `0 -12px 44px rgba(0,0,0,.35)`; tooltip `0 10px 26px rgba(0,0,0,.18)`.

**Accent** — `#2f4bff` through `mapColor` into the current palette.

## Accessibility

- Reordering stays operable without drag: the visually-hidden Move up / Move down buttons are the keyboard/AT path — they must survive the port.
- ⓘ tooltip content duplicates the strip's paragraph — expose as accessible text.
- Data ink passes `marks` (3:1 vs sky); text tones come from `skin.body`/`skin.ink`.
- Honour `prefers-reduced-motion`: skip the shuffle hint and globe animation; keep the scroll fold (positional, not decorative).

## Screenshots

`screenshots/` — reference captures (palette = capture-time values; treat as layout/behaviour reference):

| File | State |
|---|---|
| `01-hero.png` | Opening screen — globe + hero line |
| `02-proxy-stack-folding.png` | Sticky proxy card mid-fold |
| `03-ranking-modal.png` | Full-screen ranking modal |
| `04-latitude-correlation.png` | Latitude chart — countries vs regions |
| `05-climate-zone.png` | Köppen columns with bands and means |
| `06-your-rank-note.png` | Heading with the reader's "Your #N" |
| `07-density-log-linear-toggle.png` | Diagonal log/linear toggle |

## Files

- `Watch People Die Live - Mobile.dc.html` — **the design + all code.** Markup at the top; the `class Component` block holds palette (`skinFromSky`, `schemes`, `harmony`, `marks`, `contrastFix`, `mapColor`, `skinCtx`, `mapInline`), scroll engine (`onScroll`, `applySky`, `reveal`, `stackProxies`), the proxy card/modal (`openProxyModal`, `modalStrips`, `shuffleHint`, `wireProxyDrag`, `moveProxy`, `saveProxyGuess`, `paintProxyNotes`), charts (`latScatter`, `strips`, `ampScatter`, `curveMulti`), map dispatcher + renderers, and the embedded data tables.
- `support.js` — prototyping runtime. **Not part of the design; do not port.**
- `screenshots/` — reference captures.
