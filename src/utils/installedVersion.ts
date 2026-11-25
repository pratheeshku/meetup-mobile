/**
 * The installed app's build number: Android `versionCode`, iOS `CFBundleVersion`.
 *
 * Read from `Config.VERSION_CODE` via the project's existing
 * `react-native-config` dependency (no new package): that library exposes every
 * field of the app's generated `BuildConfig` class — including
 * `int VERSION_CODE` — to JavaScript. Its TypeScript type says
 * `string | undefined`, but a native `int` arrives as a JS number, so both
 * forms are accepted.
 *
 * Caveat: the values are read by reflection, so R8 minification of `BuildConfig`
 * (currently disabled for release) would make this — and every other `ENV`
 * value — arrive empty. That surfaces here as `null`.
 */
import Config from 'react-native-config';
import DeviceInfo from 'react-native-device-info';

/** The installed `versionCode`, or `null` if it cannot be read as a positive integer. */
export function getInstalledVersionCode(): number | null {
  const raw: unknown = (Config as Record<string, unknown>).VERSION_CODE;

  let value: number;
  if (typeof raw === 'number') {
    value = raw;
  } else if (typeof raw === 'string' && /^\d+$/.test(raw)) {
    value = Number(raw);
  } else {
    return null;
  }
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

/**
 * The installed iOS build number (`CFBundleVersion`, app-update-prompt AD-1), read with the existing
 * `react-native-device-info` dependency. Anything but a plain positive whole number is `null` (fails open, AD-9).
 */
export function getInstalledIosBuild(): number | null {
  let raw: unknown;
  try {
    raw = DeviceInfo.getBuildNumber();
  } catch {
    return null;
  }
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
    return null;
  }
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** The installed build number for `platform` (Android `versionCode`, iOS `CFBundleVersion`), or `null`. */
export function getInstalledBuild(platform: 'android' | 'ios'): number | null {
  return platform === 'android' ? getInstalledVersionCode() : getInstalledIosBuild();
}
