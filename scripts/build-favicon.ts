// Draws the site's icon — a night-side planet with one flash on it — and writes both forms of
// it: app/icon.svg for anything modern, app/favicon.ico for the bare `/favicon.ico` request
// browsers still make on their own.
//
// The geometry is here rather than in a checked-in binary so the two files cannot drift: the SVG
// and the raster are the same numbers, and regenerating is `pnpm run build:favicon`.
//
// No image dependency. The ICO container is a header plus one bottom-up BGRA bitmap per size,
// which is about forty lines, and pulling in an encoder to avoid them would be the larger cost.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

// Everything below is in units of the icon's own box, so one set of numbers serves every size.
const R = 0.46; // planet radius
const CX = 0.5;
const CY = 0.5;
// Where the light comes from. The lit limb runs along this direction; the rest is night side.
const LIGHT = { x: -0.62, y: -0.78 };
// The flash: one death, on the dark side where it reads. Its glow is what survives 16px.
const FLASH = { x: 0.6, y: 0.38, r: 0.078, glow: 0.2 };

const NIGHT = [11, 14, 38] as const; // #0b0e26 — the story's pre-hero sky, a shade deeper
const DAY = [58, 86, 168] as const; // #3a56a8 — the lit crescent
const LIMB = [150, 183, 255] as const; // #96b7ff — the rim light that separates disc from page
const FLASH_RGB = [255, 122, 74] as const; // #ff7a4a — the same warm accent the globe flashes

type Rgba = [number, number, number, number];

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a: readonly number[], b: readonly number[], t: number) =>
  a.map((v, i) => v + ((b[i] as number) - v) * t);

// Colour of one point inside the unit box, or transparent outside the disc. Antialiasing is done
// by the caller through supersampling, so this is a hard-edged function.
function shade(x: number, y: number): Rgba {
  const dx = x - CX;
  const dy = y - CY;
  const dist = Math.hypot(dx, dy);
  if (dist > R) return [0, 0, 0, 0];

  // How much this point faces the light, as the dot product of the surface normal with the light
  // direction. Treating the disc as a hemisphere is what stops the icon reading as a flat coin.
  const nz = Math.sqrt(Math.max(0, R * R - dist * dist)) / R;
  const nx = dx / R;
  const ny = dy / R;
  const lz = Math.sqrt(Math.max(0, 1 - LIGHT.x * LIGHT.x - LIGHT.y * LIGHT.y));
  const lambert = clamp01(nx * LIGHT.x + ny * LIGHT.y + nz * lz);
  // Biased towards night: this is a planet at dusk, not a lamp.
  let rgb = mix(NIGHT, DAY, clamp01(lambert * 1.35 - 0.15));

  // Rim light on the lit limb. Wider and brighter than a physical terminator would be: on a
  // dark browser tab the disc is nearly the colour of the chrome, and this arc is the only thing
  // that says there is a planet there at all.
  const edge = clamp01((dist - R * 0.78) / (R * 0.22));
  rgb = mix(rgb, LIMB, edge * edge * clamp01(lambert * 1.9 + 0.06));

  // The flash, and the halo that makes it visible once the whole icon is sixteen pixels wide.
  const fd = Math.hypot(x - CX - FLASH.x * R, y - CY - FLASH.y * R);
  if (fd < FLASH.glow) {
    const halo = 1 - fd / FLASH.glow;
    rgb = mix(rgb, FLASH_RGB, halo * halo * 0.75);
  }
  if (fd < FLASH.r) rgb = [...FLASH_RGB];

  return [rgb[0] as number, rgb[1] as number, rgb[2] as number, 255];
}

// One size, supersampled. 4×4 per pixel is enough for a disc and costs nothing at these sizes.
function raster(size: number): Uint8Array {
  const SS = 4;
  const out = new Uint8Array(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const [pr, pg, pb, pa] = shade(
            (px + (sx + 0.5) / SS) / size,
            (py + (sy + 0.5) / SS) / size,
          );
          // Premultiplied, so a transparent sample cannot bleed black into the edge.
          const w = pa / 255;
          r += pr * w;
          g += pg * w;
          b += pb * w;
          a += pa;
        }
      }
      const n = SS * SS;
      const alpha = a / n;
      const scale = alpha > 0 ? 255 / a : 0;
      const i = (py * size + px) * 4;
      out[i] = Math.round(r * scale);
      out[i + 1] = Math.round(g * scale);
      out[i + 2] = Math.round(b * scale);
      out[i + 3] = Math.round(alpha);
    }
  }
  return out;
}

