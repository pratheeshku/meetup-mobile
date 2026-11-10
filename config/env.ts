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

import { getAllowedLinkHosts, selectEnvironment } from './environment';

// Build-time environment (production unless the build sets APP_ENV=staging).
// See config/environment.ts.
const selected = selectEnvironment(Config.APP_ENV, {
  apiBaseUrl: Config.API_BASE_URL,
  avatarBucketBaseUrl: Config.AVATAR_BUCKET_BASE_URL,
});

export const ENV = {
  APP_ENV: selected.appEnv,
  API_BASE_URL: selected.apiBaseUrl,
  CORRELATION_ID_HEADER: 'X-Correlation-ID',
  // OAuth client ID for Google Sign-In (R-010, R-018). Never a secret in
  // the OAuth-client sense (it's not a client *secret*), but still kept
  // config-driven rather than hardcoded per P1/§3.11.
  GOOGLE_WEB_CLIENT_ID:
    Config.GOOGLE_WEB_CLIENT_ID ||
    '716110883386-504n10sm8npuuo2gfeku7epst0j353kl.apps.googleusercontent.com',
  GOOGLE_IOS_CLIENT_ID:
    Config.GOOGLE_IOS_CLIENT_ID ??
    '716110883386-r4vaffejschrqg9c5qqo0u0esuds4p4d.apps.googleusercontent.com',
  // Hetzner Object Storage bucket base URL for avatar images
  // (DES-MEETUP-ADDENDUM-profile-photo §5, §10.1; P1 — config-driven,
  // never hardcoded). `avatar_storage_key` from the backend is appended
  // to this to form the full display URL. Config-overridable via .env,
  // same as API_BASE_URL.
  AVATAR_BUCKET_BASE_URL: selected.avatarBucketBaseUrl,
  // Perf-diagnostics build flag (perf-diagnostics task).
  // Set PERF_LOG=true in .env to enable the diagnostics layer at build time.
  // Default empty = OFF. Parsed explicitly (not truthy-cast) to avoid the
  // "false" string being truthy under naive boolean coercion.
  PERF_LOG: Config.PERF_LOG ?? '',
};

// Read live from appConfig (not cached in ENV) so the legal links follow the
// build environment: production values are the top-level appConfig URLs.
export const getPrivacyPolicyUrl = (): string =>
  selectEnvironment(Config.APP_ENV).privacyPolicyUrl;
export const getTermsOfUseUrl = (): string => selectEnvironment(Config.APP_ENV).termsOfUseUrl;

/** Hostnames accepted for in-app https links in this build (see config/environment.ts). */
export const getAllowedLinkHostnames = (): string[] =>
  getAllowedLinkHosts(Config.APP_ENV, ENV.API_BASE_URL);
