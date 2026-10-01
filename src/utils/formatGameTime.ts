/** Date/time strings for dashboard rows and the next-game card. */

function validDate(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "Today", "Tomorrow", otherwise the short weekday ("Sat"). */
export function formatDayLabel(iso: string, now: number = Date.now()): string {
  const date = validDate(iso);
  if (!date) {
    return '';
  }
  const dayDiff = Math.round((startOfDay(date) - startOfDay(new Date(now))) / 86_400_000);
  if (dayDiff === 0) {
    return 'Today';
  }
  if (dayDiff === 1) {
    return 'Tomorrow';
  }
  return date.toLocaleDateString(undefined, { weekday: 'short' });
}

export function formatTimeOfDay(iso: string): string {
  const date = validDate(iso);
  return date ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
}

/** "Sat, 6:00 PM" — row date line before the venue. */
export function formatRowDate(iso: string): string {
  const date = validDate(iso);
  if (!date) {
    return '';
  }
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' });
  return `${weekday}, ${formatTimeOfDay(iso)}`;
}
