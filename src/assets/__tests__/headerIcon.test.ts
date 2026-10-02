/**
 * AD-18 header icon variant. EXECUTES: decodes the real PNGs with pngjs (a
 * decoder already present in node_modules) and measures pixels. The
 * "byte-identical when run twice" check needs Python/Pillow, so it is a
 * script step reported in the implementation report, not a Jest test.
 */
import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

import { dash } from '../../theme/dashboardTheme';

const read = (name: string) =>
  PNG.sync.read(fs.readFileSync(path.join(__dirname, '..', name)));

// Same classification as scripts/make-header-icon.py.
const HUE_MIN = 205;
const HUE_MAX = 245;
const SAT_MIN = 0.45;
const RADIUS_FRAC = 0.29;

function hueSat(r: number, g: number, b: number): [number, number] {
  const mx = Math.max(r, g, b) / 255;
  const mn = Math.min(r, g, b) / 255;
  const d = mx - mn;
  const sat = mx === 0 ? 0 : d / mx;
  let h = 0;
  if (d !== 0) {
    const rr = r / 255;
    const gg = g / 255;
    const bb = b / 255;
    if (mx === rr) h = ((gg - bb) / d) % 6;
    else if (mx === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, sat];
}

const hexToRgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

describe('header icon variant (AD-18)', () => {
  const src = read('shuttlr-icon.png');
  const out = read('shuttlr-icon-header.png');
  const w = src.width;
  const cx = (w - 1) / 2;
  const r2 = (RADIUS_FRAC * w) ** 2;

  const plate: number[] = [];
  const other: number[] = [];
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const [h, s] = hueSat(src.data[i], src.data[i + 1], src.data[i + 2]);
      const inMedallion = (x - cx) ** 2 + (y - cx) ** 2 <= r2;
      const isPlate =
        src.data[i + 3] >= 250 && !inMedallion && h >= HUE_MIN && h <= HUE_MAX && s >= SAT_MIN;
      (isPlate ? plate : other).push(i);
    }
  }
  const mean = (png: PNG, idx: number[]) =>
    [0, 1, 2].map(c => idx.reduce((a, i) => a + png.data[i + c], 0) / idx.length);

  it('has the same dimensions as the source', () => {
    expect([out.width, out.height]).toEqual([src.width, src.height]);
  });

  it('plate pixels exist and the plate mean is within 4 per channel of the brand token', () => {
    expect(plate.length).toBeGreaterThan(1000);
    const target = hexToRgb(dash.brand);
    expect(target).toEqual([30, 91, 214]);
    mean(out, plate).forEach((v, c) => expect(Math.abs(v - target[c])).toBeLessThanOrEqual(4));
  });

  it('the source plate really was the darker blue (guards a no-op script)', () => {
    const before = mean(src, plate);
    expect(Math.abs(before[1] - 91)).toBeGreaterThan(20);
  });

  it('leaves gold, silver, white, the medallion and transparency byte-identical', () => {
    for (const i of other) {
      for (let c = 0; c < 4; c++) expect(out.data[i + c]).toBe(src.data[i + c]);
    }
  });

  it('keeps the embossed pattern as tonal variation on the plate', () => {
    const lum = (png: PNG) => {
      const v = plate.map(i => png.data[i + 2]);
      const m = v.reduce((a, b) => a + b, 0) / v.length;
      return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
    };
    expect(lum(out)).toBeGreaterThan(0.5);
  });
});
