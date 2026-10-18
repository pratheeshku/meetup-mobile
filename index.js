/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerBackgroundMessageHandler } from './src/notifications/fcm';
import { createNotificationChannels } from './src/notifications/channels';
import { registerNotificationBackgroundDispatcher } from './src/notifications/notificationEventDispatcher';
import { registerPushActionCategories } from './src/notifications/pushActions';

// ── Perf diagnostics bootstrap (perf-diagnostics task) ──────────────────────
// Imported as early as possible so `now()` is close to true bundle-start time.
// `resolveRuntimeFlag` is async and non-blocking; the startup buffer (cap 200)
// captures events that fire before it resolves so the boot timeline is preserved.
import {
  perfLog,
  resolveRuntimeFlag,
  startAppStateLogging,
  startStallDetector,
} from './src/diagnostics/perfLog';

perfLog('boot_bundle_start');
resolveRuntimeFlag()
  .then(() => {
    startAppStateLogging();
    startStallDetector();
  })
  .catch(() => {
    // Diagnostics failure must never affect app startup.
  });
// ────────────────────────────────────────────────────────────────────────────

// FCM requires the background handler to be registered at top level, outside
// any React lifecycle, so it exists when a message wakes the JS runtime before
// (or without) any component mounting. It only acts on the data-only
// participant/event notification types (see fcm.ts).
registerBackgroundMessageHandler();

// Notification channel(s) must exist before any notification that references
// them is displayed. Idempotent; a failure here surfaces later as a display
// failure, which the FCM handlers already contain.
createNotificationChannels().catch(() => {});

// notify-kit keeps ONE background handler (the last registration wins), so a
// single dispatcher routes every notification press by notification_type to
// the participant, event and push-action handlers. Like the FCM handler it
// must be registered at top level, outside any React lifecycle.
registerNotificationBackgroundDispatcher();

// iOS action categories (invite_game, invite_tournament, group_added) must be
// registered at every launch, including a background launch from an action.
registerPushActionCategories().catch(() => {});

AppRegistry.registerComponent(appName, () => App);
