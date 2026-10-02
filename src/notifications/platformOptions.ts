/**
 * Platform-specific `displayNotification` options shared by
 * `participantHandler.ts` and `eventNotificationHandler.ts`
 * (DES-MEETUP-ADDENDUM-IOS-App.md §3, §4).
 *
 * iOS: a notification displayed while the app is in the foreground is shown
 * as a banner, kept in Notification Center, and plays a sound. No category
 * and no action buttons — rich iOS notifications are deferred (D-M1).
 *
 * Android: returns nothing, so the handlers' output is unchanged (their
 * `android:` block stays the only platform block).
 */
import { Platform } from 'react-native';
import type { NotificationIOS } from 'react-native-notify-kit';

export function platformNotificationOptions(): { ios?: NotificationIOS } {
  if (Platform.OS !== 'ios') {
    return {};
  }
  return {
    ios: {
      foregroundPresentationOptions: { banner: true, sound: true, list: true },
    },
  };
}
