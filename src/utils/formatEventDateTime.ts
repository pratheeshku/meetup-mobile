/**
 * Event date/time display formatting.
 *
 * No date library (date-fns/dayjs/luxon) is installed in this repo, and
 * this task didn't ask for one — uses the platform's built-in
 * `Intl`-backed `Date` formatting (supported by Hermes on RN 0.86.3)
 * rather than adding a dependency for two small display helpers.
 */

export function formatEventDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatEventTimeRange(startsAtIso: string, endsAtIso: string): string {
  const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  const start = new Date(startsAtIso).toLocaleTimeString(undefined, timeOptions);
  const end = new Date(endsAtIso).toLocaleTimeString(undefined, timeOptions);
  return `${start} – ${end}`;
}
