import { NEUTRAL_SPORT_CHIP, NEUTRAL_SPORT_TINT, sportPalette } from '../style';

describe('sportPalette', () => {
  it('derives tint, chip and shadow from the API colour', () => {
    const palette = sportPalette('#2A7B72');
    expect(palette.tint).toBe('#2A7B72');
    expect(palette.chip).not.toBe(palette.tint);
    expect(palette.chip.startsWith('#')).toBe(true);
    expect(palette.shadow).toBe('rgba(42, 123, 114, 0.28)');
  });

  it('uses the neutral palette when colour is missing or not a hex colour', () => {
    for (const color of [null, undefined, '', 'blue', 'not-a-color']) {
      expect(sportPalette(color)).toEqual({
        tint: NEUTRAL_SPORT_TINT,
        chip: NEUTRAL_SPORT_CHIP,
        shadow: 'rgba(15, 23, 42, 0.12)',
      });
    }
  });
});
