#!/usr/bin/env python3
"""Derive the header icon variant (DES-MEETUP-ADDENDUM-dashboard AD-18).

Standalone, deterministic, NOT part of the app build. Run once:

    python3 scripts/make-header-icon.py

Input : src/assets/shuttlr-icon.png
Output: src/assets/shuttlr-icon-header.png (same dimensions)

Only pixels classified as plate blue are remapped: hue HUE_MIN..HUE_MAX degrees,
saturation >= SAT_MIN, outside the central medallion disk (radius
MEDALLION_RADIUS_FRAC of the width). Each channel is scaled by
target / measured_plate_mean, so the embossed pattern survives as tonal
variation. Gold, silver, white and the medallion's own blue are untouched.
Requires Pillow only.
"""
import colorsys
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src/assets/shuttlr-icon.png")
DST = os.path.join(ROOT, "src/assets/shuttlr-icon-header.png")

TARGET = (0x1E, 0x5B, 0xD6)  # dash.brand in src/theme/dashboardTheme.ts
HUE_MIN, HUE_MAX = 205.0, 245.0
SAT_MIN = 0.45
MEDALLION_RADIUS_FRAC = 0.29
ALPHA_MIN = 250  # only fully opaque pixels are plate


def classify(im):
    """Return the (x, y) list of plate-blue pixels."""
    w, h = im.size
    px = im.load()
    cx, cy = (w - 1) / 2.0, (h - 1) / 2.0
    r2 = (MEDALLION_RADIUS_FRAC * w) ** 2
    out = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < ALPHA_MIN or (x - cx) ** 2 + (y - cy) ** 2 <= r2:
                continue
            hue, sat, _ = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
            if HUE_MIN <= hue * 360.0 <= HUE_MAX and sat >= SAT_MIN:
                out.append((x, y))
    return out


def mean(im, pts):
    px = im.load()
    n = float(len(pts))
    return tuple(sum(px[p][c] for p in pts) / n for c in range(3))


def main():
    im = Image.open(SRC).convert("RGBA")
    pts = classify(im)
    if not pts:
        sys.exit("no plate pixels found")
    m = mean(im, pts)
    scale = tuple(TARGET[c] / m[c] for c in range(3))
    px = im.load()
    for x, y in pts:
        r, g, b, a = px[x, y]
        px[x, y] = tuple(min(255, int(round(v * scale[c]))) for c, v in enumerate((r, g, b))) + (a,)
    # Fixed save parameters, no metadata: byte-identical on every run.
    im.save(DST, format="PNG", optimize=False, compress_level=9)
    after = mean(im, pts)
    print("plate pixels:", len(pts))
    print("measured plate mean (before): %.2f %.2f %.2f" % m)
    print("scale: %.4f %.4f %.4f" % scale)
    print("plate mean (after):           %.2f %.2f %.2f" % after)
    print("target:", TARGET)


if __name__ == "__main__":
    main()
