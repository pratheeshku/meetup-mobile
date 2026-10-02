/**
 * Client-side phone helpers for the mobile number picker
 * (DES-MEETUP-ADDENDUM-profile-onboarding.md AD-1, AD-9). `libphonenumber-js`
 * (exact-pinned) builds E.164 from the chosen country code plus the national
 * number; the server remains the validator (it re-parses and may reject with
 * 422), so the client only uses the looser `isPossible()` check, for UX.
 *
 * The number is PII: nothing here logs it or returns it from an error path.
 */
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import type { CountryCode as Iso2 } from 'libphonenumber-js';

import type { CountryCode } from '../api/mobileNumber';

/** Digits only: spaces, dashes, brackets and a stray leading "+" are dropped. */
export function nationalDigits(input: string): string {
  return input.replace(/\D/g, '');
}

function dialDigits(country: CountryCode): string {
  return country.dial_code.replace(/\D/g, '');
}

function safeParse(input: string, iso2?: string) {
  try {
    return parsePhoneNumberFromString(input, iso2 as Iso2 | undefined);
  } catch {
    return undefined;
  }
}

/**
 * E.164 for `country` + `national`, or `null` when empty or not even
 * possible. A number typed in a way that resolves to a different calling
 * code than the chosen one is rebuilt from the chosen code.
 */
export function buildE164(country: CountryCode, national: string): string | null {
  const digits = nationalDigits(national);
  if (digits.length === 0) {
    return null;
  }
  const dial = dialDigits(country);
  let parsed = safeParse(digits, country.iso2);
  if (!parsed || parsed.countryCallingCode !== dial) {
    parsed = safeParse(`+${dial}${digits}`);
  }
  return parsed && parsed.isPossible() ? parsed.number : null;
}

export interface SplitNumber {
  country: CountryCode;
  /** National part, digits only (what the text field shows). */
  national: string;
}

/**
 * Preselects the country for a stored E.164 number from its dial code
 * (AD-9). Order of preference:
 * 1. the country libphonenumber resolves for the number, if it is in the list
 *    (e.g. +44 7700 900123 -> GB, +1 212 ... -> US);
 * 2. the only country with that dial code;
 * 3. several countries share the code and none resolves: the default
 *    country if it is one of them, otherwise the first of them in list
 *    order — never a country with a different code, which would change the
 *    number on re-save (Proposed Assumption, see the Implementation Report);
 * 4. no country has that dial code: the default country, national = digits.
 *
 * `countries[0]` is the default (the server's first row).
 */
export function splitE164(e164: string, countries: readonly CountryCode[]): SplitNumber | null {
  const defaultCountry = countries[0];
  if (!defaultCountry) {
    return null;
  }
  const parsed = safeParse(e164);
  if (!parsed) {
    return { country: defaultCountry, national: nationalDigits(e164) };
  }
  const national = parsed.nationalNumber;
  const dial = parsed.countryCallingCode;

  const resolved = parsed.country
    ? countries.find(country => country.iso2 === parsed.country && dialDigits(country) === dial)
    : undefined;
  if (resolved) {
    return { country: resolved, national };
  }

  const sharing = countries.filter(country => dialDigits(country) === dial);
  if (sharing.length === 0) {
    return { country: defaultCountry, national: nationalDigits(e164) };
  }
  if (sharing.length === 1) {
    return { country: sharing[0], national };
  }
  const chosen = sharing.includes(defaultCountry) ? defaultCountry : sharing[0];
  return { country: chosen, national };
}

/** "SG +65" — ISO code and dial code, no emoji flags (AD-9). */
export function countryLabel(country: CountryCode): string {
  return `${country.iso2} ${country.dial_code}`;
}
