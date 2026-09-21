/**
 * Compact relative timestamps for the notification list: "Just now",
 * "5m ago", "2h ago", "Yesterday", "3d ago", then a short date. No date
 * library is installed (see `formatEventDateTime.ts`), so this uses plain
 * `Date` arithmetic. Anything under 24h is elapsed-time based; from 24h on,
 * "Yesterday"/"Nd ago" count local calendar days.
 */
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MAX_RELATIVE_DAYS = 7;

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) {
    return '';
  }

  const elapsed = now.getTime() - then.getTime();
  // Future timestamps (device clock behind the server) read as "just now".
  if (elapsed < MINUTE_MS) {
    return 'Just now';
  }
  if (elapsed < HOUR_MS) {
    return `${Math.floor(elapsed / MINUTE_MS)}m ago`;
  }
  if (elapsed < DAY_MS) {
    return `${Math.floor(elapsed / HOUR_MS)}h ago`;
  }

  const days = Math.round((startOfLocalDay(now) - startOfLocalDay(then)) / DAY_MS);
  if (days <= 1) {
    return 'Yesterday';
  }
  if (days < MAX_RELATIVE_DAYS) {
    return `${days}d ago`;
  }
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
