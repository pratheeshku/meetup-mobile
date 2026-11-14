/**
 * Build-time environment selection (Task 3.1, AD-9 staging pipeline).
 *
 * `APP_ENV` is injected at build time through react-native-config: the Android
 * `staging` / `production` Gradle flavors set it as a BuildConfig field, and the
 * iOS build writes it into the build-time `.env`. Unset or `production` keeps the
 * existing production values; `staging` uses `environments.staging` in
 * `config/appConfig.json`, the single source for every staging value (the Gradle
 * build and `scripts/ios-set-environment.rb` read the same block).
 *
 * Any other value throws, so a typo can never silently build a production app.
 */
import appConfig from './appConfig.json';

export type AppEnvName = 'production' | 'staging';

export interface EnvironmentValues {
  appEnv: AppEnvName;
  apiBaseUrl: string;
  avatarBucketBaseUrl: string;
  privacyPolicyUrl: string;
  termsOfUseUrl: string;
  /** Host this build claims for verified `/l/` app links (deep-links AD-1, AD-4). */
  linkHost: string;
}

export interface EnvironmentOverrides {
  apiBaseUrl?: string;
  avatarBucketBaseUrl?: string;
}

// Production defaults. The API host follows docs/ENVIRONMENTS.md and the iOS config
// (OI-18, Task 3.3); the avatar bucket default is unchanged from the former config/env.ts literal.
export const PRODUCTION_API_BASE_URL = 'https://meetupaws.duckdns.org';
export const PRODUCTION_AVATAR_BUCKET_BASE_URL = 'https://meetup.hel1.your-objectstorage.com';

/**
 * Resolves the values for `appEnv`. `overrides` (the optional `.env`
 * `API_BASE_URL` / `AVATAR_BUCKET_BASE_URL`) apply to production only; staging
 * always uses its fixed values so a stray production URL in `.env` cannot
 * redirect a staging build. Reads appConfig on every call (no caching).
 */
export function selectEnvironment(
  appEnv: string | null | undefined,
  overrides: EnvironmentOverrides = {},
): EnvironmentValues {
  if (appEnv === undefined || appEnv === null || appEnv === '' || appEnv === 'production') {
    return {
      appEnv: 'production',
      apiBaseUrl: overrides.apiBaseUrl ?? PRODUCTION_API_BASE_URL,
      avatarBucketBaseUrl: overrides.avatarBucketBaseUrl ?? PRODUCTION_AVATAR_BUCKET_BASE_URL,
      privacyPolicyUrl: appConfig.privacyPolicyUrl,
      termsOfUseUrl: appConfig.termsOfUseUrl,
      linkHost: appConfig.linkHost,
    };
  }
  if (appEnv === 'staging') {
    const staging = appConfig.environments.staging;
    return {
      appEnv: 'staging',
      apiBaseUrl: staging.apiBaseUrl,
      avatarBucketBaseUrl: staging.avatarBucketBaseUrl,
      privacyPolicyUrl: staging.privacyPolicyUrl,
      termsOfUseUrl: staging.termsOfUseUrl,
      linkHost: staging.linkHost,
    };
  }
  throw new Error(`Unknown APP_ENV "${appEnv}" (expected "production" or "staging")`);
}

// Hosts the app already accepted for in-app https links in production, kept so
// production does not narrow. Staging accepts only its own API host.
export const PRODUCTION_LINK_HOSTS = ['meetups.duckdns.org', 'meetupaws.duckdns.org'];

/**
 * Hostnames accepted for in-app https links: the host of `apiBaseUrl`, plus the
 * legacy production hosts when `appEnv` is production (or unset). Unknown
 * `appEnv` throws, as in `selectEnvironment`.
 */
export function getAllowedLinkHosts(appEnv: string | null | undefined, apiBaseUrl: string): string[] {
  const { appEnv: resolved } = selectEnvironment(appEnv);
  const hosts: string[] = [];
  try {
    hosts.push(new URL(apiBaseUrl).hostname);
  } catch {
    // unparseable base URL: contributes no host
  }
  if (resolved === 'production') {
    hosts.push(...PRODUCTION_LINK_HOSTS);
  }
  return Array.from(new Set(hosts));
}
