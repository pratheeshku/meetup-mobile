import { toHttpsUrl } from './httpsUrl';

// ':' and '/' are excluded from the local part so a scheme-prefixed value
// (`mailto:x@y.com`) is not mistaken for an address.
const EMAIL = /^[^\s@:/]+@[^\s@.]+(\.[^\s@.]+)+$/;

/**
 * Turns the configured support contact into something `Linking.openURL` can
 * open: a valid `https://` URL as is, a plain email address as a `mailto:`
 * link, `null` for anything else (empty, `http://`, other schemes, malformed).
 */
export function toSupportLink(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  const url = toHttpsUrl(trimmed);
  if (url) {
    return url;
  }
  return EMAIL.test(trimmed) ? `mailto:${trimmed}` : null;
}
