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
    expect(typeof appConfig.supportContact).toBe('string');
    expect(typeof appConfig.ios.marketingVersion).toBe('string');
    expect(typeof appConfig.ios.buildNumber).toBe('string');
  });

  it('matches the iOS project defaults', () => {
    const pbx = read('MeetupMobile.xcodeproj/project.pbxproj');
    const count = (setting: string, value: string): number =>
      pbx.split(`${setting} = ${value};`).length - 1;

    expect(count('MARKETING_VERSION', appConfig.ios.marketingVersion)).toBe(2);
    expect(count('CURRENT_PROJECT_VERSION', appConfig.ios.buildNumber)).toBe(2);
    expect(count('APP_DISPLAY_NAME', appConfig.displayName)).toBe(2);
    expect(read('MeetupMobile/Info.plist')).toContain('<string>$(APP_DISPLAY_NAME)</string>');
  });
});
