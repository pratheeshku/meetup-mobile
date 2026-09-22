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

/**
 * Date-only entry (Create Flow Amendment, §4.3 — Tournament Start Date has
 * no time component, unlike Casual Game's Start Date & Time). Same
 * dependency-free "typed text, local time zone" approach as
 * `parseLocalDateTime`, parsed as local midnight.
 */
export const LOCAL_DATE_PLACEHOLDER = 'YYYY-MM-DD';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseLocalDate(input: string): string | null {
  const match = DATE_PATTERN.exec(input.trim());
  if (!match) {
    return null;
  }
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  const roundTrips =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return roundTrips ? date.toISOString() : null;
}

/** "YYYY-MM-DD" for a `Date`, in local time (no UTC conversion). */
function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export type QuickDate = 'today' | 'tomorrow' | 'sat' | 'sun';

/**
 * Same day-of-week math as the web app's quick-select chips
 * (`frontend/app.js`, `setEventDate`): "This Sat"/"This Sun" always mean
 * the *next* occurrence, even if today already is that day (the `|| 7`
 * fallback), matching web exactly rather than "today" being a valid match
 * for its own weekday chip.
 */
export function quickDate(which: QuickDate): string {
  const now = new Date();
  const target = new Date(now);
  if (which === 'tomorrow') {
    target.setDate(now.getDate() + 1);
  } else if (which === 'sat') {
    const day = now.getDay();
    target.setDate(now.getDate() + ((6 - day + 7) % 7 || 7));
  } else if (which === 'sun') {
    const day = now.getDay();
    target.setDate(now.getDate() + ((7 - day) % 7 || 7));
  }
  return formatDateOnly(target);
}

/**
 * Replaces the date portion of a "YYYY-MM-DD HH:mm" string with `dateStr`,
 * keeping whatever time the user already typed (defaulting to '09:00' when
 * the field was empty or unparsed) — how the quick-select chips apply to
 * Casual Game's combined Start Date & Time field.
 */
export function applyQuickDate(current: string, dateStr: string): string {
  const match = PATTERN.exec(current.trim());
  const time = match ? `${match[4]}:${match[5]}` : '09:00';
  return `${dateStr} ${time}`;
}
