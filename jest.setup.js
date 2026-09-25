// react-native-keychain wraps native Keystore/Keychain APIs that don't
// exist in the Jest environment. Mocked here so App-level smoke tests
// don't need a native module bridge; behavioural tests for
// src/storage/tokens.ts should mock this module per-suite instead.
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly' },
  STORAGE_TYPE: { AES_CBC: 'KeystoreAESCBC', AES_GCM_NO_AUTH: 'KeystoreAESGCM_NoAuth' },
  setGenericPassword: jest.fn(async () => ({ service: 'mock', storage: 'KeystoreAESGCM_NoAuth' })),
  getGenericPassword: jest.fn(async () => false),
  resetGenericPassword: jest.fn(async () => true),
}));

// react-native-config reads native BuildConfig/Info.plist values that
// don't exist under Jest — its real index.js throws outright when the
// native TurboModule isn't registered (see its own source). Mocked to an
// empty config object, matching the real "no env injection wired yet"
// runtime behaviour documented in config/env.ts and CLAUDE.md's Stack
// Gotchas (every ENV.* falls through to its hardcoded default).
jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {},
}));

// @react-native-google-signin/google-signin wraps native Credential/Play
// Services APIs with no Jest-environment equivalent. The auth module
// (src/auth/googleAuth.ts) and LoginScreen import it; mocked here per the
// same centralised-native-mock convention as react-native-keychain above
// — add to this mock, not a new ad hoc one per test file, if new APIs
// from this package are used.
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(async () => ({ type: 'cancelled', data: null })),
    signOut: jest.fn(async () => null),
  },
  GoogleSigninButton: Object.assign(() => null, {
    Size: { Icon: 0, Standard: 1, Wide: 2 },
    Color: { Dark: 'dark', Light: 'light' },
  }),
  isSuccessResponse: jest.fn(response => response.type === 'success'),
  isCancelledResponse: jest.fn(response => response.type === 'cancelled'),
}));

// @react-native-firebase/{app,messaging}: wiring the auth module pulls
// src/notifications/fcm.ts (used by googleAuth.signOut's FCM
// de-registration call) into the render tree for the first time. Its
// `getMessaging(getApp())` module-level call needs both mocked.
jest.mock('@react-native-firebase/app', () => ({
  getApp: jest.fn(() => ({})),
}));

// Push-notifications task additions: `onNotificationOpenedApp`,
// `getInitialNotification`, `setBackgroundMessageHandler` — used by
// src/notifications/fcm.ts's new background/quit-tap handlers, wired into
// the render tree via RootNavigator. Added to this same centralised mock
// per this file's own established convention (see the comment above)
// rather than a new ad hoc mock.
jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: jest.fn(() => ({})),
  requestPermission: jest.fn(async () => 1),
  AuthorizationStatus: { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 },
  getToken: jest.fn(async () => 'mock-fcm-token'),
  onTokenRefresh: jest.fn(() => () => {}),
  onMessage: jest.fn(() => () => {}),
  onNotificationOpenedApp: jest.fn(() => () => {}),
  getInitialNotification: jest.fn(async () => null),
  setBackgroundMessageHandler: jest.fn(),
}));

// @react-native-async-storage/async-storage v3 wraps a native module with no
// Jest-environment equivalent. Its own in-memory mock (same package, `./jest`
// export) is registered here, per this file's centralised-native-mock
// convention. Consumers: src/notifications/pushRegistration.ts (rationale
// -shown flag) and src/labels/LabelsContext.tsx (cached GET /api/labels
// response) — never used for tokens (R-014).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);

// react-native-notify-kit (drop-in for the archived @notifee/react-native)
// wraps a native module with no Jest-environment equivalent, and is pulled
// into the tree via src/notifications/fcm.ts → participantHandler.ts. Its own
// shipped `jest-mock.js` is ESM source under node_modules, so an explicit
// mock is used instead of widening transformIgnorePatterns. Enum values match
// the library's real ones (EventType: DISMISSED=0, PRESS=1, ACTION_PRESS=2;
// AndroidImportance.HIGH=4) so tests can't pass on a wrong constant. Add to
// this mock — not a new ad hoc one per test file — if new APIs are used.
//
// `no-undef` is disabled for this block only: ESLint has no jest env for this
// file, so every `jest.` reference is flagged. Scoped (not `eslint-env jest`)
// so the file's older `jest.` references are deliberately left as they were.
/* eslint-disable no-undef */
jest.mock('react-native-notify-kit', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn(async () => 'plan'),
    displayNotification: jest.fn(async () => 'mock-notification-id'),
    cancelNotification: jest.fn(async () => undefined),
    getInitialNotification: jest.fn(async () => null),
    onBackgroundEvent: jest.fn(),
    onForegroundEvent: jest.fn(() => () => {}),
  },
  EventType: { DISMISSED: 0, PRESS: 1, ACTION_PRESS: 2, DELIVERED: 3 },
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  AndroidStyle: { BIGPICTURE: 0, BIGTEXT: 1, INBOX: 2, MESSAGING: 3 },
}));

// react-native-device-info wraps native platform-info APIs (Android ID,
// etc.) with no Jest-environment equivalent. Added for the push-token
// device-scoped-registration bug fix (src/notifications/deviceId.ts).
// Centralised here per this file's established convention — add to this
// mock, not a new ad hoc one per test file, if new APIs from this package
// are used.
jest.mock('react-native-device-info', () => ({
  __esModule: true,
  default: {
    getAndroidId: jest.fn(async () => 'mock-android-id'),
  },
}));

// @react-native-community/datetimepicker wraps native iOS/Android date/time
// picker dialogs with no Jest-environment equivalent. Added to this centralised
// mock per this file's established convention.
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockDateTimePicker = React.forwardRef((props, ref) => {
    return React.createElement(View, {
      ...props,
      ref,
      testID: props.testID || 'dateTimePicker',
    });
  });
  MockDateTimePicker.displayName = 'MockDateTimePicker';

  return {
    __esModule: true,
    default: MockDateTimePicker,
    DateTimePickerAndroid: {
      open: jest.fn(),
      dismiss: jest.fn(),
    },
  };
});
/* eslint-enable no-undef */