// One ICO image: a BITMAPINFOHEADER, the pixels bottom-up as BGRA, then an empty AND mask (the
// alpha channel already carries the transparency, but the mask is not optional in the format).
function icoImage(size: number, rgba: Uint8Array): Buffer {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0); // biSize
  header.writeInt32LE(size, 4); // biWidth
  header.writeInt32LE(size * 2, 8); // biHeight — XOR bitmap plus AND mask
  header.writeUInt16LE(1, 12); // biPlanes
  header.writeUInt16LE(32, 14); // biBitCount
  const maskStride = Math.ceil(size / 32) * 4;
  const xor = Buffer.alloc(size * size * 4);
  const and = Buffer.alloc(maskStride * size);
  header.writeUInt32LE(xor.length + and.length, 20); // biSizeImage

  for (let y = 0; y < size; y++) {
    const src = (size - 1 - y) * size * 4; // rows run bottom-up
    for (let x = 0; x < size; x++) {
      const s = src + x * 4;
      const d = (y * size + x) * 4;
      xor[d] = rgba[s + 2] as number; // B
      xor[d + 1] = rgba[s + 1] as number; // G
      xor[d + 2] = rgba[s] as number; // R
      xor[d + 3] = rgba[s + 3] as number; // A
    }
  }
  return Buffer.concat([header, xor, and]);
}

function ico(sizes: number[]): Buffer {
  const images = sizes.map((size) => icoImage(size, raster(size)));
  const dir = Buffer.alloc(6 + images.length * 16);
  dir.writeUInt16LE(0, 0);
  dir.writeUInt16LE(1, 2); // 1 = icon
  dir.writeUInt16LE(images.length, 4);
  let offset = dir.length;
  images.forEach((image, i) => {
    const at = 6 + i * 16;
    const size = sizes[i] as number;
    dir.writeUInt8(size >= 256 ? 0 : size, at);
    dir.writeUInt8(size >= 256 ? 0 : size, at + 1);
    dir.writeUInt16LE(1, at + 4); // planes
    dir.writeUInt16LE(32, at + 6); // bits per pixel
    dir.writeUInt32LE(image.length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += image.length;
  });
  return Buffer.concat([dir, ...images]);
}

// The same planet as vector, for browsers that prefer it and for anywhere the icon is shown big.
function svg(): string {
  const pct = (v: number) => (v * 100).toFixed(2);
  const rgb = (c: readonly number[]) => `rgb(${c[0]} ${c[1]} ${c[2]})`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="A planet with one flash on its night side">
  <defs>
    <radialGradient id="face" cx="${pct(CX + (LIGHT.x * R) / 2)}%" cy="${pct(CY + (LIGHT.y * R) / 2)}%" r="78%">
      <stop offset="0%" stop-color="${rgb(DAY)}" />
      <stop offset="62%" stop-color="${rgb(NIGHT)}" />
      <stop offset="100%" stop-color="${rgb(NIGHT)}" />
    </radialGradient>
    <radialGradient id="flash" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${rgb(FLASH_RGB)}" />
      <stop offset="35%" stop-color="${rgb(FLASH_RGB)}" stop-opacity="0.75" />
      <stop offset="100%" stop-color="${rgb(FLASH_RGB)}" stop-opacity="0" />
    </radialGradient>
  </defs>
  <circle cx="32" cy="32" r="${(R * 64).toFixed(2)}" fill="url(#face)" />
  <circle cx="32" cy="32" r="${(R * 64 - 0.7).toFixed(2)}" fill="none" stroke="${rgb(LIMB)}" stroke-opacity="0.85" stroke-width="1.4" stroke-dasharray="34 58" stroke-dashoffset="20" transform="rotate(-142 32 32)" />
  <circle cx="${(32 + FLASH.x * R * 64).toFixed(2)}" cy="${(32 + FLASH.y * R * 64).toFixed(2)}" r="${(FLASH.glow * 64).toFixed(2)}" fill="url(#flash)" />
  <circle cx="${(32 + FLASH.x * R * 64).toFixed(2)}" cy="${(32 + FLASH.y * R * 64).toFixed(2)}" r="${(FLASH.r * 64).toFixed(2)}" fill="${rgb(FLASH_RGB)}" />
</svg>
`;
}

const app = join(process.cwd(), "app");
writeFileSync(join(app, "favicon.ico"), ico([16, 32, 48]));
writeFileSync(join(app, "icon.svg"), svg());
console.info("Wrote app/favicon.ico (16, 32, 48) and app/icon.svg");
