import { Platform } from 'react-native';

import { colors } from '../../theme/tokens';
import { iosPickerThemeProps } from '../iosPickerTheme';

describe('iosPickerThemeProps', () => {
  const original = Platform.OS;
  afterEach(() => {
    Platform.OS = original;
  });

  it('returns light themeVariant and theme-token textColor on iOS', () => {
    Platform.OS = 'ios';
    expect(iosPickerThemeProps()).toEqual({
      themeVariant: 'light',
      textColor: colors.textPrimary,
    });
  });

  it('returns no props on Android', () => {
    Platform.OS = 'android';
    expect(iosPickerThemeProps()).toEqual({});
  });
});
