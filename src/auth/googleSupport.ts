import { Platform } from 'react-native';

/**
 * Google sign-in is offered on Android only (DES-MEETUP-ADDENDUM-IOS-App.md
 * §3, AD-iOS-M2). On iOS the button is not rendered and the native module is
 * never configured or called.
 */
export function isGoogleSignInAvailable(): boolean {
  return Platform.OS !== 'ios';
}
