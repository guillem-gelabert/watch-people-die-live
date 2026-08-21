import { describe, expect, it } from "vitest";
import {
  chartPaletteToCssVars,
  contrastFix,
  contrastRatio,
  harmony,
  mapColor,
  marks,
  parseColor,
  parseSky,
  proxyMarks,
  proxyColors,
  relativeLuminance,
  rgbToHsl,
  schemes,
  skinFromSky,
  skinToCssVars,
  type Rgb,
} from "./palette";
import { curveColors } from "./chartHelpers";

// The ten section skies, in scroll order (design handoff README, "Sections").
const SKIES = [
  "#2b1c3a", // First light
  "#e8956d", // Where — global rate
  "#f6c58f", // Where — country rate
  "#e7e9e4", // Where — CDR by region
  "#a6d2f5", // Where — region
  "#bcd8ee", // When — seasonality
  "#d9dbdd", // Who
  "#eeb87d", // Conflicts
  "#cf7a68", // Still missing
  "#000000", // Back to the globe
] as const;

const lumOf = (css: string): number => {
  const p = parseColor(css);
  if (!p) throw new Error("unparseable colour: " + css);
  return relativeLuminance(p.rgb);
};

describe("parseColor", () => {
  it("reads the notations the figures actually use", () => {
    expect(parseColor("#abc")).toEqual({ rgb: [170, 187, 204], a: 1 });
    expect(parseColor("#2f4bff")).toEqual({ rgb: [47, 75, 255], a: 1 });
    expect(parseColor("rgb(1,2,3)")).toEqual({ rgb: [1, 2, 3], a: 1 });
    expect(parseColor("rgba(1, 2, 3, 0.4)")).toEqual({ rgb: [1, 2, 3], a: 0.4 });
    expect(parseColor("rgb(1 2 3 / 50%)")).toEqual({ rgb: [1, 2, 3], a: 0.5 });
  });

  it("returns null rather than guessing", () => {
    expect(parseColor("hotpink")).toBeNull();
    expect(parseColor("#zzz")).toBeNull();
    expect(parseColor("")).toBeNull();
  });
});

