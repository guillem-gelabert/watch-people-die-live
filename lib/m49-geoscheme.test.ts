import isoCountries from "i18n-iso-countries";
import { describe, expect, it } from "vitest";
import {
  CONTINENTS,
  INTERMEDIARY_REGIONS,
  LATIN_AMERICA_AND_THE_CARIBBEAN,
  SUB_SAHARAN_AFRICA,
  SUBREGIONS,
  geoschemeChain,
} from "./m49-geoscheme";

// Every M49 code countryM49() can return, which is every ISO 3166-1 numeric i18n-iso-countries
// knows. The table has to cover all of them: a code with no chain is a country that silently
// falls out of its region and into the stack's residual band, which looks like working software.
function everyIsoM49(): Array<{ alpha3: string; name: string; m49: number }> {
  return Object.entries(isoCountries.getNames("en"))
    .map(([alpha2, name]) => {
      const alpha3 = isoCountries.alpha2ToAlpha3(alpha2);
      const m49 = alpha3 ? Number(isoCountries.alpha3ToNumeric(alpha3)) : Number.NaN;
      return { alpha3: alpha3 ?? "", name, m49 };
    })
    .filter((entry) => entry.alpha3 !== "" && Number.isInteger(entry.m49) && entry.m49 > 0);
}

describe("UN M49 geoscheme", () => {
  it("gives every ISO country a chain that ends at a continent", () => {
    const orphans = everyIsoM49()
      .filter((entry) => geoschemeChain(entry.m49) === null)
      .map((entry) => `${entry.m49} ${entry.alpha3} ${entry.name}`);
    expect(orphans).toEqual([]);

    for (const { m49, alpha3 } of everyIsoM49()) {
      const chain = geoschemeChain(m49)!;
      expect(CONTINENTS, `${alpha3} ends outside a continent`).toContain(chain.at(-1));
      expect(SUBREGIONS, `${alpha3} starts outside a subregion`).toContain(chain[0]);
    }
  });

  it("coarsens strictly, and only through the two intermediary regions M49 defines", () => {
    for (const { m49, alpha3 } of everyIsoM49()) {
      const chain = geoschemeChain(m49)!;
      // Antarctica is its own top-level region, so its chain is one link long. Everything else
      // is subregion -> continent, or subregion -> intermediary -> continent.
      expect(chain.length, `${alpha3} chain ${chain.join(">")}`).toBeLessThanOrEqual(3);
      expect(new Set(chain).size, `${alpha3} repeats a code`).toBe(chain.length);
      if (chain.length === 3) {
        expect(INTERMEDIARY_REGIONS, `${alpha3} has an unexpected middle link`).toContain(chain[1]);
      }
    }
  });

  it("places the countries the two intermediary regions exist for", () => {
    const chainOf = (alpha3: string) =>
      geoschemeChain(Number(isoCountries.alpha3ToNumeric(alpha3)));
    // 013 Central America, 419 LAC, 019 Americas.
    expect(chainOf("MEX")).toEqual([13, LATIN_AMERICA_AND_THE_CARIBBEAN, 19]);
    // 029 Caribbean under the same intermediary.
    expect(chainOf("HTI")).toEqual([29, LATIN_AMERICA_AND_THE_CARIBBEAN, 19]);
    // 014 Eastern Africa, 202 Sub-Saharan Africa, 002 Africa.
    expect(chainOf("ETH")).toEqual([14, SUB_SAHARAN_AFRICA, 2]);
    // Northern America and Northern Africa hang straight off their continent — no intermediary.
    expect(chainOf("USA")).toEqual([21, 19]);
    // M49 files Sudan under Northern Africa, not Sub-Saharan Africa, however other mortality
    // sources group it. Asserted because it is the one placement most likely to be "corrected".
    expect(chainOf("SDN")).toEqual([15, 2]);
    expect(chainOf("IND")).toEqual([34, 142]);
  });

  it("has no chain for a code outside the scheme", () => {
    expect(geoschemeChain(999)).toBeNull();
    expect(geoschemeChain(0)).toBeNull();
  });
});
