/**
 * Which URL the force-update "Update" button may open.
 *
 * The backend supplies `store_url`, so it is untrusted input. It is used only
 * if it is an `https` URL whose host is EXACTLY `play.google.com`; anything
 * else falls back to the Play Store page for this app.
 *
 * Validated with a strict pattern rather than `new URL(...)`: React Native's
 * `URL` polyfill does not implement host parsing. The pattern accepts nothing
 * but `https://play.google.com` optionally followed by a `/path...`, so a
 * userinfo section (`https://play.google.com@evil.com`), a port, a look-alike
 * host (`play.google.com.evil.com`), a backslash, whitespace or control
 * characters can never match. Matching is deliberately case-sensitive: an
 * unusual spelling falls back to the known-good page, which is harmless.
 */

/** Play Store page for this app (`applicationId` org.duckdns.meetups). */
export const PLAY_STORE_FALLBACK_URL =
  'https://play.google.com/store/apps/details?id=org.duckdns.meetups';

const MAX_URL_LENGTH = 2048;

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
  return isAllowedStoreUrl(candidate) ? candidate : PLAY_STORE_FALLBACK_URL;
}
