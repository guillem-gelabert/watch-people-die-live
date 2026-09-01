import { describe, expect, it } from "vitest";
import {
  CONFLICT_CONTINENTS,
  CONFLICT_CONTINENT_SHADES,
  chartPaletteToCssVars,
  contrastFix,
  contrastRatio,
  divergingHarmony,
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
  shadeRamp,
  skinFromSky,
  stackPlate,
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

describe("divergingHarmony", () => {
  // The one ramp in the story whose middle is a value and not just a midpoint. Everything here
  // is about the two arms being equal and opposite: if one is darker or more saturated than the
  // other, the map reads as "more deaths matter more than fewer", which is not the claim.
  it("is odd-length, neutral in the middle, and mirrored either side of it", () => {
    for (const hex of SKIES) {
      const sky = parseSky(hex);
      const ramp = divergingHarmony(9, sky);
      expect(ramp).toHaveLength(9);

      const middle = lumOf(ramp[4]!);
      const light = relativeLuminance(sky) >= 0.28;
      // A light sky's extremes darken outward and a dark sky's lighten outward, so the middle is
      // the extreme of luminance in whichever direction the page is not.
      for (const step of [0, 1, 2, 3, 5, 6, 7, 8]) {
        if (light) expect(lumOf(ramp[step]!)).toBeLessThan(middle);
        else expect(lumOf(ramp[step]!)).toBeGreaterThan(middle);
      }
      // Mirrored: step k out on one arm sits at the same luminance as step k on the other. This
      // is the assertion the whole accessor exists to hold, and it is what a shared HSL lightness
      // could not give — two complementary hues at one lightness came out 0.16 apart, which is a
      // fifth of the ramp's whole range.
      for (let step = 1; step <= 4; step += 1) {
        const low = lumOf(ramp[4 - step]!);
        const high = lumOf(ramp[4 + step]!);
        expect(Math.abs(low - high)).toBeLessThan(0.01);
      }
      // Monotonic away from the middle on both arms.
      for (let step = 1; step <= 4; step += 1) {
        const inner = lumOf(ramp[4 - step + 1]!);
        const outer = lumOf(ramp[4 - step]!);
        if (light) expect(outer).toBeLessThan(inner);
        else expect(outer).toBeGreaterThan(inner);
      }
    }
  });

  it("puts the section's own hue on the low arm and its complement on the high one", () => {
    const sky = parseSky("#bcd8ee");
    const ramp = divergingHarmony(9, sky);
    const hueOf = (css: string) => rgbToHsl(parseColor(css)!.rgb)[0];
    const base = schemes(sky).hue;
    const complement = (base + 180) % 360;
    expect(Math.abs(hueOf(ramp[0]!) - base)).toBeLessThan(6);
    expect(Math.abs(hueOf(ramp[8]!) - complement)).toBeLessThan(6);
  });

  it("still gives three colours at its narrowest, and never repeats the neutral", () => {
    const ramp = divergingHarmony(3, parseSky("#bcd8ee"));
    expect(ramp).toHaveLength(3);
    expect(new Set(ramp).size).toBe(3);
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

  // Pinned deliberately. These five carry white ink (proxy/ProxyStrip's STRIP_INK) and three of
  // them are below the 4.5:1 that the strip's 14.5px body text needs — a known trade-off, taken on
  // 2026-08-23 in favour of the design's uniform white over either darkening the fills or flipping
  // three rows to dark ink. Both alternatives are measured in the PROXY_COLORS comment.
  //
  // This test exists so the number cannot drift quietly: change a fill and it fails, forcing
  // whoever does it to look at what they did to the contrast rather than discovering it later.
  it("has the contrast against white that the recorded decision accepted", () => {
    const WHITE = relativeLuminance(parseSky("#ffffff"));
    const expected = [3.37, 8.51, 1.61, 6.82, 1.44];
    proxyColors().forEach((col, i) => {
      const ratio = contrastRatio(lumOf(col), WHITE);
      expect(ratio, `p${i} ${col} vs white`).toBeCloseTo(expected[i] as number, 1);
    });
    // Two of the five are near-invisible under white ink. Asserted, not implied, so nobody reads
    // the block above as hypothetical.
    expect(contrastRatio(lumOf(proxyColors()[2] as string), WHITE)).toBeLessThan(3);
    expect(contrastRatio(lumOf(proxyColors()[4] as string), WHITE)).toBeLessThan(3);
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
      const plate = parseColor(stackPlate(sky))!.rgb;
      expect(vars["--conflict-plate"]).toBe(stackPlate(sky));
      harmony(CONFLICT_CONTINENTS, sky, true).forEach((hue, continent) => {
        shadeRamp(CONFLICT_CONTINENT_SHADES, hue, plate).forEach((color, shade) => {
          expect(vars[`--conflict-continent-${continent}-${shade}`]).toBe(color);
        });
      });
    }
  });
});

describe("shadeRamp", () => {
  const conflictFills = (sky: Rgb) => {
    const vars = chartPaletteToCssVars(sky);
    return Object.entries(vars)
      .filter(([name]) => name.startsWith("--conflict-"))
      .map(([name, value]) => ({ name, lum: relativeLuminance(parseColor(value)!.rgb) }));
  };

  // Against the plate, not the sky: the conflict chart is the one figure that sits on a surface of
  // its own, so the sky is not what its bars are seen against. Getting this wrong is not academic —
  // measured, a plate only 10% off the sky puts every fill under 3:1, and `paper` on the dark sky
  // takes the residual's neutral to 2.26:1. The neutral fails first either way, because it sits
  // closest to the background's own luminance by construction.
  it("keeps every conflict fill clear of the plate it is drawn on", () => {
    for (const hex of SKIES) {
      const sky = parseSky(hex);
      const plateLum = relativeLuminance(parseColor(stackPlate(sky))!.rgb);
      for (const { name, lum } of conflictFills(sky)) {
        if (name === "--conflict-plate") continue;
        expect(contrastRatio(lum, plateLum), `${name} on ${hex}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  // And the plate has to be visible against the sky, or it is not a background. The floor is the
  // "CDR by region" sky, which is already near-white so nothing lighter can separate much from it;
  // the Conflicts sky this chart is read on sits at 1.61.
  it("keeps the plate visible against the sky", () => {
    for (const hex of SKIES) {
      const sky = parseSky(hex);
      const ratio = contrastRatio(
        relativeLuminance(parseColor(stackPlate(sky))!.rgb),
        relativeLuminance(sky),
      );
      expect(ratio, `plate on ${hex}`).toBeGreaterThanOrEqual(1.15);
    }
    expect(
      contrastRatio(
        relativeLuminance(parseColor(stackPlate(parseSky("#eeb87d")))!.rgb),
        relativeLuminance(parseSky("#eeb87d")),
      ),
    ).toBeGreaterThanOrEqual(1.5);
  });

  // The pair the stack's greedy pass spends first is shades 0 and 1, because shadeRamp orders its
  // ramp extremes-first. That pair is what two bands of one continent in the same bar get, so it
  // is the one that has to be separable. Its predecessor — mono() put through marks() — came out
  // at 1.03:1 on the "Who" sky, two fills a reader cannot tell apart.
  //
  // Two thresholds rather than one, because a mid-luminance sky leaves the ramp almost no
  // luminance room at 3:1 and the pair separates mostly by hue there. Measured floors across the
  // ten skies, now that the ramp is placed against the plate rather than the sky: 105.6 in RGB
  // distance and 3.9:1 in contrast on #eeb87d, the Conflicts sky this chart is actually read on. A
  // light plate is what buys that — it leaves the dark band three times the room the sky did.
  const shadePair = (hex: string, continent: number) => {
    const vars = chartPaletteToCssVars(parseSky(hex));
    return [0, 1].map(
      (shade) => parseColor(vars[`--conflict-continent-${continent}-${shade}`]!)!.rgb,
    ) as [Rgb, Rgb];
  };

  it("separates the two shades a co-occurring pair of bands gets, on every sky", () => {
    for (const hex of SKIES) {
      for (let continent = 0; continent < CONFLICT_CONTINENTS; continent += 1) {
        const [a, b] = shadePair(hex, continent);
        const distance = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        expect(distance, `continent ${continent} on ${hex}`).toBeGreaterThanOrEqual(60);
      }
    }
  });

  it("separates that pair by luminance too, on the sky the conflict chart is read on", () => {
    for (let continent = 0; continent < CONFLICT_CONTINENTS; continent += 1) {
      const [a, b] = shadePair("#eeb87d", continent);
      expect(
        contrastRatio(relativeLuminance(a), relativeLuminance(b)),
        `continent ${continent}`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  // The residual's neutral holds the floor of the band and the continents start above it, which is
  // what NEUTRAL_RESERVE is for. Without that reserve a dark grey and a dark brown at one
  // luminance came out 18 apart in RGB, which is not two colours.
  it("keeps the residual's neutral clear of every continent shade", () => {
    for (const hex of SKIES) {
      const vars = chartPaletteToCssVars(parseSky(hex));
      const other = parseColor(vars["--conflict-other"]!)!.rgb;
      for (let continent = 0; continent < CONFLICT_CONTINENTS; continent += 1) {
        for (let shade = 0; shade < CONFLICT_CONTINENT_SHADES; shade += 1) {
          const fill = parseColor(vars[`--conflict-continent-${continent}-${shade}`]!)!.rgb;
          const distance = Math.hypot(other[0] - fill[0], other[1] - fill[1], other[2] - fill[2]);
          expect(
            distance,
            `continent ${continent} shade ${shade} on ${hex}`,
          ).toBeGreaterThanOrEqual(25);
        }
      }
    }
  });

  it("gives no two shades of a continent the same colour", () => {
    for (const hex of SKIES) {
      const sky = parseSky(hex);
      const plate = parseColor(stackPlate(sky))!.rgb;
      for (const hue of harmony(CONFLICT_CONTINENTS, sky, true)) {
        const ramp = shadeRamp(CONFLICT_CONTINENT_SHADES, hue, plate);
        expect(new Set(ramp).size, `${hue} on ${hex}`).toBe(ramp.length);
      }
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
