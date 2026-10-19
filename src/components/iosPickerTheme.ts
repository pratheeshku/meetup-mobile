/**
 * Explicit iOS theming for `@react-native-community/datetimepicker` spinners.
 *
 * Task ios-datepicker-fix (option C): on iOS 27.0.1 / iPhone 16 the spinner
 * wheels render invisible. Cause is unproven; we pin a light variant and a
 * theme-token text colour so the wheel never depends on system appearance.
 * Every picker sits on a light `colors.surface` container.
 *
 * Returns `{}` on non-iOS so Android code paths receive no new props.
 */
import { Platform } from 'react-native';

import { colors } from '../theme/tokens';

export function iosPickerThemeProps(): { themeVariant?: 'light'; textColor?: string } {
  if (Platform.OS !== 'ios') {
    return {};
  }
  return { themeVariant: 'light', textColor: colors.textPrimary };
}
