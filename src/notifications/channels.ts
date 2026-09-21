/**
 * Android notification channels for locally-built notifications
 * (DES-MEETUP-MOBILE.md §3.6 — `notifee` renders foreground/data-only
 * notifications; `react-native-notify-kit` is the maintained drop-in for the
 * archived `@notifee/react-native`).
 *
 * `createChannel` is idempotent, so `createNotificationChannels()` is safe to
 * call on every app start (`index.js`). Channels must exist before a
 * notification that references them is displayed (Android 8+).
 */
import notifee, { AndroidImportance } from 'react-native-notify-kit';

export const PLAN_CHANNEL_ID = 'plan';

export async function createNotificationChannels(): Promise<void> {
  await notifee.createChannel({
    id: PLAN_CHANNEL_ID,
    name: 'Plans & Updates',
    importance: AndroidImportance.HIGH,
  });
}
