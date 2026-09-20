/**
 * The installed app's Android `versionCode`.
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
