/**
 * Environment configuration.
 *
 * Config-driven per Enterprise Design Principle P1 — nothing here is a
 * hardcoded credential or secret. `API_BASE_URL` defaults to the platform's
 * production base URL and can be overridden via the `API_BASE_URL`
 * environment variable at build time (see DES-MEETUP-MOBILE.md §3.11 for
 * the CI-time secrets-injection path; this file itself never carries a
 * secret value).
 */

export const ENV = {
  API_BASE_URL: process.env.API_BASE_URL ?? 'https://meetups.duckdns.org',
  CORRELATION_ID_HEADER: 'X-Correlation-ID',
};
