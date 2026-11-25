/**
 * Which URL the force-update "Update" button may open.
 *
 * The backend supplies `store_url`, so it is untrusted input. It is used only
 * if it is an `https` URL whose host is EXACTLY `play.google.com`; anything
 * else falls back to the Play Store page for this app. iOS links
 * (app-update-prompt AD-10) allow `apps.apple.com` and `testflight.apple.com`.
 *
 * Validated with a strict pattern rather than `new URL(...)`: React Native's
 * `URL` polyfill does not implement host parsing. The pattern accepts nothing
 * but `https://play.google.com` optionally followed by a `/path...`, so a
 * userinfo section (`https://play.google.com@evil.com`), a port, a look-alike
 * host (`play.google.com.evil.com`), a backslash, whitespace or control
 * characters can never match. Matching is deliberately case-sensitive: an
 * unusual spelling falls back to the known-good page, which is harmless.
 */

import Config from 'react-native-config';

import appConfig from '../../config/appConfig.json';

/** Play Store page for this app (`applicationId` org.duckdns.meetups). */
export const PLAY_STORE_FALLBACK_URL =
  'https://play.google.com/store/apps/details?id=org.duckdns.meetups';

/** Play Store page for the staging app (`applicationId` from config/appConfig.json). */
export const PLAY_STORE_STAGING_FALLBACK_URL = `https://play.google.com/store/apps/details?id=${appConfig.environments.staging.applicationId}`;

/** The built-in Play page for this build's own app id: staging builds use the staging id (app-update-prompt AD-10). */
export function playStoreFallbackUrl(): string {
  return Config.APP_ENV === 'staging' ? PLAY_STORE_STAGING_FALLBACK_URL : PLAY_STORE_FALLBACK_URL;
}

/** App-update-prompt AD-10: an update link is at most 500 characters. */
const MAX_URL_LENGTH = 500;

// `https://play.google.com`, then either the end or a path starting with `/`;
// the path may not contain whitespace or backslashes. Other control
// characters are rejected separately (`hasControlCharacter`).
const ALLOWED_STORE_URL = /^https:\/\/play\.google\.com(?:\/[^\s\\]*)?$/;

function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

/** `true` if `candidate` is an https URL on exactly `play.google.com`. */
export function isAllowedStoreUrl(candidate: unknown): candidate is string {
  return (
    typeof candidate === 'string' &&
    candidate.length <= MAX_URL_LENGTH &&
    !hasControlCharacter(candidate) &&
    ALLOWED_STORE_URL.test(candidate)
  );
}

/** `candidate` if it is allowed, otherwise the Play Store page for this app. */
export function resolveStoreUrl(candidate: unknown): string {
  return isAllowedStoreUrl(candidate) ? candidate : playStoreFallbackUrl();
}

// iOS update links (AD-10): https on exactly apps.apple.com or testflight.apple.com (the staging iOS app is on TestFlight).
const ALLOWED_IOS_STORE_URL = /^https:\/\/(?:apps|testflight)\.apple\.com(?:\/[^\s\\]*)?$/;

/** `true` if `candidate` is an https URL on exactly `apps.apple.com` or `testflight.apple.com`. */
export function isAllowedIosStoreUrl(candidate: unknown): candidate is string {
  return (
    typeof candidate === 'string' &&
    candidate.length <= MAX_URL_LENGTH &&
    !hasControlCharacter(candidate) &&
    ALLOWED_IOS_STORE_URL.test(candidate)
  );
}

/** App Store page of the production app (Apple ID 6818480691, bundle org.duckdns.meetups; AD-10 built-in page). */
export const APP_STORE_FALLBACK_URL = 'https://apps.apple.com/app/id6818480691';

/**
 * The built-in App Store page for this build's own app (AD-10). The staging iOS app is on TestFlight, which has no
 * App Store page, so staging builds have none and use only the admin update link.
 */
export function appStoreFallbackUrl(): string | null {
  return Config.APP_ENV === 'staging' ? null : APP_STORE_FALLBACK_URL;
}

/** The built-in store page for this build's own app id on `platform`, or null when there is none (staging iOS). */
export function storeFallbackUrl(platform: 'android' | 'ios'): string | null {
  return platform === 'android' ? playStoreFallbackUrl() : appStoreFallbackUrl();
}

/**
 * The link the Update button opens for `platform`: the update link when it passes the allow-list, else this build's
 * built-in store page (AD-10). Null only on staging iOS with no valid link.
 */
export function resolveUpdateUrl(platform: 'android' | 'ios', candidate: unknown): string | null {
  if (platform === 'android') {
    return resolveStoreUrl(candidate);
  }
  return isAllowedIosStoreUrl(candidate) ? candidate : appStoreFallbackUrl();
}