describe("skinFromSky", () => {
  it("flips to the dark variant below 0.2 relative luminance", () => {
    expect(skinFromSky(parseSky("#2b1c3a")).dark).toBe(true);
    expect(skinFromSky(parseSky("#000000")).dark).toBe(true);
    expect(skinFromSky(parseSky("#cf7a68")).dark).toBe(false);
    expect(skinFromSky(parseSky("#e8956d")).dark).toBe(false);
  });

  it("lifts paper away from a dark sky and drops it toward white on a light one", () => {
    const darkSky = parseSky("#2b1c3a");
    const dark = skinFromSky(darkSky);
    expect(relativeLuminance(dark.paperRGB)).toBeGreaterThan(relativeLuminance(darkSky));
    expect(dark.ink).toBe("#ffffff");

    const lightSky = parseSky("#bcd8ee");
    const light = skinFromSky(lightSky);
    expect(relativeLuminance(light.paperRGB)).toBeGreaterThan(relativeLuminance(lightSky));
    expect(light.ink).toBe("#1d1822");
  });

  it("keeps body and secondary text readable directly on the sky", () => {
    // Prose sits on the sky itself, not on paper, so both tones owe it 4.5:1.
    for (const hex of SKIES) {
      const sky = parseSky(hex);
      const skin = skinFromSky(sky);
      const skyL = relativeLuminance(sky);
      expect(contrastRatio(lumOf(skin.body), skyL), `body on ${hex}`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(lumOf(skin.mute), skyL), `mute on ${hex}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("orders the tile tones from muted through open", () => {
    const skin = skinFromSky(parseSky("#bcd8ee"));
    expect(lumOf(skin.tileMuted)).toBeLessThan(lumOf(skin.tile));
    expect(lumOf(skin.tile)).toBeLessThan(lumOf(skin.tileOpen));
  });

  it("keeps inkTile a guaranteed-dark well on dark skies and equal to ink on light ones", () => {
    for (const hex of ["#2b1c3a", "#000000"]) {
      const skin = skinFromSky(parseSky(hex));
      expect(lumOf(skin.inkTile), `inkTile on ${hex}`).toBeLessThan(lumOf(skin.paper));
    }

    const light = skinFromSky(parseSky("#bcd8ee"));
    expect(light.inkTile).toBe(light.ink);
  });
});

describe("skinToCssVars", () => {
  it("publishes inkTile as --ink-tile", () => {
    const sky = parseSky("#2b1c3a");
    const skin = skinFromSky(sky);
    expect(skinToCssVars(sky, skin)["--ink-tile"]).toBe(skin.inkTile);
  });
});

describe("schemes", () => {
  it("returns the right number of hues per harmony", () => {
    const sky = parseSky("#bcd8ee");
    const s = schemes(sky);
    expect(s.complementary).toHaveLength(2);
    expect(s.splitComplementary).toHaveLength(3);
    expect(s.triadic).toHaveLength(3);
    expect(s.tetradic).toHaveLength(4);
    expect(s.analogous).toHaveLength(3);
    expect(s.mono(7)).toHaveLength(7);
  });

  it("is fifteen distinct colours per sky: base, eight hues, six shades", () => {
    for (const hex of SKIES) {
      const pal = schemes(parseSky(hex)).palette();
      expect(pal, hex).toHaveLength(15);
      expect(new Set(pal).size, `${hex} has a duplicate`).toBe(15);
    }
  });

  // Pins the colour model to an external reference rather than to itself. These are the hues
  // colorhexa.com/bcd8ee publishes for each scheme; the base is 206°. If a rotation is ever
  // changed by accident, this fails with the offending hue rather than with a colour nobody can
  // reason about. Rounding tolerance is 1°, since the trip through RGB is lossy.
  it("matches colorhexa's scheme definitions", () => {
    const s = schemes(parseSky("#bcd8ee"));
    const hues = (cols: string[]) =>
      cols.map((c) => {
        const parsed = parseColor(c);
        if (!parsed) throw new Error("unparseable: " + c);
        return Math.round(rgbToHsl(parsed.rgb)[0]);
      });
    const near = (got: number[], want: number[]) => {
      expect(got).toHaveLength(want.length);
      got.forEach((g, i) => expect(Math.abs(g - (want[i] as number))).toBeLessThanOrEqual(1));
    };
    near(hues(s.complementary), [206, 26]);
    near(hues(s.analogous), [176, 206, 236]);
    near(hues(s.splitComplementary), [56, 206, 356]);
    near(hues(s.triadic), [86, 206, 326]);
    near(hues(s.tetradic), [146, 206, 326, 26]);
  });

  it("rotates hue only — one saturation and one lightness across every scheme", () => {
    // The schemes read as schemes because nothing but hue moves. An earlier version dropped a
    // lightness step on every third member, which meant one hue offset did not map to one colour.
    const s = schemes(parseSky("#bcd8ee"), true);
    const ls = [
      ...s.complementary,
      ...s.analogous,
      ...s.splitComplementary,
      ...s.triadic,
      ...s.tetradic,
    ].map((c) => {
      const parsed = parseColor(c);
      if (!parsed) throw new Error("unparseable: " + c);
      return Math.round(rgbToHsl(parsed.rgb)[2] * 100);
    });
    expect(new Set(ls).size, `lightnesses seen: ${[...new Set(ls)].join(",")}`).toBe(1);
  });

  it("anchors on an explicit colour when given one", () => {
    const sky = parseSky("#bcd8ee");
    expect(schemes(sky, true, "#ff3b30").hue).not.toBeCloseTo(schemes(sky, true).hue, 1);
  });
});

describe("harmony", () => {
  it("picks a scheme by series count and falls back to shades past six", () => {
    const sky = parseSky("#e8956d");
    expect(harmony(1, sky)).toHaveLength(1);
    expect(harmony(2, sky)).toEqual(schemes(sky).complementary);
    expect(harmony(3, sky)).toEqual(schemes(sky).splitComplementary);
    expect(harmony(4, sky)).toEqual(schemes(sky).tetradic);
    expect(harmony(6, sky)).toHaveLength(6);
    expect(harmony(9, sky)).toEqual(schemes(sky).mono(9));
  });
});

describe("contrastFix", () => {
  // Regression guard. The prototype hardcodes `bgL > 0.4 ? darker : lighter`, which sends
  // mid-tone skies toward white where the ceiling is ~2.1:1. #e8956d (L 0.398) and #cf7a68
  // (L 0.282) both failed the design's own 3:1 rule before the direction fix.
  it("reaches 3:1 for every analogous mark on every section sky", () => {
    for (const hex of SKIES) {
      const sky = parseSky(hex);
      const skyL = relativeLuminance(sky);
      for (const col of schemes(sky, true).analogous) {
        const fixed = contrastFix(col, sky, 3);
        expect(contrastRatio(lumOf(fixed), skyL), `${col} on ${hex}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("clears the target on the two skies the prototype's heuristic could not", () => {
    for (const hex of ["#e8956d", "#cf7a68"]) {
      const sky = parseSky(hex);
      const skyL = relativeLuminance(sky);
      const fixed = contrastFix("rgb(8,142,247)", sky, 3);
      expect(contrastRatio(lumOf(fixed), skyL), hex).toBeGreaterThanOrEqual(3);
    }
  });

  it("leaves a colour that already clears the bar close to where it started", () => {
    const sky: Rgb = [255, 255, 255];
    const before = lumOf("rgb(20,20,20)");
    const after = lumOf(contrastFix("rgb(20,20,20)", sky, 3));
    expect(Math.abs(after - before)).toBeLessThan(0.02);
  });

  it("passes unparseable colours through untouched", () => {
    expect(contrastFix("currentColor", parseSky("#bcd8ee"))).toBe("currentColor");
  });
});

describe("marks", () => {
  it("returns one legible colour per input, in order", () => {
    const sky = parseSky("#a6d2f5");
    const cols = schemes(sky, true).tetradic;
    const out = marks(cols, sky);
    expect(out).toHaveLength(cols.length);
    for (const c of out) {
      expect(contrastRatio(lumOf(c), relativeLuminance(sky))).toBeGreaterThanOrEqual(3);
    }
  });

  it("is stable across calls so repeated repaints do not drift", () => {
    const sky = parseSky("#eeb87d");
    const cols = schemes(sky, true).triadic;
    expect(marks(cols, sky)).toEqual(marks(cols, sky));
  });
});

describe("proxyColors", () => {
  // The regression this guards: these five used to be schemes(sky, true).analogous, so the proxy
  // strips slid hue as the story's sky cross-faded and no proxy had an identity a reader could
  // carry into the chart that scores it.
  it("returns the five frozen identity colours", () => {
    expect(proxyColors()).toEqual([
      "rgb(8,142,247)",
      "rgb(8,22,247)",
      "rgb(7,228,214)",
      "rgb(113,8,247)",
      "rgb(8,247,113)",
    ]);
  });

  it("no longer tracks any section sky", () => {
    // These five were generated from the pre-2026-08-21 analogous scheme, which was five wide
    // (0, ±30, ±60) with a lightness drop on its third member. That scheme no longer exists, so
    // no sky's palette reproduces them any more — which is the point of holding them as literals.
    for (const hex of SKIES) {
      expect(proxyColors(), hex).not.toEqual(schemes(parseSky(hex), true).analogous);
      expect(proxyColors(), hex).not.toEqual(schemes(parseSky(hex), true).palette().slice(0, 5));
    }
  });

  it("hands out a copy, so a caller cannot mutate the identities", () => {
    const first = proxyColors();
    first[0] = "rgb(0,0,0)";
    expect(proxyColors()[0]).toBe("rgb(8,142,247)");
  });
});

describe("proxyMarks", () => {
  // Every proxy chart draws in its own proxy's colour, anchored away from the section hue.
  // Those anchors are vivid by construction, so they are exactly the colours most likely to
  // miss 3:1 — check all five against all ten skies rather than trusting contrastFix.
  it("keeps every proxy's series legible on every section sky", () => {
    for (const hex of SKIES) {
      const sky = parseSky(hex);
      const skyL = relativeLuminance(sky);
      for (let idx = 0; idx < 5; idx += 1) {
        for (const n of [2, 3, 4]) {
          for (const col of proxyMarks(idx, n, sky)) {
            expect(
              contrastRatio(lumOf(col), skyL),
              `proxy ${idx} n=${n} on ${hex}: ${col}`,
            ).toBeGreaterThanOrEqual(3);
          }
        }
      }
    }
  });

  it("gives the five proxies five distinct identities on one sky", () => {
    const sky = parseSky("#bcd8ee");
    const firsts = [0, 1, 2, 3, 4].map((i) => proxyMarks(i, 2, sky)[0]);
    expect(new Set(firsts).size).toBe(5);
  });

  it("keys colour to the proxy index, not to call order", () => {
    const sky = parseSky("#bcd8ee");
    expect(proxyMarks(3, 2, sky)).toEqual(proxyMarks(3, 2, sky));
    expect(proxyMarks(3, 2, sky)).not.toEqual(proxyMarks(1, 2, sky));
  });

  // The other half of the freeze: identity is fixed, legibility is not. The figures are
  // transparent and composite over the sky, so hardcoding these too would strand some proxy
  // charts under 3:1 on some sections.
  it("still corrects for the sky even though the anchor is frozen", () => {
    const light = proxyMarks(0, 4, parseSky("#e7e9e4"));
    const dark = proxyMarks(0, 4, parseSky("#2b1c3a"));
    expect(light).not.toEqual(dark);
  });
});

describe("chartPaletteToCssVars", () => {
  it("publishes the existing generated palettes into stable CSS-variable slots", () => {
    for (const hex of SKIES) {
      const sky = parseSky(hex);
      const vars = chartPaletteToCssVars(sky);

      proxyColors().forEach((color, index) => {
        expect(vars[`--proxy-color-${index}`]).toBe(color);
      });
      for (let proxy = 0; proxy < 5; proxy += 1) {
        proxyMarks(proxy, 4, sky).forEach((color, slot) => {
          expect(vars[`--proxy-mark-${proxy}-${slot}`]).toBe(color);
        });
      }
      curveColors(sky, 14).forEach((color, index) => {
        expect(vars[`--curve-color-${index}`]).toBe(color);
      });
      harmony(7, sky).forEach((color, index) => {
        expect(vars[`--amplitude-ramp-${index}`]).toBe(color);
      });
      marks(harmony(4, sky), sky).forEach((color, index) => {
        expect(vars[`--cause-color-${index}`]).toBe(color);
      });
      marks(harmony(8, sky, true), sky).forEach((color, index) => {
        expect(vars[`--conflict-color-${index}`]).toBe(color);
      });
    }
  });
});

describe("mapColor", () => {
  const skin = skinFromSky(parseSky("#bcd8ee"));

  it("maps greys onto the paper-to-ink axis, keeping ramps monotonic", () => {
    const light = lumOf(mapColor("#cccccc", skin));
    const mid = lumOf(mapColor("#888888", skin));
    const darkGrey = lumOf(mapColor("#333333", skin));
    expect(light).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(darkGrey);
  });

  it("sends the warm family to the sky's complement and the blue family to its own tone", () => {
    const warm = parseColor(mapColor("#ff3b30", skin));
    const blue = parseColor(mapColor("#2f4bff", skin));
    if (!warm || !blue) throw new Error("mapColor returned an unparseable colour");
    // The complement of a light-blue sky is warm, so red stays the warmer of the two.
    expect(warm.rgb[0] - warm.rgb[2]).toBeGreaterThan(blue.rgb[0] - blue.rgb[2]);
  });

  it("preserves alpha", () => {
    expect(mapColor("rgba(255,255,255,0.4)", skin)).toMatch(/,0\.4\)$/);
  });

  it("leaves transparent and unparseable values alone", () => {
    expect(mapColor("transparent", skin)).toBe("transparent");
    expect(mapColor("currentColor", skin)).toBe("currentColor");
    expect(mapColor("", skin)).toBe("");
  });
});
