/**
 * `config/appConfig.json` is the single source for the display name and the
 * iOS version / build number. The native project cannot import it, so this
 * guards the checked-in iOS defaults against drifting from it
 * (DES-MEETUP-ADDENDUM-IOS-App.md §5, §7).
 */
import appConfig from '../appConfig.json';

// No Node typings in this RN project, so the built-ins come via Jest. Jest runs
// from the repo root.
const fs = jest.requireActual('fs') as { readFileSync(file: string, enc: 'utf8'): string };
const read = (rel: string): string => fs.readFileSync(`ios/${rel}`, 'utf8');

describe('appConfig.json', () => {
  it('has every required key, with string values (empty = explicit placeholder)', () => {
    expect(typeof appConfig.displayName).toBe('string');
    expect(typeof appConfig.privacyPolicyUrl).toBe('string');
    expect(typeof appConfig.termsOfUseUrl).toBe('string');
    expect(typeof (appConfig as { terms_version?: string }).terms_version).toBe('string');
    expect(typeof appConfig.supportContact).toBe('string');
    expect(typeof appConfig.reportFormUrl).toBe('string');
    expect(typeof appConfig.ios.marketingVersion).toBe('string');
    expect(typeof appConfig.ios.buildNumber).toBe('string');
  });

  it('matches the iOS project defaults', () => {
    const pbx = read('MeetupMobile.xcodeproj/project.pbxproj');
    // Xcode writes a value with spaces (the display name) in double quotes.
    const asPbx = (value: string): string => (/^[A-Za-z0-9_.]+$/.test(value) ? value : `"${value}"`);
    const count = (setting: string, value: string): number =>
      pbx.split(`${setting} = ${asPbx(value)};`).length - 1;

    expect(count('MARKETING_VERSION', appConfig.ios.marketingVersion)).toBe(2);
    expect(count('CURRENT_PROJECT_VERSION', appConfig.ios.buildNumber)).toBe(2);
    expect(count('APP_DISPLAY_NAME', appConfig.displayName)).toBe(2);
    // The home-screen name is the build setting or, as checked in, the configured display name itself.
    const plist = read('MeetupMobile/Info.plist');
    const shown = /<key>CFBundleDisplayName<\/key>\s*<string>([^<]*)<\/string>/.exec(plist)?.[1];
    expect(['$(APP_DISPLAY_NAME)', appConfig.displayName]).toContain(shown);
    // The location usage texts follow the build setting (Task 3.1 display-name change).
    expect(plist).toContain('<string>$(APP_DISPLAY_NAME) only uses your location');
  });

  it('iOS build URL overrides are empty or https', () => {
    for (const value of [appConfig.ios.apiBaseUrl, appConfig.ios.avatarBucketBaseUrl]) {
      expect(typeof value).toBe('string');
      expect(value === '' || value.startsWith('https://')).toBe(true);
      expect(value.endsWith('/')).toBe(false);
    }
  });
});
