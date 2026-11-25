/**
 * App update decision and the device-only "Later" record (DES-MEETUP-ADDENDUM-app-update-prompt AD-7, AD-8, AD-9, 4.3).
 *
 * Order, per platform: no policy or unreadable installed build: nothing (fails open). Installed below the minimum:
 * block (required wins). Installed below the latest and not suppressed by a Later for that same latest build within
 * the reminder interval: prompt. Otherwise nothing.
 *
 * The Later record (time and the latest build it dismissed) is kept on the device only. It is not a secret and is
 * never sent anywhere (Security, "Device data").
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PlatformVersionPolicy } from '../api/versionPolicy';

export type UpdateDecision =
  | { kind: 'none' }
  | { kind: 'block'; storeUrl: string | null }
  | { kind: 'prompt'; storeUrl: string | null; latestBuild: number };

export interface LaterRecord {
  /** Epoch milliseconds when Later was tapped. */
  at: number;
  /** The latest build the prompt offered when Later was tapped. */
  latestBuild: number;
}

const HOUR_MS = 60 * 60 * 1000;

export const NO_UPDATE: UpdateDecision = { kind: 'none' };

export function decideUpdate(
  policy: PlatformVersionPolicy | null,
  installed: number | null,
  later: LaterRecord | null,
  reminderHours: number,
  nowMs: number,
): UpdateDecision {
  if (!policy || installed === null) {
    return NO_UPDATE;
  }
  if (policy.minBuild > 0 && installed < policy.minBuild) {
    return { kind: 'block', storeUrl: policy.storeUrl };
  }
  if (policy.latestBuild > 0 && installed < policy.latestBuild) {
    const suppressed =
      later !== null &&
      later.latestBuild === policy.latestBuild &&
      nowMs >= later.at &&
      nowMs - later.at < reminderHours * HOUR_MS;
    return suppressed ? NO_UPDATE : { kind: 'prompt', storeUrl: policy.storeUrl, latestBuild: policy.latestBuild };
  }
  return NO_UPDATE;
}

export const LATER_STORAGE_KEY = 'app_update.later';

/** The stored Later record, or null when none or unreadable. Never rejects. */
export async function loadLater(): Promise<LaterRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(LATER_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    const { at, latestBuild } = parsed as Record<string, unknown>;
    if (typeof at !== 'number' || !Number.isFinite(at) || typeof latestBuild !== 'number' || !Number.isSafeInteger(latestBuild)) {
      return null;
    }
    return { at, latestBuild };
  } catch {
    return null;
  }
}

/** Records a Later tap. A failed write only means the prompt may come back sooner. Never rejects. */
export async function saveLater(record: LaterRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(LATER_STORAGE_KEY, JSON.stringify(record));
  } catch {
    console.log('[update] could not record Later');
  }
}
