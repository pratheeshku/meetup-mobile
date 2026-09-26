/**
 * Environment configuration.
 *
 * Config-driven per Enterprise Design Principle P1 — nothing here is a
 * hardcoded credential or secret. `API_BASE_URL` defaults to the platform's
 * production base URL and can be overridden via the repo-root `.env` file
 * (see `.env.example`), resolved at native build time by
 * `react-native-config` — plain `process.env` does not resolve at runtime
 * in bare React Native (no Metro/babel env substitution is wired), which
 * is why this reads `Config` instead. See DES-MEETUP-MOBILE.md §3.11 for
 * the CI-time secrets-injection path; this file itself never carries a
 * secret value.
 */
import Config from 'react-native-config';

export const ENV = {
  API_BASE_URL: Config.API_BASE_URL ?? 'https://meetups.duckdns.org',
  CORRELATION_ID_HEADER: 'X-Correlation-ID',
  // OAuth client ID for Google Sign-In (R-010, R-018). Never a secret in
  // the OAuth-client sense (it's not a client *secret*), but still kept
  // config-driven rather than hardcoded per P1/§3.11.
  GOOGLE_WEB_CLIENT_ID: Config.GOOGLE_WEB_CLIENT_ID ?? '',
  // Hetzner Object Storage bucket base URL for avatar images
  // (DES-MEETUP-ADDENDUM-profile-photo §5, §10.1; P1 — config-driven,
  // never hardcoded). `avatar_storage_key` from the backend is appended
  // to this to form the full display URL. Config-overridable via .env,
  // same as API_BASE_URL.
  AVATAR_BUCKET_BASE_URL:
    Config.AVATAR_BUCKET_BASE_URL ?? 'https://meetup.hel1.your-objectstorage.com',
};
