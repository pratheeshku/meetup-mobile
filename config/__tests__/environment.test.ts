/**
 * Build-time environment selection (Task 3.1): production is the default and
 * unchanged; staging uses environments.staging in appConfig.json.
 */
import appConfig from '../appConfig.json';
import {
  getAllowedLinkHosts,
  PRODUCTION_API_BASE_URL,
  PRODUCTION_AVATAR_BUCKET_BASE_URL,
  selectEnvironment,
} from '../environment';

const fs = jest.requireActual('fs') as { readFileSync(file: string, enc: 'utf8'): string };

describe('selectEnvironment', () => {
  it.each([undefined, null, '', 'production'])('%p selects production with the existing values', value => {
    expect(selectEnvironment(value)).toEqual({
      appEnv: 'production',
      apiBaseUrl: 'https://meetupaws.duckdns.org',
      avatarBucketBaseUrl: 'https://meetup.hel1.your-objectstorage.com',
      privacyPolicyUrl: 'https://meetupaws.duckdns.org/privacy',
      termsOfUseUrl: 'https://meetupaws.duckdns.org/terms',
      linkHost: 'meetupaws.duckdns.org',
    });
    expect(PRODUCTION_API_BASE_URL).toBe('https://meetupaws.duckdns.org');
    expect(PRODUCTION_AVATAR_BUCKET_BASE_URL).toBe('https://meetup.hel1.your-objectstorage.com');
  });

  it('production keeps the optional .env overrides, including an explicit empty value', () => {
    const selected = selectEnvironment('production', { apiBaseUrl: 'https://x.test', avatarBucketBaseUrl: '' });
    expect(selected.apiBaseUrl).toBe('https://x.test');
    expect(selected.avatarBucketBaseUrl).toBe('');
  });

  it('staging uses the staging values', () => {
    expect(selectEnvironment('staging')).toEqual({
      appEnv: 'staging',
      apiBaseUrl: 'https://meetupstg.duckdns.org',
      avatarBucketBaseUrl: '',
      privacyPolicyUrl: 'https://meetupstg.duckdns.org/privacy',
      termsOfUseUrl: 'https://meetupstg.duckdns.org/terms',
      linkHost: 'meetupstg.duckdns.org',
    });
  });

  it('staging ignores production URL overrides from .env', () => {
    const selected = selectEnvironment('staging', {
      apiBaseUrl: 'https://meetupaws.duckdns.org',
      avatarBucketBaseUrl: 'https://bucket.prod.test',
    });
    expect(selected.apiBaseUrl).toBe('https://meetupstg.duckdns.org');
    expect(selected.avatarBucketBaseUrl).toBe('');
  });

  it('rejects an unknown APP_ENV instead of building production', () => {
    expect(() => selectEnvironment('stagin')).toThrow('Unknown APP_ENV "stagin"');
  });
});

describe('environments.staging in appConfig.json', () => {
  const staging = appConfig.environments.staging;

  it('has the fixed identity values', () => {
    expect(staging.applicationId).toBe('org.duckdns.meetups.staging');
    expect(staging.displayName).toBe('GameOn SG Staging');
    expect(staging.apiBaseUrl).toBe('https://meetupstg.duckdns.org');
  });

  it('privacy and terms use the production paths on the staging host', () => {
    expect(staging.privacyPolicyUrl).toBe(`${staging.apiBaseUrl}${new URL(appConfig.privacyPolicyUrl).pathname}`);
    expect(staging.termsOfUseUrl).toBe(`${staging.apiBaseUrl}${new URL(appConfig.termsOfUseUrl).pathname}`);
  });

  it('URLs are https without a trailing slash (avatar may be empty until the bucket is known)', () => {
    for (const value of [staging.apiBaseUrl, staging.avatarBucketBaseUrl, staging.privacyPolicyUrl, staging.termsOfUseUrl]) {
      expect(value === '' || value.startsWith('https://')).toBe(true);
      expect(value.endsWith('/')).toBe(false);
    }
  });

  it('the Android staging app name matches displayName', () => {
    const xml = fs.readFileSync('android/app/src/staging/res/values/strings.xml', 'utf8');
    expect(xml).toContain(`<string name="app_name">${staging.displayName}</string>`);
  });

  it('the Android flavors keep the production identity and read the staging id from appConfig', () => {
    const gradle = fs.readFileSync('android/app/build.gradle', 'utf8');
    expect(gradle).toContain('applicationId "org.duckdns.meetups"');
    expect(gradle).toContain('applicationId stagingConfig.applicationId');
    expect(gradle).toContain('namespace "com.meetupmobile"');
    expect(gradle).toContain('"build_config_package", "com.meetupmobile"');
  });
});

describe('getAllowedLinkHosts', () => {
  it.each([undefined, '', 'production'])('%p: API host plus both production hosts', value => {
    const hosts = getAllowedLinkHosts(value, 'https://meetupaws.duckdns.org');
    expect(hosts).toContain('meetups.duckdns.org');
    expect(hosts).toContain('meetupaws.duckdns.org');
    expect(hosts).not.toContain('meetupstg.duckdns.org');
  });

  it('production with an overridden API host still accepts the legacy hosts', () => {
    const hosts = getAllowedLinkHosts('production', 'https://other.test');
    expect(hosts).toEqual(expect.arrayContaining(['other.test', 'meetups.duckdns.org', 'meetupaws.duckdns.org']));
  });

  it('staging accepts only the staging API host (meetups link rejected, meetupstg accepted)', () => {
    const hosts = getAllowedLinkHosts('staging', selectEnvironment('staging').apiBaseUrl);
    expect(hosts).toEqual(['meetupstg.duckdns.org']);
  });
});
