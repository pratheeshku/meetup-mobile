/** Date helpers for dashboard rows. EXECUTES the functions (local-time safe). */
import { formatDayLabel, formatRowDate, formatTimeOfDay } from '../formatGameTime';

const at = (dayOffset: number, hour = 18): Date => {
  const base = new Date(2030, 5, 12, 9, 0, 0); // local time, so the assertions are zone-independent
  base.setDate(base.getDate() + dayOffset);
  base.setHours(hour, 0, 0, 0);
  return base;
};
const NOW = at(0, 9).getTime();

describe('formatDayLabel', () => {
  it('says Today and Tomorrow, otherwise the short weekday', () => {
    expect(formatDayLabel(at(0).toISOString(), NOW)).toBe('Today');
    expect(formatDayLabel(at(1).toISOString(), NOW)).toBe('Tomorrow');
    expect(formatDayLabel(at(3).toISOString(), NOW)).toBe(
      at(3).toLocaleDateString(undefined, { weekday: 'short' }),
    );
  });

  it('returns an empty string for an unparseable date', () => {
    expect(formatDayLabel('nope', NOW)).toBe('');
  });
});

describe('formatTimeOfDay / formatRowDate', () => {
  it('formats a time and "weekday, time"', () => {
    const iso = at(2).toISOString();
    expect(formatTimeOfDay(iso)).toBe(at(2).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }));
    expect(formatRowDate(iso)).toBe(
      `${at(2).toLocaleDateString(undefined, { weekday: 'short' })}, ${formatTimeOfDay(iso)}`,
    );
  });

  it('returns an empty string for an unparseable date', () => {
    expect(formatTimeOfDay('nope')).toBe('');
    expect(formatRowDate('nope')).toBe('');
  });
});
