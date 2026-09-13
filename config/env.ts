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
};
