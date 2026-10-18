/**
 * pa-spike (THROWAWAY, dev builds only, never merged): can a notification
 * action tapped on a locked phone with the app killed obtain a session and
 * call the backend? See docs/reports/pa-spike-build.md.
 *
 * Everything here is reached only from `__DEV__` call sites. No unit tests.
 * No token, title, body or id is ever logged or stored: the result log holds
 * platform, attempt, state label, variant, success flag, elapsed ms and the
 * failing step / error class only.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, {
  AlarmType,
  AndroidImportance,
  EventType,
  TriggerType,
} from 'react-native-notify-kit';
import type { Event } from 'react-native-notify-kit';
import { apiClient, refreshAccessToken, SessionEndedError } from '../api/client';
import { withCorrelationId } from '../api/correlationId';
import { handleEventNotificationEvent } from '../notifications/eventNotificationHandler';

export type SpikeState = 'unlocked' | 'locked' | 'killed';
export const SPIKE_STATES: SpikeState[] = ['unlocked', 'locked', 'killed'];

const CHANNEL_ID = 'pa_spike';
const ACCEPT_ID = 'pa_accept';
const IGNORE_ID = 'pa_ignore';
const CATEGORY_PLAIN = 'pa_spike';
const CATEGORY_AUTH = 'pa_spike_auth';
const LOG_KEY = 'pa_spike_log';
const ATTEMPT_KEY = 'pa_spike_attempts';
const READ_ONLY_PATH = '/notifications/unread-count';

/** One per-state counter, e.g. `unlocked|plain`, so each matrix cell counts 1..10. */
type Attempts = Record<string, number>;

export interface SpikeLine {
  platform: string;
  attempt: number;
  state: SpikeState;
  variant: 'plain' | 'auth';
  ok: boolean;
  ms: number;
  failStep: string; // '' when ok
  errClass: string; // '' when ok
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function getSpikeLog(): Promise<SpikeLine[]> {
  return readJson<SpikeLine[]>(LOG_KEY, []);
}

export async function clearSpikeLog(): Promise<void> {
  await AsyncStorage.removeItem(LOG_KEY);
  await AsyncStorage.removeItem(ATTEMPT_KEY);
}

async function appendLine(line: SpikeLine): Promise<void> {
  const log = await getSpikeLog();
  log.push(line);
  await AsyncStorage.setItem(LOG_KEY, JSON.stringify(log));
}

export function formatLine(l: SpikeLine): string {
  const result = l.ok ? 'OK' : `FAIL ${l.failStep} ${l.errClass}`;
  return `${l.platform} ${l.variant} ${l.state} #${l.attempt} ${result} ${l.ms}ms`;
}

/** Status / axios code / error name only; never message or response data. */
function classifyError(error: unknown): string {
  if (error instanceof SessionEndedError) {
    return `session_${error.reason}`;
  }
  const e = error as { isAxiosError?: boolean; response?: { status?: number }; code?: string; name?: string };
  if (e?.isAxiosError) {
    return e.response?.status ? `http_${e.response.status}` : `net_${e.code ?? 'unknown'}`;
  }
  // Not an HTTP error: in this flow that means the Keychain write inside
  // refreshAccessToken() (saveTokens) or another native module call.
  return `nonhttp_${e?.name ?? 'unknown'}`;
}

/** iOS categories (same two actions, background). Safe to call repeatedly. */
export async function registerSpikeCategories(): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }
  const actions = (authRequired: boolean) => [
    { id: ACCEPT_ID, title: 'Accept (test)', foreground: false, authenticationRequired: authRequired },
    { id: IGNORE_ID, title: 'Ignore', foreground: false },
  ];
  await notifee.setNotificationCategories([
    { id: CATEGORY_PLAIN, actions: actions(false) },
    { id: CATEGORY_AUTH, actions: actions(true) },
  ]);
}

