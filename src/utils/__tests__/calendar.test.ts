/** priority1-nov23 P1-07: the calendar entry (Android native add screen, iOS .ics preview). */
import { NativeModules, Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { addToCalendar, buildIcs, entryTimes } from '../calendar';

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    fs: { dirs: { CacheDir: '/cache' }, writeFile: jest.fn(() => Promise.resolve()) },
    ios: { openDocument: jest.fn(() => Promise.resolve()) },
  },
}));

const ENTRY = {
  id: 'g-1',
  title: 'Doubles; Court 3, evening',
  startsAt: '2026-12-01T11:00:00Z',
  endsAt: '2026-12-01T13:30:00Z',
  location: 'ActiveSG Hall',
  notes: 'Bring\nshuttles',
};

const setOS = (os: 'ios' | 'android'): void => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
};

afterEach(() => {
  jest.clearAllMocks();
  delete (NativeModules as Record<string, unknown>).AddToCalendar;
});

describe('entryTimes', () => {
  it('uses the end time when it is after the start, else start + 2 hours', () => {
    const begin = Date.parse(ENTRY.startsAt);
    expect(entryTimes(ENTRY)).toEqual({ begin, end: Date.parse(ENTRY.endsAt) });
    expect(entryTimes({ ...ENTRY, endsAt: null })).toEqual({ begin, end: begin + 2 * 3600 * 1000 });
    expect(entryTimes({ ...ENTRY, endsAt: '2026-12-01T10:00:00Z' }).end).toBe(begin + 2 * 3600 * 1000);
  });
});

describe('buildIcs', () => {
  it('writes one VEVENT in UTC with escaped text and CRLF line ends', () => {
    const ics = buildIcs(ENTRY, new Date('2026-11-23T00:00:00Z'));
    expect(ics).toContain('BEGIN:VEVENT\r\n');
    expect(ics).toContain('UID:game-g-1@gameonsg\r\n');
    expect(ics).toContain('DTSTART:20261201T110000Z\r\n');
    expect(ics).toContain('DTEND:20261201T133000Z\r\n');
    expect(ics).toContain('SUMMARY:Doubles\\; Court 3\\, evening\r\n');
    expect(ics).toContain('LOCATION:ActiveSG Hall\r\n');
    expect(ics).toContain('DESCRIPTION:Bring\\nshuttles\r\n');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
});

describe('addToCalendar', () => {
  it('Android: hands the entry to the native add screen', async () => {
    setOS('android');
    const insert = jest.fn(() => Promise.resolve(true));
    (NativeModules as Record<string, unknown>).AddToCalendar = { insert };
    await addToCalendar(ENTRY);
    expect(insert).toHaveBeenCalledWith(
      ENTRY.title, Date.parse(ENTRY.startsAt), Date.parse(ENTRY.endsAt), 'ActiveSG Hall', 'Bring\nshuttles',
    );
  });

  it('Android: rejects when the native module is missing (old build)', async () => {
    setOS('android');
    await expect(addToCalendar(ENTRY)).rejects.toThrow();
  });

  it('iOS: writes the .ics to the cache and opens the system preview', async () => {
    setOS('ios');
    await addToCalendar(ENTRY);
    expect(ReactNativeBlobUtil.fs.writeFile).toHaveBeenCalledWith('/cache/game-g-1.ics', expect.stringContaining('BEGIN:VCALENDAR'), 'utf8');
    expect(ReactNativeBlobUtil.ios.openDocument).toHaveBeenCalledWith('/cache/game-g-1.ics');
  });
});
