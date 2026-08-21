// Every section of the story declares one colour — its "sky" — and the whole palette for
// that section is generated from it: text, panels, chart series, controls. Nothing is meant
// to harmonise across the page; only what shares a screen has to agree.
//
// Ported from the design handoff prototype (`design_handoff_watchpeople_live/`). Everything
// here is pure, so it is unit-testable under the node-environment Vitest config.

export type Rgb = [number, number, number];

// The opaque UI tones a section wears. `*RGB` members stay as triples because mapColor
// interpolates against them; the rest are ready-to-use CSS strings.
export interface Skin {
  dark: boolean;
  paperRGB: Rgb;
  inkRGB: Rgb;
  dataRGB: Rgb;
  hiRGB: Rgb;
  paper: string;
  tile: string;
  tileMuted: string;
  tileOpen: string;
  ink: string;
  inkTile: string;
  body: string;
  mute: string;
  rule: string;
}

export interface Schemes {
  hue: number;
  sat: number;
  dark: boolean;
  // The section's whole palette in one ordered array: base, then the eight distinct non-base
  // hues of the five classical schemes, then six monochromatic shades. Fifteen colours.
  palette: () => string[];
  base: string;
  complementary: string[];
  splitComplementary: string[];
  triadic: string[];
  tetradic: string[];
  analogous: string[];
  mono: (n: number) => string[];
}

const WHITE: Rgb = [255, 255, 255];
const INK: Rgb = [29, 24, 34];

// --- primitives --------------------------------------------------------------------

// WCAG relative luminance. Used for every legibility decision here, so it is worth the
// sRGB linearisation rather than a cheap 0.299/0.587/0.114 average.
export function relativeLuminance(c: Rgb): number {
  const [r, g, b] = c.map((v) => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function mixRgb(c: Rgb, t: Rgb, a: number): Rgb {
  return [
    Math.round(c[0] + (t[0] - c[0]) * a),
    Math.round(c[1] + (t[1] - c[1]) * a),
    Math.round(c[2] + (t[2] - c[2]) * a),
  ];
}

export function mix(c: Rgb, t: Rgb, a: number): string {
  return rgbCss(mixRgb(c, t, a));
}

export function rgbCss(c: Rgb): string {
  return "rgb(" + c.join(",") + ")";
}

// Accepts #rgb, #rrggbb, rgb() and rgba() (comma or slash separated, % alpha included).
// Returns null for anything else — callers pass colours through untouched in that case.
export function parseColor(str: string): { rgb: Rgb; a: number } | null {
  if (typeof str !== "string") return null;
  const h = str.trim();
  if (h.startsWith("#")) {
    const x = h.slice(1);
    const parts =
      x.length === 3 ? [...x].map((ch) => ch + ch) : [x.slice(0, 2), x.slice(2, 4), x.slice(4, 6)];
    const rgb = parts.map((v) => parseInt(v, 16));
    if (rgb.length !== 3 || rgb.some(Number.isNaN)) return null;
    return { rgb: rgb as Rgb, a: 1 };
  }
  const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)\s*(?:[,/]\s*([\d.%]+)\s*)?\)$/.exec(h);
  if (!m) return null;
  const rawAlpha = m[4];
  let a = rawAlpha === undefined ? 1 : parseFloat(rawAlpha);
  if (rawAlpha !== undefined && rawAlpha.endsWith("%")) a /= 100;
  return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], a };
}

// Reads a section's `data-sky` hex into a triple. Falls back to the pre-hero night sky.
export function parseSky(hex: string | null | undefined): Rgb {
  return parseColor(hex || "#000011")?.rgb ?? [0, 0, 17];
}

// Push a colour toward a target luminance while keeping its hue, by scaling all three
// channels. The two loops share a counter so a colour that overshoots on the way down
// cannot then oscillate indefinitely on the way back up.
export function toLuminance(c: Rgb, target: number): Rgb {
  let out: Rgb = [...c];
  let i = 0;
  while (relativeLuminance(out) > target && i++ < 60) {
    out = out.map((v) => Math.max(0, Math.round(v * 0.9))) as Rgb;
  }
  while (relativeLuminance(out) < target * 0.55 && i++ < 90) {
    out = out.map((v) => Math.min(255, Math.round(v * 1.1 + 7))) as Rgb;
  }
  return out;
}

