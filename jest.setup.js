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
