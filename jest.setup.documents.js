/* eslint-env jest */
// te-a3: document picker and file store wrap native modules that do not exist under Jest.
jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(),
  saveDocuments: jest.fn().mockResolvedValue([]),
  types: { xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
  isErrorWithCode: (error) => Boolean(error && typeof error === 'object' && 'code' in error),
}));
jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    fs: { dirs: { CacheDir: '/cache' }, writeFile: jest.fn().mockResolvedValue(undefined), unlink: jest.fn().mockResolvedValue(undefined) },
    ios: { presentOptionsMenu: jest.fn() },
  },
}));
