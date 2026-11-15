/**
 * Android install attribution (group-invite-existing-accounts AD-9, D-2). On a signed-out cold start the
 * Android app asks the native `InstallReferrer` module (Google's Play Install Referrer library) for the `gi`
 * code once, and keeps it here in module memory only: never AsyncStorage, Keychain, route params, navigation
 * state, logs, diagnostics or analytics. It goes out as `attribution_code` on account-creation calls and never
 * at ordinary sign-in. A missing service, a timeout or any error means no code, silently. iOS has no code path.
 */
import { NativeModules, Platform } from 'react-native';

export interface AttributionFields {
  attribution_code?: string;
}

const TIMEOUT_MS = 5000;
/** URL-safe characters only, bounded: anything else is not a code we issued and is dropped. */
const CODE_SHAPE = /^[A-Za-z0-9_-]{1,128}$/;

interface InstallReferrerNative {
  getAttributionCode(): Promise<string | null>;
}

let code: string | null = null;
let started = false;

/** Reads the referrer once per app process (Android only). Never throws and never logs. */
export async function readInstallReferrerOnce(): Promise<void> {
  if (started || Platform.OS !== 'android') {
    return;
  }
  started = true;
  const native = (NativeModules as { InstallReferrer?: InstallReferrerNative }).InstallReferrer;
  if (!native) {
    return;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      native.getAttributionCode(),
      new Promise<null>(resolve => {
        timer = setTimeout(() => resolve(null), TIMEOUT_MS);
      }),
    ]);
    code = typeof value === 'string' && CODE_SHAPE.test(value) ? value : null;
  } catch {
    code = null;
  } finally {
    clearTimeout(timer);
  }
}

/** `{ attribution_code }` when a code is held, otherwise `{}` (the request body is then exactly as before). */
export function getAttributionFields(): AttributionFields {
  return code ? { attribution_code: code } : {};
}

/** Forgets the code once an account-creation call has carried it. */
export function clearAttributionCode(): void {
  code = null;
}

/** Test helper. */
export function _resetAttributionForTesting(): void {
  code = null;
  started = false;
}