export async function scheduleSpikeNotification(
  seconds: number,
  state: SpikeState,
  variant: 'plain' | 'auth',
): Promise<number> {
  await notifee.requestPermission();
  if (Platform.OS === 'android') {
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: 'PA spike',
      importance: AndroidImportance.HIGH,
    });
  } else {
    await registerSpikeCategories();
  }

  const attempts = await readJson<Attempts>(ATTEMPT_KEY, {});
  const key = `${state}|${variant}`;
  const attempt = (attempts[key] ?? 0) + 1;
  attempts[key] = attempt;
  await AsyncStorage.setItem(ATTEMPT_KEY, JSON.stringify(attempts));

  await notifee.createTriggerNotification(
    {
      title: 'PA spike',
      body: 'Tap Accept (test). Do not open the app.',
      data: { pa_spike: '1', state, variant, attempt: String(attempt) },
      android: {
        channelId: CHANNEL_ID,
        // No launchActivity: the action buttons must not open the app.
        pressAction: { id: 'default' },
        actions: [
          { title: 'Accept (test)', pressAction: { id: ACCEPT_ID } },
          { title: 'Ignore', pressAction: { id: IGNORE_ID } },
        ],
      },
      ios: {
        categoryId: variant === 'auth' ? CATEGORY_AUTH : CATEGORY_PLAIN,
        foregroundPresentationOptions: { banner: true, sound: true, list: true },
      },
    },
    {
      type: TriggerType.TIMESTAMP,
      timestamp: Date.now() + seconds * 1000,
      alarmManager: { type: AlarmType.SET_AND_ALLOW_WHILE_IDLE },
    },
  );
  return attempt;
}

let acceptInFlight = false;

async function runAccept(event: Event): Promise<void> {
  const notification = event.detail.notification;
  const data = notification?.data ?? {};
  const state = (SPIKE_STATES as string[]).includes(String(data.state))
    ? (data.state as SpikeState)
    : 'unlocked';
  const variant = data.variant === 'auth' ? 'auth' : 'plain';
  const attempt = Number(data.attempt) || 0;

  if (acceptInFlight) {
    return;
  }
  acceptInFlight = true;
  const t0 = Date.now();
  let failStep = '';
  let errClass = '';
  try {
    await withCorrelationId(async correlationId => {
      failStep = 'refresh';
      // Keeps the token in memory only; refreshAccessToken() itself still
      // persists it via saveTokens() (unmodified client, see build doc).
      const token = await refreshAccessToken();

      failStep = 'read';
      // READ-ONLY endpoint. The Authorization header carries the in-memory
      // token; the request interceptor replaces it only if the Keychain read
      // succeeds, and keeps it when the read fails (locked device).
      await apiClient.get(READ_ONLY_PATH, {
        correlationId,
        headers: { Authorization: `Bearer ${token}` },
      });
      failStep = '';
    });
  } catch (error) {
    errClass = classifyError(error);
  } finally {
    acceptInFlight = false;
  }

  const ms = Date.now() - t0;
  const line: SpikeLine = {
    platform: Platform.OS,
    attempt,
    state,
    variant,
    ok: failStep === '',
    ms,
    failStep,
    errClass,
  };
  try {
    await appendLine(line);
  } catch {
    // Log write failure must not hide the result notification.
  }

  try {
    if (notification?.id) {
      await notifee.cancelNotification(notification.id);
    }
    await notifee.displayNotification({
      title: line.ok
        ? `OK ${ms} ${line.platform} ${state}`
        : `FAIL ${failStep} ${errClass} ${ms}`,
      android: { channelId: CHANNEL_ID, pressAction: { id: 'default' } },
      ios: { foregroundPresentationOptions: { banner: true, sound: true, list: true } },
    });
  } catch {
    // Nothing more to do; the on-device log already has the line.
  }
}

/** Handles pa-spike action presses. Returns true when the event was ours. */
export async function handleSpikeEvent(event: Event): Promise<boolean> {
  if (event.detail.notification?.data?.pa_spike !== '1') {
    return false;
  }
  const actionId = event.detail.pressAction?.id;
  if (event.type === EventType.ACTION_PRESS && actionId === ACCEPT_ID) {
    await runAccept(event);
  } else if (event.type === EventType.ACTION_PRESS && actionId === IGNORE_ID) {
    if (event.detail.notification?.id) {
      await notifee.cancelNotification(event.detail.notification.id);
    }
  }
  return true;
}

/**
 * notify-kit keeps ONE background handler (the last `onBackgroundEvent` call
 * wins). index.js already registers two; this replaces them in dev builds
 * with a wrapper that handles spike events first and otherwise delegates to
 * the handler that is effective today (the event handler, registered last).
 */
export function registerSpikeBackgroundHandler(): void {
  notifee.onBackgroundEvent(async event => {
    if (!(await handleSpikeEvent(event))) {
      await handleEventNotificationEvent(event);
    }
  });
  registerSpikeCategories().catch(() => {});
}
