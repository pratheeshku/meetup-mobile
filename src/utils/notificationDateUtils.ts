/**
 * Date and time utilities for notification history grouping and display.
 * Matches images 01-13 in docs/design/notifications/:
 * - Grouping: TODAY, YESTERDAY, EARLIER by the device's local calendar date.
 * - Card timestamp:
 *   - TODAY: compact elapsed duration ("10m", "2h", "4h")
 *   - YESTERDAY: local 12-hour clock ("6:15 PM", "11:02 AM")
 *   - EARLIER: day and abbreviated month ("3 Oct", "1 Oct")
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export type NotificationGroup = 'today' | 'yesterday' | 'earlier';

export function getNotificationGroup(
  iso: string,
  now: Date = new Date(),
): NotificationGroup {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) {
    return 'earlier';
  }

  const startOfNowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterdayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
  const startOfThenDay = new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime();

  if (startOfThenDay >= startOfNowDay) {
    return 'today';
  }
  if (startOfThenDay >= startOfYesterdayDay) {
    return 'yesterday';
  }
  return 'earlier';
}

export function formatNotificationCardTime(
  iso: string,
  now: Date = new Date(),
): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) {
    return '';
  }

  const group = getNotificationGroup(iso, now);

  if (group === 'today') {
    const elapsed = Math.max(0, now.getTime() - then.getTime());
    if (elapsed < HOUR_MS) {
      const minutes = Math.max(1, Math.floor(elapsed / MINUTE_MS));
      return `${minutes}m`;
    }
    const hours = Math.floor(elapsed / HOUR_MS);
    return `${hours}h`;
  }

  if (group === 'yesterday') {
    let hours = then.getHours();
    const minutes = then.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    const minutesStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${hours}:${minutesStr} ${ampm}`;
  }

  // earlier
  const day = then.getDate();
  const month = SHORT_MONTHS[then.getMonth()] ?? '';
  return `${day} ${month}`;
}
