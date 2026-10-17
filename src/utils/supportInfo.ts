/**
 * Support text for Settings (long-press on the version line): exactly five lines
 * of app, server, device and OS facts (the OS line is Android or iOS by `Platform.OS`). No user id, name, email, phone, token,
 * device id, push token or IP address — keep it that way.
 */
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

import { ENV } from '../../config/env';

export const HEALTH_TIMEOUT_MS = 3000;
const UNKNOWN = 'unknown';
const MAX_VALUE_LENGTH = 64;

/** Runs a DeviceInfo read; any error or empty value gives "unknown". */
function safe(read: () => unknown): string {
  try {
    return clean(read());
  } catch {
    return UNKNOWN;
  }
}

/** One-line, trimmed, length-limited text; anything else is "unknown". */
function clean(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return UNKNOWN;
  }
  const text = String(value).replace(/\s+/g, ' ').trim().slice(0, MAX_VALUE_LENGTH);
  return text.length > 0 ? text : UNKNOWN;
}

export function getAppVersion(): { version: string; build: string } {
  return {
    version: safe(() => DeviceInfo.getVersion()),
    build: safe(() => DeviceInfo.getBuildNumber()),
  };
}

/** `GET {API base}/health`, best effort, 3 s. Resolves "unknown" on any failure or missing field. */
export async function fetchServerVersion(): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(`${ENV.API_BASE_URL}/health`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      return UNKNOWN;
    }
    const body = (await response.json()) as Record<string, unknown> | null;
    return clean(body?.version ?? body?.server_version ?? body?.app_version);
  } catch {
    return UNKNOWN;
  } finally {
    clearTimeout(timer);
  }
}

export async function buildSupportText(now: Date = new Date()): Promise<string> {
  const { version, build } = getAppVersion();
  const server = await fetchServerVersion();
  const brand = safe(() => DeviceInfo.getBrand());
  const model = safe(() => DeviceInfo.getModel());
  const systemVersion = safe(() => DeviceInfo.getSystemVersion());
  let osLine: string;
  if (Platform.OS === 'ios') {
    osLine = `iOS: ${systemVersion}`;
  } else {
    let apiLevel = UNKNOWN;
    try {
      apiLevel = clean(await DeviceInfo.getApiLevel());
    } catch {
      apiLevel = UNKNOWN;
    }
    osLine = `Android: ${systemVersion} (API ${apiLevel})`;
  }
  return [
    `App: ${version} (${build})`,
    `Server: ${server}`,
    `Device: ${brand} ${model}`,
    osLine,
    `Time: ${now.toISOString()}`,
  ].join('\n');
}