export function rgbToHsl(rgb: Rgb): [number, number, number] {
  const r = rgb[0] / 255;
  const g = rgb[1] / 255;
  const b = rgb[2] / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let hue = 0;
  if (d) {
    if (mx === r) hue = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (mx === g) hue = ((b - r) / d + 2) * 60;
    else hue = ((r - g) / d + 4) * 60;
  }
  const l = (mx + mn) / 2;
  return [hue, d ? d / (1 - Math.abs(2 * l - 1)) : 0, l];
}

export function hslToCss(hue: number, sat: number, lig: number): string {
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const hp = ((((hue % 360) + 360) % 360) / 60) as number;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = lig - c / 2;
  const t: Rgb =
    hp < 1
      ? [c, x, 0]
      : hp < 2
        ? [x, c, 0]
        : hp < 3
          ? [0, c, x]
          : hp < 4
            ? [0, x, c]
            : hp < 5
              ? [x, 0, c]
              : [c, 0, x];
  return rgbCss(t.map((v) => Math.round((v + m) * 255)) as Rgb);
}

// --- the section skin --------------------------------------------------------------

// A dark sky flips the whole scheme: paper becomes a barely-lifted version of the sky
// instead of a nearly-white one, and ink goes white.
export function skinFromSky(sky: Rgb): Skin {
  const L = relativeLuminance(sky);
  const dark = L < 0.2;
  const paperRGB = mixRgb(sky, WHITE, dark ? 0.11 : 0.82);
  const inkRGB: Rgb = dark ? [...WHITE] : [...INK];
  const dataRGB = toLuminance(sky, dark ? 0.3 : 0.12);
  const hiRGB = toLuminance([255 - sky[0], 255 - sky[1], 255 - sky[2]], 0.18);
  const base = { dark, paperRGB, inkRGB, dataRGB, hiRGB, paper: rgbCss(paperRGB) };

  if (dark) {
    return {
      ...base,
      tile: mix(sky, WHITE, 0.16),
      tileMuted: mix(sky, WHITE, 0.09),
      tileOpen: mix(sky, WHITE, 0.26),
      ink: "#ffffff",
      inkTile: mix(sky, INK, 0.55),
      body: mix(sky, WHITE, 0.88),
      mute: mix(sky, WHITE, 0.72),
      rule: "rgba(255,255,255,.26)",
    };
  }
  // The darker the sky, the closer secondary text has to sit to full ink to stay legible.
  const m = L < 0.36 ? 0.9 : L < 0.5 ? 0.8 : 0.7;
  return {
    ...base,
    tile: mix(sky, WHITE, 0.58),
    tileMuted: mix(sky, WHITE, 0.4),
    tileOpen: mix(sky, WHITE, 0.84),
    ink: "#1d1822",
    inkTile: "#1d1822",
    body: mix(sky, INK, 0.94),
    mute: mix(sky, INK, m),
    rule: "rgba(29,24,34,.24)",
  };
}

// Every literal colour in a figure is re-expressed in the palette of the section it sits
// in: greys become paper-to-ink, the blue data family becomes the sky's own dark tone, and
// the warm/red highlight family becomes the sky's complement. Relative lightness is
// preserved, so ramps stay ramps and highlights stay highlights.
export function mapColor(str: string, skin: Skin): string {
  if (typeof str !== "string" || !str || str === "transparent") return str;
  const p = parseColor(str);
  if (!p) return str;
  const [r, g, b] = p.rgb;
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  const L = relativeLuminance(p.rgb);
  const out = (c: Rgb) => "rgba(" + c.join(",") + "," + p.a + ")";

  if (sat < 26) {
    return out(mixRgb(skin.paperRGB, skin.inkRGB, clamp01((0.76 - L) / 0.7)));
  }
  const base = r >= b ? skin.hiRGB : skin.dataRGB;
  const u = clamp01((0.72 - L) / 0.66);
  const light = mixRgb(base, WHITE, 0.74);
  const dark = mixRgb(base, [16, 12, 20], 0.5);
  return out(mixRgb(light, dark, u));
}

// --- harmonies ----------------------------------------------------------------------

// The classical harmonies, as pure hue rotations from the base. These match colorhexa's
// "Color Schemes" definitions exactly — checked against colorhexa.com/bcd8ee, whose base hue is
// 206°: complementary 26°, analogous 176/236°, split complementary 56/356°, triadic 86/326°,
// tetradic 146/326/26°. Each list includes the base at the position colorhexa shows it.
const HUE_OFFSETS = {
  complementary: [0, 180],
  analogous: [-30, 0, 30],
  splitComplementary: [-150, 0, 150],
  triadic: [-120, 0, 120],
  // colorhexa's tetrad is a rectangle, not a square: -60, +120, +180. Two of its three members
  // are the triadic +120 and the complement, so it contributes exactly one new hue (-60).
  tetradic: [-60, 0, 120, 180],
} as const;

