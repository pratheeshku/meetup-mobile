/**
 * AD-18 header icon variant (addendum v1.8: flat blue plate, white shuttlecock,
 * gold band, NO medallion, nothing excluded by region). EXECUTES: decodes the
 * real PNGs with pngjs and measures pixels. "Byte-identical when run twice"
 * needs Python/Pillow, so it is a script step reported in the implementation
 * report, not a Jest test.
 */
import { dash } from '../../theme/dashboardTheme';

// Node built-ins / pngjs are untyped in this RN project (no @types/node).
const fs = require('fs');
const { PNG } = require('pngjs');

const jestCwd = (): string =>
  (globalThis as unknown as { process: { cwd(): string } }).process.cwd();

interface Png {
  width: number;
  height: number;
  data: Uint8Array;
}

const read = (name: string): Png =>
  PNG.sync.read(fs.readFileSync(`${jestCwd()}/src/assets/${name}`));
const readText = (name: string): string => fs.readFileSync(`${jestCwd()}/${name}`, 'utf8');

const hexToRgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const TOL_MEAN = 4;
const TOL_FLAT = 12;
const TOL_INTERIOR = 2;

describe('header icon variant (AD-18)', () => {
  const src = read('shuttlr-icon.png');
  const out = read('shuttlr-icon-header.png');
  const w = src.width;
  const cx = (w - 1) / 2;
  const diskR2 = (0.29 * w) ** 2;
  const target = hexToRgb(dash.brand);

  const px = (png: Png, i: number) => [png.data[i], png.data[i + 1], png.data[i + 2]];
  const median = (vals: number[]) => [...vals].sort((a, b) => a - b)[Math.floor(vals.length / 2)];

  // Source plate colour: median of opaque pixels that are clearly the old blue.
  const blueish: number[] = [];
  for (let i = 0; i < src.data.length; i += 4) {
    const [r, g, b] = px(src, i);
    if (src.data[i + 3] >= 250 && b > 120 && b - r > 80 && b - g > 60) blueish.push(i);
  }
  const P = [0, 1, 2].map(c => median(blueish.map(i => src.data[i + c])));
  const near = (a: number[], b: number[], tol: number) => a.every((v, c) => Math.abs(v - b[c]) <= tol);

  // "Flat plate" pixels: within 12 of the source plate colour.
  const flat: number[] = [];
  for (let i = 0; i < src.data.length; i += 4) {
    if (src.data[i + 3] >= 250 && near(px(src, i), P, TOL_FLAT)) flat.push(i);
  }
  const inDisk = (i: number) => {
    const p = i / 4;
    return ((p % w) - cx) ** 2 + (Math.floor(p / w) - cx) ** 2 <= diskR2;
  };
  const mean = (png: Png, idx: number[]) =>
    [0, 1, 2].map(c => idx.reduce((a, i) => a + png.data[i + c], 0) / idx.length);

  it('has the same dimensions as the source', () => {
    expect([out.width, out.height]).toEqual([src.width, src.height]);
    expect(target).toEqual([30, 91, 214]);
  });

  it('flat plate mean is within 4 per channel of the brand token', () => {
    expect(flat.length).toBeGreaterThan(20000);
    mean(out, flat).forEach((v, c) => expect(Math.abs(v - target[c])).toBeLessThanOrEqual(TOL_MEAN));
  });

  it('the plate mean in the centre disk and in the outer area agree (no visible disc)', () => {
    const centre = flat.filter(inDisk);
    const outer = flat.filter(i => !inDisk(i));
    expect(centre.length).toBeGreaterThan(1000);
    const mc = mean(out, centre);
    const mo = mean(out, outer);
    mc.forEach((v, c) => expect(Math.abs(v - mo[c])).toBeLessThanOrEqual(TOL_MEAN));
    mc.forEach((v, c) => expect(Math.abs(v - target[c])).toBeLessThanOrEqual(TOL_MEAN));
  });

  it('no flat plate pixel stays more than 12 per channel from the target, none keeps the old blue', () => {
    for (const i of flat) expect(near(px(out, i), target, TOL_FLAT)).toBe(true);
    const oldBlue = flat.filter(i => near(px(out, i), P, TOL_FLAT));
    expect(oldBlue).toHaveLength(0);
  });

  it('the source plate really was darker (guards against a no-op script)', () => {
    const before = mean(src, flat);
    expect(Math.abs(before[1] - target[1])).toBeGreaterThan(20);
    expect(Math.abs(before[2] - target[2])).toBeGreaterThan(20);
  });

  it('white and gold interior pixels are within 2 of the source; alpha is unchanged', () => {
    let checked = 0;
    for (let i = 0; i < src.data.length; i += 4) {
      const [r, g, b] = px(src, i);
      const white = r >= 245 && g >= 245 && b >= 245;
      const gold = r > 235 && g > 185 && g < 215 && b < 40;
      if (white || gold) {
        checked += 1;
        expect(near(px(out, i), [r, g, b], TOL_INTERIOR)).toBe(true);
      }
      expect(out.data[i + 3]).toBe(src.data[i + 3]);
    }
    expect(checked).toBeGreaterThan(5000);
  });

  it('the old central-disk exclusion is gone from the script', () => {
    const script = readText('scripts/make-header-icon.py');
    expect(script).not.toMatch(/MEDALLION/);
    expect(script).toMatch(/exclusion radius=0/);
  });
});
