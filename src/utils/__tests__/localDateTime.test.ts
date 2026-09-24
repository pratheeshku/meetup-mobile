import {
  applyQuickDate,
  formatDateOnly,
  formatLocalDateTime,
  localDateToDate,
  localDateTimeToDate,
  parseLocalDate,
  parseLocalDateTime,
  quickDate,
} from '../localDateTime';

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

describe('parseLocalDate (Create Flow Amendment — Tournament Start Date, no time)', () => {
  it('reads the text as device-local midnight and returns the matching UTC ISO instant', () => {
    expect(parseLocalDate('2026-10-01')).toBe(new Date(2026, 9, 1).toISOString());
  });

  it.each([
    ['empty', ''],
    ['with a time component', '2026-10-01 18:30'],
    ['wrong order', '01-10-2026'],
    ['nonexistent day (no rollover)', '2026-02-31'],
    ['month 13', '2026-13-01'],
  ])('rejects %s', (_label, input) => {
    expect(parseLocalDate(input)).toBeNull();
  });
});

describe('quickDate (Create Flow Amendment — Casual Game quick-select chips)', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('from a Wednesday: today/tomorrow/this Sat/this Sun all land ahead in the same week', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 23)); // Wed 2026-09-23
    expect(quickDate('today')).toBe('2026-09-23');
    expect(quickDate('tomorrow')).toBe('2026-09-24');
    expect(quickDate('sat')).toBe('2026-09-26');
    expect(quickDate('sun')).toBe('2026-09-27');
  });

  it('"this Sat" on a Saturday means *next* Saturday, not today (matches web\'s `|| 7` fallback)', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 26)); // Sat 2026-09-26
    expect(quickDate('sat')).toBe('2026-10-03');
    expect(quickDate('sun')).toBe('2026-09-27');
  });

  it('"this Sun" on a Sunday means *next* Sunday, not today', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 27)); // Sun 2026-09-27
    expect(quickDate('sun')).toBe('2026-10-04');
    expect(quickDate('sat')).toBe('2026-10-03');
  });
});

describe('applyQuickDate', () => {
  it('replaces only the date portion, keeping an already-typed time', () => {
    expect(applyQuickDate('2000-01-01 20:15', '2026-09-23')).toBe('2026-09-23 20:15');
  });

  it('defaults to 09:00 when the field was empty or unparsed', () => {
    expect(applyQuickDate('', '2026-09-23')).toBe('2026-09-23 09:00');
    expect(applyQuickDate('not a date', '2026-09-23')).toBe('2026-09-23 09:00');
  });
});

describe('formatDateOnly and formatLocalDateTime', () => {
  it('formats a date object as local YYYY-MM-DD', () => {
    const d = new Date(2026, 4, 3);
    expect(formatDateOnly(d)).toBe('2026-05-03');
  });

  it('formats a date object as local YYYY-MM-DD HH:mm', () => {
    const d = new Date(2026, 4, 3, 9, 5);
    expect(formatLocalDateTime(d)).toBe('2026-05-03 09:05');
  });
});

describe('localDateTimeToDate and localDateToDate', () => {
  it('parses valid local date time string into Date object', () => {
    const d = localDateTimeToDate('2026-10-01 18:30');
    expect(d).not.toBeNull();
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(9);
    expect(d?.getDate()).toBe(1);
    expect(d?.getHours()).toBe(18);
    expect(d?.getMinutes()).toBe(30);
  });

  it('returns null for invalid date time', () => {
    expect(localDateTimeToDate('invalid')).toBeNull();
    expect(localDateTimeToDate('2026-02-31 10:00')).toBeNull();
  });

  it('parses valid local date string into Date object (midnight)', () => {
    const d = localDateToDate('2026-10-01');
    expect(d).not.toBeNull();
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(9);
    expect(d?.getDate()).toBe(1);
  });

  it('returns null for invalid date', () => {
    expect(localDateToDate('invalid')).toBeNull();
    expect(localDateToDate('2026-02-31')).toBeNull();
  });
});
