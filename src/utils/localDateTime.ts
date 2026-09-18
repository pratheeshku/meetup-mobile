/**
 * Text date-time entry for forms. No date-picker package is installed and
 * adding a native one is a dependency decision, so forms take a typed
 * "YYYY-MM-DD HH:mm" in the device's local time zone and send the matching
 * UTC ISO 8601 instant (the schema's `date-time` format).
 */
export const LOCAL_DATE_TIME_PLACEHOLDER = 'YYYY-MM-DD HH:mm';

const PATTERN = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/;

/**
 * Returns the ISO string, or `null` when the text is malformed or names a
 * date/time that does not exist (e.g. 2026-02-31, 25:00, or a local time
 * skipped by a DST change) — no silent rollover into a different date.
 */
export function parseLocalDateTime(input: string): string | null {
  const match = PATTERN.exec(input.trim());
  if (!match) {
    return null;
  }
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  const roundTrips =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute;
  return roundTrips ? date.toISOString() : null;
}