// The eight distinct non-base hues the five schemes above produce between them, ordered by how
// far each sits from what came before it. A chart asking for n series takes the first n, so a
// two-series chart gets the complement and a six-series chart is still adding genuinely separated
// hues rather than repeating one. Base + these 8 + the 6 monochromatic shades is the section's
// whole palette: 15 colours, which is what `palette()` returns.
const PALETTE_HUE_ORDER = [180, -120, 120, -150, 150, -60, -30, 30] as const;

// colorhexa's monochromatic strip is the base plus three steps of 5% lightness either side.
// Stored as offsets rather than absolute lightnesses because the base lightness itself depends
// on whether the scheme is vivid and whether the sky is dark.
const MONO_OFFSETS = [-0.15, -0.1, -0.05, 0.05, 0.1, 0.15] as const;

const schemeCache = new Map<string, Schemes>();

// A section's whole palette, generated from its own sky: every classical harmony at once.
// `anchor` re-seeds the hue from an explicit colour — that is how each proxy's charts are
// drawn in that proxy's own colour rather than the section's.
export function schemes(sky: Rgb, vivid = false, anchor?: string): Schemes {
  const key = sky.join(",") + "|" + (anchor ?? "sky") + "|" + (vivid ? "v" : "");
  const hit = schemeCache.get(key);
  if (hit) return hit;

  const src = anchor ? (parseColor(anchor)?.rgb ?? sky) : sky;
  const [hue, sat0] = rgbToHsl(src);
  // Note this threshold is 0.28, not skinFromSky's 0.2 — a mid-dark sky still wants the
  // lighter, upward lightness ramp even while its skin is still the light-sky variant.
  const dark = relativeLuminance(sky) < 0.28;
  const sat = vivid ? 0.94 : Math.min(0.82, Math.max(0.4, sat0 + 0.2));
  const lightness = vivid ? 0.5 : dark ? 0.62 : 0.46;
  // Classical harmonies are pure hue rotations at one saturation and one lightness — that is
  // what makes a scheme read as a scheme. Every member of every scheme below is therefore the
  // same colour turned around the wheel, matching colorhexa's definitions exactly (see
  // HUE_OFFSETS). An earlier version dropped a lightness step on every third member so that
  // same-hue neighbours in a long ramp would separate; that was a workaround for an analogous
  // scheme five members wide, and with the schemes at their classical widths it is no longer
  // needed. It is gone, because it meant one hue offset did not map to one colour.
  const at = (ds: readonly number[]) => ds.map((d) => hslToCss(hue + d, sat, lightness));

  const out: Schemes = {
    hue,
    sat,
    dark,
    base: hslToCss(hue, sat, lightness),
    complementary: at(HUE_OFFSETS.complementary),
    splitComplementary: at(HUE_OFFSETS.splitComplementary),
    triadic: at(HUE_OFFSETS.triadic),
    tetradic: at(HUE_OFFSETS.tetradic),
    analogous: at(HUE_OFFSETS.analogous),
    // 3 darker, the base, then 3 lighter when asked for the canonical seven; for any other n,
    // an evenly spaced ramp through the same range so a chart with more series than hues still
    // gets one shade each.
    mono: (n: number) =>
      Array.from({ length: n }, (_, i) =>
        hslToCss(
          hue,
          sat,
          dark ? 0.34 + (0.5 * i) / Math.max(1, n - 1) : 0.72 - (0.5 * i) / Math.max(1, n - 1),
        ),
      ),
    palette: () => [
      hslToCss(hue, sat, lightness),
      ...PALETTE_HUE_ORDER.map((d) => hslToCss(hue + d, sat, lightness)),
      ...MONO_OFFSETS.map((d) => hslToCss(hue, sat, clamp01(lightness + d))),
    ],
  };
  schemeCache.set(key, out);
  return out;
}

// n series -> the scheme that fits. Up to four, the classical scheme of that width. At five and
// six, the section's ordered palette, which is those schemes deduplicated (PALETTE_HUE_ORDER), so
// a six-series chart is still adding separated hues — the old rule padded `analogous` with the
// complement and, now that analogous is three wide rather than five, would have run short.
//
// Past six, shades of one hue: more hues stop being separable, and the one caller at seven is
// `--amplitude-ramp-*`, a sequential choropleth scale that has to be monochromatic. Do not raise
// this cutoff to the palette's full nine hues without giving that ramp its own accessor.
export function harmony(n: number, sky: Rgb, vivid = false, anchor?: string): string[] {
  const s = schemes(sky, vivid, anchor);
  if (n <= 1) return [s.base];
  if (n === 2) return s.complementary;
  if (n === 3) return s.splitComplementary;
  if (n === 4) return s.tetradic;
  if (n <= 6) return s.palette().slice(0, n);
  return s.mono(n);
}

