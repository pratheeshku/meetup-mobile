module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      [
        '@react-native',
        '@react-native-async-storage',
        'react-native',
        '@react-navigation',
        'react-native-screens',
        'react-native-safe-area-context',
        'react-native-keychain',
        'react-native-svg',
        'react-native-qrcode-svg',
        'react-native-uuid',
        'react-native-image-picker',
        '@d11/react-native-fast-image',
      ].join('|') +
      ')/)',
  ],
};
