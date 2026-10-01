/** Test-only fixtures for the mobile number tests (shape of the live endpoints). */
import type { CountryCode } from '../api/mobileNumber';

export const COUNTRIES: CountryCode[] = [
  { iso2: 'SG', name: 'Singapore', dial_code: '+65', sort_order: 1, enabled: true },
  { iso2: 'AU', name: 'Australia', dial_code: '+61', sort_order: 2, enabled: true },
  { iso2: 'GB', name: 'United Kingdom', dial_code: '+44', sort_order: 3, enabled: true },
  { iso2: 'GG', name: 'Guernsey', dial_code: '+44', sort_order: 4, enabled: true },
  { iso2: 'IN', name: 'India', dial_code: '+91', sort_order: 5, enabled: true },
  { iso2: 'US', name: 'United States', dial_code: '+1', sort_order: 6, enabled: true },
  { iso2: 'CA', name: 'Canada', dial_code: '+1', sort_order: 7, enabled: true },
];

export const CONSENT = { version: 'mobile-consent-v1', text: 'Optional. Admins may call you.' };

/** A number used across tests; must never appear in a log line. */
export const SECRET_NUMBER = '+6591234567';
