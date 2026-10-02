/**
 * Returns `value` trimmed when it is an `https://` URL with something after
 * the scheme and no whitespace inside; `null` for anything else (empty,
 * `http://`, other schemes, malformed). Only `https://` URLs are ever opened
 * from configuration (DES-MEETUP-ADDENDUM-IOS-App.md §7).
 */
export function toHttpsUrl(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return /^https:\/\/\S+$/.test(trimmed) ? trimmed : null;
}
