import { formatRelativeTime } from '../formatRelativeTime';

const NOW = new Date(2026, 8, 22, 15, 0, 0); // local time
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;

it.each([
  [30_000, 'Just now'],
  [5 * MIN, '5m ago'],
  [2 * HOUR, '2h ago'],
  [23 * HOUR, '23h ago'],
])('%dms ago -> %s', (ms, expected) => {
  expect(formatRelativeTime(ago(ms), NOW)).toBe(expected);
});

it('reads "Yesterday" for the previous calendar day beyond 24h', () => {
  expect(formatRelativeTime(new Date(2026, 8, 21, 9, 0, 0).toISOString(), NOW)).toBe('Yesterday');
});

it('reads "Nd ago" for 2-6 calendar days', () => {
  expect(formatRelativeTime(new Date(2026, 8, 19, 9, 0, 0).toISOString(), NOW)).toBe('3d ago');
});

it('falls back to a short date at 7+ days', () => {
  expect(formatRelativeTime(new Date(2026, 8, 10, 9, 0, 0).toISOString(), NOW)).not.toMatch(/ago/);
});

it('treats a future timestamp as "Just now" and an invalid one as empty', () => {
  expect(formatRelativeTime(new Date(NOW.getTime() + HOUR).toISOString(), NOW)).toBe('Just now');
  expect(formatRelativeTime('not-a-date', NOW)).toBe('');
});