// The five seasonality proxies, keyed to identity (their data-proxy index) so reordering the
// stack never repaints a card. Fixed values, not derived from the sky: these used to be
// `schemes(sky, true).analogous`, which meant the five hues slid as the story's sky
// cross-faded, and a reader could not carry "the strip I ranked first" down into the chart that
// scores it.
//
// They were captured from that expression at the seasonality sky (`#bcd8ee`), the section the
// proxy card lives in, so nothing changed where the reader meets them. Nothing regenerates them
// now: that analogous scheme was five wide (0, ±30, ±60) with a lightness drop on its third
// member, and the scheme was narrowed to its classical three on 2026-08-21, so no current
// `schemes()` call reproduces this array. That is the point of holding it as literals — but it
// does mean these five are no longer a harmony of anything, and a future palette rework has to
// decide what they should be rather than assuming the generator still knows.
//
// One constraint if they are ever re-picked: `ProxyStrip` paints white ink on every fill, and a
// narrow hue band is what keeps the five near one perceived lightness. Widening the separation
// makes the white ink fail — measured, p2 and p4 are already at 1.61 and 1.44 against white.
const PROXY_COLORS: readonly string[] = [
  "rgb(8,142,247)",
  "rgb(8,22,247)",
  "rgb(7,228,214)",
  "rgb(113,8,247)",
  "rgb(8,247,113)",
];

export function proxyColors(): string[] {
  return [...PROXY_COLORS];
}

export function proxyHarmony(idx: number, n: number, sky: Rgb): string[] {
  const anchor = PROXY_COLORS[idx % 5];
  return harmony(n, sky, true, anchor);
}

// What every proxy chart actually draws with: that proxy's own harmony, then the 3:1
// legibility pass, because the figures are transparent and composite over the sky. The anchor is
// fixed but this correction must stay dynamic — the marks composite over whatever sky is up, so
// freezing them too would make some proxy charts illegible on some sections. Fixed identity,
// corrected legibility: do not "finish the job" by hardcoding these as well.
export function proxyMarks(idx: number, n: number, sky: Rgb): string[] {
  return marks(proxyHarmony(idx, n, sky), sky);
}

// --- legibility ----------------------------------------------------------------------

