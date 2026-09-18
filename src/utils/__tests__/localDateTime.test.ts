import { parseLocalDateTime } from '../localDateTime';

describe('parseLocalDateTime', () => {
  it('reads the text as device-local time and returns the matching UTC ISO instant', () => {
    const iso = parseLocalDateTime('2026-10-01 18:30');
    expect(iso).toBe(new Date(2026, 9, 1, 18, 30).toISOString());
  });

  it('accepts a "T" separator and surrounding whitespace', () => {
    expect(parseLocalDateTime('  2026-10-01T18:30 ')).toBe(new Date(2026, 9, 1, 18, 30).toISOString());
  });

  it.each([
    ['empty', ''],
    ['date only', '2026-10-01'],
    ['wrong order', '01-10-2026 18:30'],
    ['seconds', '2026-10-01 18:30:00'],
    ['nonexistent day (no rollover)', '2026-02-31 10:00'],
    ['month 13', '2026-13-01 10:00'],
    ['hour 25', '2026-10-01 25:00'],
    ['minute 61', '2026-10-01 10:61'],
    ['words', 'tomorrow 6pm'],
  ])('rejects %s', (_label, input) => {
    expect(parseLocalDateTime(input)).toBeNull();
  });
});
