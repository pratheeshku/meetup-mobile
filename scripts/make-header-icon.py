#!/usr/bin/env python3
"""Derive the header icon variant (DES-MEETUP-ADDENDUM-dashboard v1.8, AD-18).

Standalone, deterministic, NOT part of the app build. Run once:

    python3 scripts/make-header-icon.py

Input : src/assets/shuttlr-icon.png   (flat blue plate, white shuttlecock, gold band)
Output: src/assets/shuttlr-icon-header.png (same dimensions)

The plate blue P and the gold G are MEASURED from the input (flat pixels only).
Nothing is excluded by region (the icon has no medallion). Per opaque pixel:

  1. Edge blend: if the pixel lies on the line P->W (white) or P->G (gold), i.e.
     blend fraction a in [0, A_MAX] and residual <= RESID_MAX, it is remapped in
     proportion:  out = T + a*(X - T) + residual*(T/P)   (X = W or G).
     With a = 0 this is exactly per-channel scaling by T/P, so tonal variation
     in the flat plate is kept. Pixels with a > A_MAX are white/gold interior and
     stay untouched.
  2. Plate blue (hue HUE_MIN..HUE_MAX deg, saturation >= SAT_MIN) not explained
     by a blend line: scaled per channel by T/P.
  3. Everything else is untouched.

Requires Pillow only. Fixed PNG save parameters => byte-identical output.
"""
import colorsys
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src/assets/shuttlr-icon.png")
DST = os.path.join(ROOT, "src/assets/shuttlr-icon-header.png")

TARGET = (0x1E, 0x5B, 0xD6)  # dash.brand in src/theme/dashboardTheme.ts
WHITE = (255.0, 255.0, 255.0)
HUE_MIN, HUE_MAX = 205.0, 245.0
SAT_MIN = 0.45
GOLD_HUE_MIN, GOLD_HUE_MAX = 30.0, 55.0
GOLD_SAT_MIN, GOLD_VAL_MIN = 0.5, 0.7
FLAT_TOL = 12      # "flat" = within this many levels of the median colour
RESID_MAX = 8.0    # max distance from the blend line to count as a blend
A_MAX = 0.97       # above this the pixel is white/gold interior: untouched
A_MIN = -0.03      # allow tiny negative fits from noise
ALPHA_MIN = 250    # only fully opaque pixels are remapped


def hsv(p):
    h, s, v = colorsys.rgb_to_hsv(p[0] / 255.0, p[1] / 255.0, p[2] / 255.0)
    return h * 360.0, s, v


def is_plate(p):
    h, s, _ = hsv(p)
    return HUE_MIN <= h <= HUE_MAX and s >= SAT_MIN


def is_gold(p):
    h, s, v = hsv(p)
    return GOLD_HUE_MIN <= h <= GOLD_HUE_MAX and s >= GOLD_SAT_MIN and v >= GOLD_VAL_MIN


def median(vals):
    vals = sorted(vals)
    return vals[len(vals) // 2]


def flat_mean(pixels):
    """Mean colour of pixels within FLAT_TOL of the per-channel median."""
    med = tuple(median([p[c] for p in pixels]) for c in range(3))
    flat = [p for p in pixels if all(abs(p[c] - med[c]) <= FLAT_TOL for c in range(3))]
    return tuple(sum(p[c] for p in flat) / float(len(flat)) for c in range(3)), len(flat)


def blend_fit(p, base, other):
    """Project p onto base->other. Return (a, residual vector) or None."""
    d = tuple(other[c] - base[c] for c in range(3))
    dd = sum(v * v for v in d)
    a = sum((p[c] - base[c]) * d[c] for c in range(3)) / dd
    if a < A_MIN or a > 1.03:
        return None
    a = min(1.0, max(0.0, a))
    res = tuple(p[c] - (base[c] + a * d[c]) for c in range(3))
    if max(abs(v) for v in res) > RESID_MAX:
        return None
    return a, res


def clamp(v):
    return min(255, max(0, int(round(v))))


def main():
    im = Image.open(SRC).convert("RGBA")
    w, h = im.size
    px = im.load()
    opaque = [(x, y) for y in range(h) for x in range(w) if px[x, y][3] >= ALPHA_MIN]
    plate_px = [px[q][:3] for q in opaque if is_plate(px[q][:3])]
    gold_px = [px[q][:3] for q in opaque if is_gold(px[q][:3])]
    if not plate_px or not gold_px:
        sys.exit("plate or gold not found")
    P, n_flat = flat_mean(plate_px)
    G, _ = flat_mean(gold_px)
    scale = tuple(TARGET[c] / P[c] for c in range(3))

    counts = {"plate_flat": 0, "blend_white": 0, "blend_gold": 0, "plate_scaled": 0, "untouched": 0}
    for q in opaque:
        p = px[q][:3]
        best = None
        for name, other in (("blend_white", WHITE), ("blend_gold", G)):
            fit = blend_fit(p, P, other)
            if fit and (best is None or max(map(abs, fit[1])) < max(map(abs, best[1][1]))):
                best = (name, fit, other)
        if best is not None:
            name, (a, res), other = best
            if a > A_MAX:
                counts["untouched"] += 1
                continue
            out = tuple(clamp(TARGET[c] + a * (other[c] - TARGET[c]) + res[c] * scale[c]) for c in range(3))
            counts["plate_flat" if a < 0.02 else name] += 1
        elif is_plate(p):
            out = tuple(clamp(p[c] * scale[c]) for c in range(3))
            counts["plate_scaled"] += 1
        else:
            counts["untouched"] += 1
            continue
        px[q] = out + (px[q][3],)

    # Fixed save parameters, no metadata: byte-identical on every run.
    im.save(DST, format="PNG", optimize=False, compress_level=9)

    changed = sum(counts[k] for k in ("plate_flat", "blend_white", "blend_gold", "plate_scaled"))
    print("measured plate mean P (flat, %d px): %.2f %.2f %.2f" % ((n_flat,) + P))
    print("measured gold mean G: %.2f %.2f %.2f" % G)
    print("target:", TARGET, " scale: %.4f %.4f %.4f" % scale)
    print("thresholds: hue %g-%g sat>=%g gold hue %g-%g flat_tol=%d resid<=%g a<=%g exclusion radius=0"
          % (HUE_MIN, HUE_MAX, SAT_MIN, GOLD_HUE_MIN, GOLD_HUE_MAX, FLAT_TOL, RESID_MAX, A_MAX))
    print("remapped pixels: %d of %d (%s)" % (changed, w * h, counts))


if __name__ == "__main__":
    main()
