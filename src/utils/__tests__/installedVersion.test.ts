/**
 * `getInstalledVersionCode` reads `Config.VERSION_CODE` from the project's
 * existing `react-native-config` (the app's generated `BuildConfig`). The
 * library types it `string | undefined`, but a native `int` arrives as a number.
 */
import Config from 'react-native-config';

import { getInstalledVersionCode } from '../installedVersion';

const setVersionCode = (value: unknown): void => {
  (Config as Record<string, unknown>).VERSION_CODE = value;
};

afterEach(() => {
  delete (Config as Record<string, unknown>).VERSION_CODE;
});

describe('getInstalledVersionCode', () => {
  it('reads a numeric versionCode (how a native int arrives)', () => {
    setVersionCode(4);
    expect(getInstalledVersionCode()).toBe(4);
  });

  it('also accepts a numeric string', () => {
    setVersionCode('17');
    expect(getInstalledVersionCode()).toBe(17);
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['empty string', ''],
    ['non-numeric string', 'abc'],
    ['string with junk', '12abc'],
    ['negative string', '-3'],
    ['decimal string', '4.5'],
    ['zero', 0],
    ['negative', -1],
    ['fractional', 4.5],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['a boolean', true],
    ['an object', { code: 4 }],
  ])('returns null when it is %s', (_label, value) => {
    setVersionCode(value);
    expect(getInstalledVersionCode()).toBeNull();
  });
});
