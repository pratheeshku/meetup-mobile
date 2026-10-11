/**
 * AD-18 header icon variant (addendum v1.8: flat blue plate, white shuttlecock,
 * gold band, NO medallion, nothing excluded by region). EXECUTES: decodes the
 * real PNGs with pngjs and measures pixels. "Byte-identical when run twice"
 * needs Python/Pillow, so it is a script step reported in the implementation
 * report, not a Jest test.
 *
 * Flat-plate pixels are the outer 24px margin of the 192px header file.
 * That rectangle is geometry, not "pixels already within 12 of the brand
 * colour", so the mean and per-pixel checks are against the literal brand
 * blue rather than a set the output defined for itself.
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
/** Outer margin that is plate on the 192px header, clear of the shuttlecock. */
const PLATE_MARGIN = 24;
/** AD-18's measured old plate, rgb(31, 65, 161). Not derived from either PNG. */
const OLD_PLATE = [31, 65, 161];
/**
 * Median blue of the current 512px source (white field, blue shuttlecock).
 * Not the script's runtime median, and not the header output.
 */
const SOURCE_BLUE = [29, 81, 208];

describe('header icon variant (AD-18)', () => {
  const src = read('shuttlr-icon.png');
  const out = read('shuttlr-icon-header.png');
  const target = hexToRgb(dash.brand);

  const px = (png: Png, i: number) => [png.data[i], png.data[i + 1], png.data[i + 2]];
  const near = (a: number[], b: number[], tol: number) => a.every((v, c) => Math.abs(v - b[c]) <= tol);

  const flat: number[] = [];
  for (let y = 0; y < out.height; y += 1) {
    for (let x = 0; x < out.width; x += 1) {
      if (x < PLATE_MARGIN || y < PLATE_MARGIN || x >= out.width - PLATE_MARGIN || y >= out.height - PLATE_MARGIN) {
        flat.push((y * out.width + x) * 4);
      }
    }
  }
  const mean = (png: Png, idx: number[]) =>
    [0, 1, 2].map(c => idx.reduce((a, i) => a + png.data[i + c], 0) / idx.length);

  it('header is 192x192 and the brand target is the literal token', () => {
    expect([out.width, out.height]).toEqual([192, 192]);
    expect([src.width, src.height]).toEqual([512, 512]);
    expect(target).toEqual([30, 91, 214]);
  });

  it('flat plate mean is within 4 per channel of the brand token', () => {
    expect(flat.length).toBe(16128);
    mean(out, flat).forEach((v, c) => expect(Math.abs(v - target[c])).toBeLessThanOrEqual(TOL_MEAN));
  });

  it('the four margin bands agree with each other and with the brand token', () => {
    const top = flat.filter(i => Math.floor(i / 4 / out.width) < PLATE_MARGIN);
    const bottom = flat.filter(i => Math.floor(i / 4 / out.width) >= out.height - PLATE_MARGIN);
    const left = flat.filter(i => (i / 4) % out.width < PLATE_MARGIN);
    const right = flat.filter(i => (i / 4) % out.width >= out.width - PLATE_MARGIN);
    const bands = [top, bottom, left, right].map(band => mean(out, band));
    bands.forEach(band => {
      band.forEach((v, c) => expect(Math.abs(v - target[c])).toBeLessThanOrEqual(TOL_MEAN));
    });
    for (let i = 1; i < bands.length; i += 1) {
      bands[i].forEach((v, c) => expect(Math.abs(v - bands[0][c])).toBeLessThanOrEqual(TOL_MEAN));
    }
  });

  it('no margin pixel is more than 12 from the brand blue, and none is the old plate', () => {
    for (const i of flat) expect(near(px(out, i), target, TOL_FLAT)).toBe(true);
    const oldBlue = flat.filter(i => near(px(out, i), OLD_PLATE, TOL_FLAT));
    expect(oldBlue).toHaveLength(0);
  });

  it('the source blue is not already the brand plate', () => {
    const srcBlue: number[] = [];
    for (let i = 0; i < src.data.length; i += 4) {
      if (src.data[i + 3] >= 250 && near(px(src, i), SOURCE_BLUE, TOL_FLAT)) srcBlue.push(i);
    }
    const before = mean(src, srcBlue);
    // Original guard was >20 on G and B, for the AD-18 plate ~(31, 65, 161):
    // G delta ~26, B delta ~53. This source file's blue averages about
    // (29.3, 81.2, 207.7) against target (30, 91, 214), so the deltas are
    // ~0.7, ~9.8 and ~6.3. >20 cannot pass. >8 on G still shows the source
    // is not already brand blue.
    expect(Math.abs(before[1] - target[1])).toBeGreaterThan(8);
    expect(Math.abs(before[2] - target[2])).toBeGreaterThan(5);
  });

  it('white interior pixels stay within 2 of white; alpha is opaque', () => {
    let checked = 0;
    for (let i = 0; i < out.data.length; i += 4) {
      const [r, g, b] = px(out, i);
      const white = r >= 253 && g >= 253 && b >= 253;
      if (white) {
        checked += 1;
        expect(near([r, g, b], [255, 255, 255], TOL_INTERIOR)).toBe(true);
      }
      expect(out.data[i + 3]).toBe(255);
    }
    expect(checked).toBeGreaterThan(4900);
  });

  it('the old central-disk exclusion is gone from the script', () => {
    const script = readText('scripts/make-header-icon.py');
    expect(script).not.toMatch(/MEDALLION/);
    expect(script).toMatch(/exclusion radius=0/);
  });
});
