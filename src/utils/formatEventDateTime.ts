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

/**
 * `endsAtIso` may be null/undefined: the backend's `EventResponse.ends_at`
 * is nullable (an event may have no defined end time). An absent or
 * unparseable end time renders the start time only — no dash, never
 * "Invalid Date".
 */
export function formatEventTimeRange(
  startsAtIso: string,
  endsAtIso?: string | null,
): string {
  const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  const start = new Date(startsAtIso).toLocaleTimeString(undefined, timeOptions);
  if (!endsAtIso) {
    return start;
  }
  const endDate = new Date(endsAtIso);
  if (Number.isNaN(endDate.getTime())) {
    return start;
  }
  return `${start} – ${endDate.toLocaleTimeString(undefined, timeOptions)}`;
}