export function contrastRatio(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// Chart canvases are transparent, so marks composite over the sky itself. Step lightness
// away from the sky until the ratio clears `min`. Large solid fills skip this — they are
// already legible and their saturation is the point.
//
// Deviation from the prototype: it hardcodes `bgL > 0.4 ? darker : lighter`, which picks a
// direction that cannot reach 3:1 for two of our ten skies. Against a backdrop of luminance
// B, pure white yields 1.05/(B+0.05) and pure black yields (B+0.05)/0.05, so for 3:1 white
// only works below B=0.30 and black only above B=0.10. The prototype's 0.4 threshold sends
// mid-tone skies (#e8956d at 0.398, #cf7a68 at 0.282) toward white, where the ceiling is
// ~2.1:1. We try both directions and keep the smaller move that clears the target.
export function contrastFix(col: string, bg: Rgb, min = 3): string {
  const parsed = parseColor(col);
  if (!parsed) return col;
  const bgL = relativeLuminance(bg);
  const [hue, sat, l0] = rgbToHsl(parsed.rgb);

  const walk = (step: number): { css: string; moved: number; ratio: number } => {
    let l = l0;
    let last = hslToCss(hue, sat, l);
    for (let i = 0; i < 32; i++) {
      const candidate = parseColor(last);
      const ratio = candidate ? contrastRatio(relativeLuminance(candidate.rgb), bgL) : 0;
      if (ratio >= min) return { css: last, moved: Math.abs(l - l0), ratio };
      l += step;
      if (l <= 0.02 || l >= 0.98) break;
      last = hslToCss(hue, sat, l);
    }
    const clamped = Math.max(0.02, Math.min(0.98, l));
    const css = hslToCss(hue, sat, clamped);
    const end = parseColor(css);
    return {
      css,
      moved: Math.abs(clamped - l0),
      ratio: end ? contrastRatio(relativeLuminance(end.rgb), bgL) : 0,
    };
  };

  const down = walk(-0.03);
  const up = walk(0.03);
  const downOk = down.ratio >= min;
  const upOk = up.ratio >= min;
  if (downOk && upOk) return down.moved <= up.moved ? down.css : up.css;
  if (downOk) return down.css;
  if (upOk) return up.css;
  // Neither direction clears it (a mark colour with almost no lightness headroom either
  // way) — take whichever got furthest rather than silently returning the original.
  return down.ratio >= up.ratio ? down.css : up.css;
}

const marksCache = new Map<string, string[]>();

export function marks(cols: string[], sky: Rgb): string[] {
  const key = cols.join("|") + "@" + sky.join(",");
  const hit = marksCache.get(key);
  if (hit) return hit;
  const out = cols.map((c) => contrastFix(c, sky, 3));
  marksCache.set(key, out);
  return out;
}

// --- CSS custom properties -----------------------------------------------------------

// The handoff drives figures through a canvas context proxy that rewrites every fillStyle.
// We take the alternative it offers instead (README "Port note"): resolve the skin into
// custom properties and let the cascade reach the charts, which are SVG styled by classes
// that roadmap.css already scopes.
//
// These go on the scroll container, not on each section: the prototype themes everything to
// the sky currently in view rather than to each section's own, so a neighbour that is half
// on screen during a transition never clashes with the section being read.
//
// The second block re-points the names roadmap.css already uses across ~120 references, so
// the existing stylesheet follows the palette without being rewritten. --blue and --red are
// the design's fixed accents put through mapColor into the current section's palette.
export function skinToCssVars(sky: Rgb, skin: Skin): Record<string, string> {
  return {
    "--sky": rgbCss(sky),
    "--paper": skin.paper,
    "--ink": skin.ink,
    "--ink-tile": skin.inkTile,
    "--body": skin.body,
    "--mute": skin.mute,
    "--tile": skin.tile,
    "--tile-muted": skin.tileMuted,
    "--tile-open": skin.tileOpen,
    "--rule": skin.rule,
    "--data": rgbCss(skin.dataRGB),
    "--hi": rgbCss(skin.hiRGB),

    "--bg": skin.paper,
    "--fg": skin.ink,
    "--card": skin.tileOpen,
    "--panel": skin.tileOpen,
    "--line": skin.rule,
    "--line-strong": skin.rule,
    "--muted": skin.mute,
    "--body-soft": skin.body,
    "--todo": skin.mute,
    "--blue": mapColor("#2f4bff", skin),
    "--done": mapColor("#2f4bff", skin),
    // The chat sits on its own card, a touch lighter than the section's paper — its own mix
    // rather than a reused token, because the design pitches it between paper and tile.
    "--chat": rgbCss(mixRgb(sky, WHITE, skin.dark ? 0.14 : 0.86)),
    "--chat-ink": skin.dark ? skin.body : "#2b2531",
    // The question keeps its blue almost undiluted — it is the one thing on the page quoting
    // an interface rather than belonging to the section.
    "--chat-bubble": rgbCss(mixRgb(sky, [47, 75, 255], 0.92)),
    "--red": mapColor("#ff3b30", skin),
    "--accent": mapColor("#2f4bff", skin),
  };
}

// Generated chart colours live in the cascade for the same reason as the surface skin above:
// changing sections should update paint, not rebuild every imperative D3 scene in the document.
// The curve pool follows curveColors(..., 14) exactly: six distinct marks cycled across the
// fourteen selectable series.
export function chartPaletteToCssVars(sky: Rgb): Record<string, string> {
  const out: Record<string, string> = {};

  proxyColors().forEach((color, index) => {
    out[`--proxy-color-${index}`] = color;
  });
  for (let proxy = 0; proxy < 5; proxy += 1) {
    proxyMarks(proxy, 4, sky).forEach((color, slot) => {
      out[`--proxy-mark-${proxy}-${slot}`] = color;
    });
  }

  const curvePool = marks(harmony(6, sky), sky);
  for (let index = 0; index < 14; index += 1) {
    out[`--curve-color-${index}`] = curvePool[index % curvePool.length] as string;
  }
  harmony(7, sky).forEach((color, index) => {
    out[`--amplitude-ramp-${index}`] = color;
  });
  marks(harmony(4, sky), sky).forEach((color, index) => {
    out[`--cause-color-${index}`] = color;
  });
  marks(harmony(8, sky, true), sky).forEach((color, index) => {
    out[`--conflict-color-${index}`] = color;
  });

  return out;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
