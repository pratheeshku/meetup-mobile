/**
 * Save a game to the phone's own calendar (DES-MEETUP-ADDENDUM-priority1-nov23 P1-07).
 *
 * - Android: the native `AddToCalendar` module opens the calendar app's "new entry" screen (Intent ACTION_INSERT on
 *   CalendarContract.Events) filled with the title, start, end, venue and a note. No calendar permission: the person
 *   saves or cancels in their calendar app.
 * - iOS: an .ics file is written to the cache folder and shown in the system preview, whose "Add to Calendar" saves
 *   it. No calendar permission either.
 *
 * Nothing is stored by the app and nothing is logged. A game with no end time gets the start plus two hours.
 */
import { NativeModules, Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

export interface CalendarEntry {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  notes?: string | null;
}

const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

interface AddToCalendarNative {
  insert(title: string, beginMs: number, endMs: number, location: string, description: string): Promise<boolean>;
}

/** Start and end in epoch milliseconds; end defaults to start + 2 hours and is never before the start. */
export function entryTimes(entry: CalendarEntry): { begin: number; end: number } {
  const begin = new Date(entry.startsAt).getTime();
  const parsedEnd = entry.endsAt ? new Date(entry.endsAt).getTime() : NaN;
  const end = Number.isFinite(parsedEnd) && parsedEnd > begin ? parsedEnd : begin + DEFAULT_DURATION_MS;
  return { begin, end };
}

function icsDate(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/** RFC 5545 TEXT escaping: backslash, semicolon, comma and line breaks. */
function icsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** A one-entry iCalendar file (CRLF line ends). The UID is stable per game so a second save updates, not duplicates. */
export function buildIcs(entry: CalendarEntry, now: Date = new Date()): string {
  const { begin, end } = entryTimes(entry);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GameOn SG//Game//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:game-${entry.id}@gameonsg`,
    `DTSTAMP:${icsDate(now.getTime())}`,
    `DTSTART:${icsDate(begin)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(entry.title)}`,
  ];
  if (entry.location) {
    lines.push(`LOCATION:${icsText(entry.location)}`);
  }
  if (entry.notes) {
    lines.push(`DESCRIPTION:${icsText(entry.notes)}`);
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

/** Opens the calendar's own add screen. Rejects when no calendar app can take the entry. */
export async function addToCalendar(entry: CalendarEntry): Promise<void> {
  const { begin, end } = entryTimes(entry);
  if (!Number.isFinite(begin)) {
    throw new Error('invalid start');
  }
  if (Platform.OS === 'android') {
    const native = (NativeModules as { AddToCalendar?: AddToCalendarNative }).AddToCalendar;
    if (!native) {
      throw new Error('calendar module missing');
    }
    await native.insert(entry.title, begin, end, entry.location ?? '', entry.notes ?? '');
    return;
  }
  const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/game-${entry.id.replace(/[^A-Za-z0-9-]/g, '')}.ics`;
  await ReactNativeBlobUtil.fs.writeFile(path, buildIcs(entry), 'utf8');
  await ReactNativeBlobUtil.ios.openDocument(path);
}
