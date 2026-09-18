/**
 * Accessibility guard for the text colour tokens: every text colour that is
 * used for readable copy must meet WCAG AA (4.5:1) on both surfaces it can
 * sit on (`surface` white cards, `background` page tint). Locks in the
 * measured values documented in `tokens.ts` so an edit can't silently
 * regress legibility — `textMuted` previously failed at 2.92:1 / 2.65:1.
 */
import { colors } from '../tokens';

function relativeLuminance(hex: string): number {
  const channel = (start: number): number => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_TOKENS = ['textPrimary', 'textSecondary', 'textMuted'] as const;
const SURFACES = ['surface', 'background'] as const;

describe('text colour tokens', () => {
  describe.each(TEXT_TOKENS)('%s', textToken => {
    it.each(SURFACES)('meets WCAG AA (>= 4.5:1) on %s', surfaceToken => {
      expect(contrastRatio(colors[textToken], colors[surfaceToken])).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('the previous textMuted value (#8B97B5) did fail AA, so the guard is not vacuous', () => {
    expect(contrastRatio('#8B97B5', colors.surface)).toBeLessThan(4.5);
    expect(contrastRatio('#8B97B5', colors.background)).toBeLessThan(4.5);
  });
});
