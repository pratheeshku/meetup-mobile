/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerBackgroundMessageHandler } from './src/notifications/fcm';

// FCM requires the background handler to be registered at top level, outside
// any React lifecycle, so it exists when a message wakes the JS runtime before
// (or without) any component mounting. Currently a deliberate no-op.
registerBackgroundMessageHandler();

AppRegistry.registerComponent(appName, () => App);
