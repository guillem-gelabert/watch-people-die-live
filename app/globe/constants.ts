// Shared between Earth.tsx (per-frame simulation) and shaders.ts (TSL ripple loop) —
// N_BLASTS must match the shader's Loop(nBlasts, ...) slot count.
export const N_BLASTS = 16;

export const MS_PER_YEAR_REAL = 365.25 * 24 * 3600 * 1000;
export const FLASH_MS = 2200;
export const SHOCK_MS = 2600;
export const BLAST_MS = Math.max(FLASH_MS, SHOCK_MS);
export const FLASH_R = 0.1;
export const MAX_DOTS = 600;
export const CATCHUP_CAP = BLAST_MS;

export const GLOBE_R = 1;
export const ATMOSPHERE_DAY_COLOR = "#4db2ff";
export const ATMOSPHERE_TWILIGHT_COLOR = "#bc490b";

export const FOV = 45;
export const FIT_MARGIN = 1.5;
export const START_ZOOM = 0.58;
// The fraction of the stage's height the sphere's silhouette covers when the story opens. The
// stage is the full viewport, so this is two thirds of the screen: a whole planet with sky around
// it, sitting high enough that the hero line crosses its lower edge rather than clearing it.
export const HERO_FILL = 0.66;

export const CALIBRATION: [string, number, number, number][] = [
  ["Null Island (0°,0°)", 0, 0, 0xffffff],
  ["London", -0.13, 51.5, 0x00ff00],
  ["New York", -74.0, 40.7, 0xffff00],
  ["Tokyo", 139.7, 35.7, 0x00ffff],
  ["Sydney", 151.2, -33.9, 0xff00ff],
  ["Cape Town", 18.4, -33.9, 0xff8800],
  ["São Paulo", -46.6, -23.5, 0x4488ff],
];
