// The UN M49 geoscheme, as the chain of ever-coarser groupings a country belongs to. The weekly
// conflict stack uses it to roll countries too small for their own band up into a region that is
// big enough, rather than dumping them all into one "others" that means nothing geographically.
//
// Keyed on M49 numeric codes throughout, never ISO3: `countryM49()` in ./acled-weekly already
// turns ACLED's country spellings into M49, and going back through alpha-3 would mean a third
// copy of `m49ForIso3` (see lib/spatial-seasonality.ts and lib/fallback-proxy-assignment.ts).
//
// Hand-authored rather than fetched or generated: the geoscheme changes on the order of once a
// decade, it is small enough to read, and a compiled table needs no runtime parse.

// Continental regions — the coarsest grouping, and where every chain terminates.
export const AFRICA = 2;
export const AMERICAS = 19;
export const ASIA = 142;
export const EUROPE = 150;
export const OCEANIA = 9;
export const ANTARCTICA = 10;

// The two intermediary regions M49 defines. Nothing else sits between a subregion and its
// continent, which is why a chain is two or three long and never more.
export const LATIN_AMERICA_AND_THE_CARIBBEAN = 419;
export const SUB_SAHARAN_AFRICA = 202;

export const CONTINENTS: readonly number[] = [AFRICA, AMERICAS, ASIA, EUROPE, OCEANIA, ANTARCTICA];

export const INTERMEDIARY_REGIONS: readonly number[] = [
  LATIN_AMERICA_AND_THE_CARIBBEAN,
  SUB_SAHARAN_AFRICA,
];

// Subregion -> everything above it, coarsest last. Northern Africa and Northern America are the
// two subregions that hang straight off their continent; every other African and American
// subregion passes through an intermediary region first.
const ANCESTORS = new Map<number, readonly number[]>([
  [15, [AFRICA]], // Northern Africa
  [11, [SUB_SAHARAN_AFRICA, AFRICA]], // Western Africa
  [14, [SUB_SAHARAN_AFRICA, AFRICA]], // Eastern Africa
  [17, [SUB_SAHARAN_AFRICA, AFRICA]], // Middle Africa
  [18, [SUB_SAHARAN_AFRICA, AFRICA]], // Southern Africa
  [21, [AMERICAS]], // Northern America
  [29, [LATIN_AMERICA_AND_THE_CARIBBEAN, AMERICAS]], // Caribbean
  [13, [LATIN_AMERICA_AND_THE_CARIBBEAN, AMERICAS]], // Central America
  [5, [LATIN_AMERICA_AND_THE_CARIBBEAN, AMERICAS]], // South America
  [143, [ASIA]], // Central Asia
  [30, [ASIA]], // Eastern Asia
  [34, [ASIA]], // Southern Asia
  [35, [ASIA]], // South-eastern Asia
  [145, [ASIA]], // Western Asia
  [151, [EUROPE]], // Eastern Europe
  [154, [EUROPE]], // Northern Europe
  [39, [EUROPE]], // Southern Europe
  [155, [EUROPE]], // Western Europe
  [53, [OCEANIA]], // Australia and New Zealand
  [54, [OCEANIA]], // Melanesia
  [57, [OCEANIA]], // Micronesia
  [61, [OCEANIA]], // Polynesia
  // Antarctica is its own top-level region in M49, with no subregion between it and the world.
  [ANTARCTICA, []],
]);

export const SUBREGIONS: readonly number[] = [...ANCESTORS.keys()];

// Countries and areas by subregion, in M49's own order. Inverted below rather than written out
// country-first: this way the table is proofread against the UN's own listing one block at a time.
const COUNTRIES_BY_SUBREGION: Record<number, readonly number[]> = {
  // Northern Africa. Sudan sits here in M49, not in Sub-Saharan Africa, despite the grouping
  // most mortality sources put it in.
  15: [12, 434, 504, 729, 788, 732, 818],
  11: [132, 204, 270, 288, 324, 384, 430, 466, 478, 562, 566, 624, 654, 686, 694, 768, 854],
  14: [
    86, 108, 174, 175, 231, 232, 260, 262, 404, 450, 454, 480, 508, 638, 646, 690, 706, 716, 728,
    800, 834, 894,
  ],
  17: [24, 120, 140, 148, 178, 180, 226, 266, 678],
  18: [72, 426, 516, 710, 748],
  21: [60, 124, 304, 666, 840],
  29: [
    28, 44, 52, 92, 136, 192, 212, 214, 308, 312, 332, 388, 474, 500, 531, 533, 534, 535, 630, 652,
    659, 660, 662, 663, 670, 780, 796, 850,
  ],
  13: [84, 188, 222, 320, 340, 484, 558, 591],
  5: [32, 68, 74, 76, 152, 170, 218, 238, 239, 254, 328, 600, 604, 740, 858, 862],
  143: [398, 417, 762, 795, 860],
  30: [156, 158, 344, 392, 408, 410, 446, 496],
  34: [4, 50, 64, 144, 356, 364, 462, 524, 586],
  35: [96, 104, 116, 360, 418, 458, 608, 626, 702, 704, 764],
  145: [31, 48, 51, 196, 268, 275, 368, 376, 400, 414, 422, 512, 634, 682, 760, 784, 792, 887],
  151: [100, 112, 203, 348, 498, 616, 642, 643, 703, 804],
  154: [208, 233, 234, 246, 248, 352, 372, 428, 440, 578, 744, 752, 826, 831, 832, 833],
  // Southern Europe carries one code M49 does not define: 983, which is i18n-iso-countries'
  // user-assigned numeric for Kosovo (XKK). M49 has no entry for Kosovo, but ACLED reports it as
  // a country and lib/acled-weekly aliases it, so without this line those deaths would fall out
  // of Europe and into the residual band with no way to tell from the output that they had.
  39: [8, 20, 70, 191, 292, 300, 336, 380, 470, 499, 620, 674, 688, 705, 724, 807, 983],
  155: [40, 56, 250, 276, 438, 442, 492, 528, 756],
  53: [36, 162, 166, 334, 554, 574],
  54: [90, 242, 540, 548, 598],
  57: [296, 316, 520, 580, 581, 583, 584, 585],
  61: [16, 184, 258, 570, 612, 772, 776, 798, 882, 876],
  // Antarctica is both the country code and the region code.
  [ANTARCTICA]: [ANTARCTICA],
};

const SUBREGION_OF = new Map<number, number>(
  Object.entries(COUNTRIES_BY_SUBREGION).flatMap(([subregion, codes]) =>
    codes.map((code) => [code, Number(subregion)] as [number, number]),
  ),
);

// A country's groupings, finest first: [subregion, intermediary?, continent]. `null` for a code
// with no place in the geoscheme — ACLED's "Pacific Ocean" and friends resolve to no M49 at all,
// and a caller with an unknown code should send it to the residual band rather than guess.
export function geoschemeChain(m49: number): readonly number[] | null {
  const subregion = SUBREGION_OF.get(m49);
  if (subregion === undefined) return null;
  const ancestors = ANCESTORS.get(subregion);
  if (ancestors === undefined) return null;
  return [subregion, ...ancestors];
}
