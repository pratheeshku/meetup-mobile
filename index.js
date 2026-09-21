/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerBackgroundMessageHandler } from './src/notifications/fcm';
import { createNotificationChannels } from './src/notifications/channels';
import { registerParticipantBackgroundHandler } from './src/notifications/participantHandler';

// FCM requires the background handler to be registered at top level, outside
// any React lifecycle, so it exists when a message wakes the JS runtime before
// (or without) any component mounting. It only acts on the data-only
// participant notification types (see fcm.ts).
registerBackgroundMessageHandler();

// Notification channel(s) must exist before any notification that references
// them is displayed. Idempotent; a failure here surfaces later as a display
// failure, which the FCM handlers already contain.
createNotificationChannels().catch(() => {});

// notify-kit background/quit-state press handler (View / OK buttons). Like the
// FCM handler it must be registered at top level, outside any React lifecycle.
registerParticipantBackgroundHandler();

AppRegistry.registerComponent(appName, () => App);
