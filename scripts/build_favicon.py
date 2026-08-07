"""Render the site icon: the real Earth, with one white flash on it.

The globe on the page samples ``public/earth/earth_day_4096.jpg``; so does this, so the icon is
the same planet the reader is about to watch rather than a drawing of one. Each output pixel is
inverse-projected off an orthographic sphere, sampled bilinearly out of that equirectangular
texture, shaded, and composited under a white flash.

Writes, all of which Next's App Router picks up by filename:

    app/favicon.ico      16, 32, 48 — the bare /favicon.ico browsers ask for unprompted
    app/icon.png         512 — the one referenced by <link rel="icon">
    app/apple-icon.png   180 — home-screen bookmarks

Run with ``pnpm run build:favicon``. Pillow is a dev dependency group in pyproject.toml.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent
TEXTURE = ROOT / "public" / "earth" / "earth_day_4096.jpg"
APP = ROOT / "app"

# Where the globe faces. Africa and Europe centred: the most recognisable hemisphere at a size
# where three or four coastlines is all the detail that survives, and the one the story's own
# maps open on.
VIEW_LON = 14.0
VIEW_LAT = 16.0

# Sunlight direction in view space, as a unit-ish vector. Up and slightly left, so the terminator
# falls across the lower right and the disc reads as a sphere instead of a sticker.
LIGHT = (-0.34, -0.46, 0.82)
# How dark the night side gets. Not black: an unlit half that goes to zero looks like a bite out
# of the icon at 16px rather than a planet turning away.
NIGHT_FLOOR = 0.30
# Thin blue atmosphere on the limb, which is most of what separates the disc from a dark tab.
ATMOSPHERE = (150, 195, 255)

# The flash: one death, in white. Over the Congo basin rather than anywhere prettier — it is the
# darkest green on the visible hemisphere, and at 16px contrast against the ground underneath is
# the only thing keeping the flash from dissolving into the Sahara.
FLASH_LON = 20.0
FLASH_LAT = 1.0
FLASH_CORE = 0.048  # solid white, in units of the icon box
FLASH_GLOW = 0.165  # falloff around it

DISC_R = 0.465  # planet radius, in units of the icon box
SUPERSAMPLE = 4
# Below this, a faithful render is a muddy one: sixteen pixels of Earth is mostly the average of
# a coastline, and it needs the push to still read as land against water.
SMALL = 64
SMALL_SATURATION = 1.22
SMALL_CONTRAST = 1.12
# The flash is optically scaled rather than geometrically faithful. A dot that is right at 512px
# is a fifth of a pixel at 16 and disappears; the icon's job at that size is to say "Earth, and
# something happened on it", which needs the mark bigger than the projection would put it.
SMALL_FLASH_BOOST = 1.15

Rgb = tuple[float, float, float]


def _clamp01(v: float) -> float:
    return 0.0 if v < 0.0 else 1.0 if v > 1.0 else v


def _rotation(view_lon: float, view_lat: float):
    """View-space (x right, y down, z toward the viewer) to unit sphere, as three basis rows."""
    lon = math.radians(view_lon)
    lat = math.radians(view_lat)
    # Sphere point for the centre of the disc, and the two tangents that span the view plane.
    forward = (math.cos(lat) * math.sin(lon), math.sin(lat), math.cos(lat) * math.cos(lon))
    right = (math.cos(lon), 0.0, -math.sin(lon))
    up = (
        -math.sin(lat) * math.sin(lon),
        math.cos(lat),
        -math.sin(lat) * math.cos(lon),
    )
    return right, up, forward


def _sphere_to_uv(p: tuple[float, float, float]) -> tuple[float, float]:
    """Unit sphere point to equirectangular texture coordinates in [0, 1]."""
    x, y, z = p
    lon = math.atan2(x, z)
    lat = math.asin(max(-1.0, min(1.0, y)))
    return (lon / (2 * math.pi) + 0.5) % 1.0, 0.5 - lat / math.pi


class Texture:
    """Bilinear sampler over the equirectangular day map, wrapping in longitude."""

    def __init__(self, path: Path, width: int) -> None:
        source = Image.open(path).convert("RGB")
        # Downsampled first: the icon is never larger than 512, and averaging 4096 px of coastline
        # down to that in one Lanczos pass is both faster and cleaner than point-sampling it.
        self.image = source.resize((width, width // 2), Image.LANCZOS)
        self.w, self.h = self.image.size
        self.px = self.image.load()

    def sample(self, u: float, v: float) -> Rgb:
        x = u * self.w - 0.5
        y = _clamp01(v) * self.h - 0.5
        x0 = math.floor(x)
        y0 = max(0, min(self.h - 1, math.floor(y)))
        fx = x - x0
        fy = y - y0
        x0 %= self.w
        x1 = (x0 + 1) % self.w
        y1 = min(self.h - 1, y0 + 1)
        c00 = self.px[x0, y0]
        c10 = self.px[x1, y0]
        c01 = self.px[x0, y1]
        c11 = self.px[x1, y1]
        return tuple(  # type: ignore[return-value]
            (c00[i] * (1 - fx) + c10[i] * fx) * (1 - fy) + (c01[i] * (1 - fx) + c11[i] * fx) * fy
            for i in range(3)
        )


def _flash_offset(right, up, forward) -> tuple[float, float] | None:
    """Where the flash lands on the disc, or None when it is round the back."""
    lon = math.radians(FLASH_LON)
    lat = math.radians(FLASH_LAT)
    p = (math.cos(lat) * math.sin(lon), math.sin(lat), math.cos(lat) * math.cos(lon))
    depth = sum(a * b for a, b in zip(p, forward))
    if depth <= 0.05:
        return None
    return (
        sum(a * b for a, b in zip(p, right)) * DISC_R,
        -sum(a * b for a, b in zip(p, up)) * DISC_R,
    )


def render(size: int, texture: Texture) -> Image.Image:
    right, up, forward = _rotation(VIEW_LON, VIEW_LAT)
    flash = _flash_offset(right, up, forward)
    boost = 1.0 if size >= SMALL else 1.0 + (SMALL - size) / SMALL * SMALL_FLASH_BOOST
    core = FLASH_CORE * boost
    halo_r = FLASH_GLOW * boost
    ss = SUPERSAMPLE
    big = size * ss
    out = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    px = out.load()

    for py in range(big):
        # View-space coordinates of this sample, in units of the icon box, origin at the centre.
        vy = (py + 0.5) / big - 0.5
        for pxi in range(big):
            vx = (pxi + 0.5) / big - 0.5
            dist = math.hypot(vx, vy)
            if dist > DISC_R:
                continue

            # Back-project onto the sphere: x and y are the view plane, z falls out of the radius.
            nx = vx / DISC_R
            ny = -vy / DISC_R
            nz = math.sqrt(max(0.0, 1.0 - nx * nx - ny * ny))
            point = tuple(nx * right[i] + ny * up[i] + nz * forward[i] for i in range(3))
            r, g, b = texture.sample(*_sphere_to_uv(point))  # type: ignore[arg-type]

            # Day/night. The floor keeps the unlit half readable; the gamma softens the terminator
            # so it does not band across four pixels at icon sizes.
            lambert = nx * LIGHT[0] + (-ny) * LIGHT[1] + nz * LIGHT[2]
            shade = NIGHT_FLOOR + (1.0 - NIGHT_FLOOR) * _clamp01(lambert * 1.25 + 0.22) ** 0.75
            r, g, b = r * shade, g * shade, b * shade

            # Atmospheric limb, strongest on the lit edge.
            edge = _clamp01((dist - DISC_R * 0.82) / (DISC_R * 0.18)) ** 2
            glow = edge * (0.35 + 0.5 * _clamp01(lambert + 0.35))
            r = r + (ATMOSPHERE[0] - r) * glow * 0.65
            g = g + (ATMOSPHERE[1] - g) * glow * 0.65
            b = b + (ATMOSPHERE[2] - b) * glow * 0.65

            if flash is not None:
                fd = math.hypot(vx - flash[0], vy - flash[1])
                if fd < halo_r:
                    halo = (1.0 - fd / halo_r) ** 2
                    r = r + (255 - r) * halo * 0.92
                    g = g + (255 - g) * halo * 0.92
                    b = b + (255 - b) * halo * 0.92
                if fd < core:
                    r = g = b = 255.0

            px[pxi, py] = (round(_clamp01(r / 255) * 255), round(_clamp01(g / 255) * 255),
                           round(_clamp01(b / 255) * 255), 255)

    out = out.resize((size, size), Image.LANCZOS)
    if size <= SMALL:
        out = ImageEnhance.Color(out).enhance(SMALL_SATURATION)
        out = ImageEnhance.Contrast(out).enhance(SMALL_CONTRAST)
    return out


def main() -> None:
    if not TEXTURE.exists():
        raise SystemExit(f"missing Earth texture: {TEXTURE}")

    texture = Texture(TEXTURE, 2048)
    sizes = [16, 32, 48, 180, 512]
    rendered = {size: render(size, texture) for size in sizes}

    # Pillow writes a multi-size ICO from one image plus a size list, resampling internally; each
    # size is rendered from the texture instead, so the 16px one is a real 16px render rather than
    # a 512px one squeezed down to mud.
    ico = APP / "favicon.ico"
    rendered[48].save(
        ico,
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=[rendered[16], rendered[32]],
    )
    rendered[512].save(APP / "icon.png", format="PNG", optimize=True)
    rendered[180].save(APP / "apple-icon.png", format="PNG", optimize=True)
    print(f"Wrote {ico.name} (16, 32, 48), icon.png (512) and apple-icon.png (180)")


if __name__ == "__main__":
    main()
