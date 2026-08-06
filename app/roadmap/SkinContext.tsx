"use client";

import { createContext, useContext } from "react";
import { parseSky, skinFromSky, type Rgb, type Skin } from "./palette";

export interface ActiveSkin {
  sky: Rgb;
  skin: Skin;
}

const FALLBACK_SKY = parseSky("#000011");

// Charts drawn imperatively with D3 cannot read the palette off the cascade the way the
// class-styled ones do — a `fill` set from JS needs an actual colour string. They pull it
// from here instead. The value changes about ten times over the whole page (once per sky),
// so re-rendering the subscribed charts on it is cheap.
const SkinContext = createContext<ActiveSkin>({
  sky: FALLBACK_SKY,
  skin: skinFromSky(FALLBACK_SKY),
});

export const SkinProvider = SkinContext.Provider;

export function useSkin(): ActiveSkin {
  return useContext(SkinContext);
}
