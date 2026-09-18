import { getDisplayName } from '../displayName';

describe('getDisplayName', () => {
  it('prefers display_name over nickname', () => {
    expect(getDisplayName({ display_name: 'Sam Smith', nickname: 'sam99' })).toBe('Sam Smith');
  });

  it('trims the name', () => {
    expect(getDisplayName({ display_name: '  Sam  ', nickname: 'sam99' })).toBe('Sam');
  });

  it.each([undefined, null, '', '   '])('falls back to nickname when display_name is %p', blank => {
    expect(getDisplayName({ display_name: blank, nickname: 'sam99' })).toBe('sam99');
  });

  it('is empty when there is no user or no names at all', () => {
    expect(getDisplayName(null)).toBe('');
    expect(getDisplayName(undefined)).toBe('');
    expect(getDisplayName({})).toBe('');
  });
});
