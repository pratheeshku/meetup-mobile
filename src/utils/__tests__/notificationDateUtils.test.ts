import {
  formatNotificationCardTime,
  getNotificationGroup,
} from '../notificationDateUtils';

describe('notificationDateUtils', () => {
  const baseNow = new Date('2026-10-09T15:00:00Z');

  describe('getNotificationGroup', () => {
    it('returns today for timestamps on the same local calendar day', () => {
      const todayEarlier = new Date(baseNow.getTime() - 2 * 3600_000).toISOString();
      expect(getNotificationGroup(todayEarlier, baseNow)).toBe('today');
    });

    it('returns yesterday for timestamps on the preceding local calendar day', () => {
      const yesterday = new Date(baseNow.getTime() - 26 * 3600_000).toISOString();
      expect(getNotificationGroup(yesterday, baseNow)).toBe('yesterday');
    });

    it('returns earlier for timestamps older than yesterday', () => {
      const older = new Date(baseNow.getTime() - 50 * 3600_000).toISOString();
      expect(getNotificationGroup(older, baseNow)).toBe('earlier');
    });

    it('handles invalid dates gracefully', () => {
      expect(getNotificationGroup('not-a-date', baseNow)).toBe('earlier');
    });
  });

  describe('formatNotificationCardTime', () => {
    it('formats today minutes and hours', () => {
      const tenMinsAgo = new Date(baseNow.getTime() - 10 * 60_000).toISOString();
      expect(formatNotificationCardTime(tenMinsAgo, baseNow)).toBe('10m');

      const twoHoursAgo = new Date(baseNow.getTime() - 2 * 3600_000).toISOString();
      expect(formatNotificationCardTime(twoHoursAgo, baseNow)).toBe('2h');
    });

    it('formats yesterday with clock time', () => {
      const yesterday = new Date('2026-10-08T14:30:00').toISOString();
      const formatted = formatNotificationCardTime(yesterday, new Date('2026-10-09T14:30:00'));
      expect(formatted).toMatch(/\d{1,2}:\d{2}\s(AM|PM)/);
    });

    it('formats earlier with day and short month', () => {
      const earlier = new Date('2026-10-03T10:00:00Z').toISOString();
      const formatted = formatNotificationCardTime(earlier, baseNow);
      expect(formatted).toContain('Oct');
    });

    it('returns empty string on invalid date', () => {
      expect(formatNotificationCardTime('invalid')).toBe('');
    });
  });
});
