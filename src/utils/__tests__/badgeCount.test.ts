import { formatBadgeCount } from '../badgeCount';

describe('formatBadgeCount (NB-01)', () => {
  it.each([
    [0, null],
    [-3, null],
    [Number.NaN, null],
    [1, '1'],
    [5, '5'],
    [99, '99'],
    [100, '99+'],
    [250, '99+'],
  ])('%s -> %s', (count, expected) => {
    expect(formatBadgeCount(count)).toBe(expected);
  });
});
