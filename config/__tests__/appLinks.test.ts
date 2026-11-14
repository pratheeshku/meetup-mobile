/**
 * Verified app links (deep-links AD-1, AD-2, AD-4): `/l/` on https for one host per build, from the
 * single source `config/appConfig.json`. Guards the native declarations against drifting from it.
 */
import appConfig from '../appConfig.json';
import { selectEnvironment } from '../environment';

const fs = jest.requireActual('fs') as { readFileSync(file: string, enc: 'utf8'): string };
const read = (rel: string): string => fs.readFileSync(rel, 'utf8');

describe('link hosts', () => {
  it('production and staging each have their own host', () => {
    expect(appConfig.linkHost).toBe('meetupaws.duckdns.org');
    expect(appConfig.environments.staging.linkHost).toBe('meetupstg.duckdns.org');
    expect(selectEnvironment('production').linkHost).toBe('meetupaws.duckdns.org');
    expect(selectEnvironment('staging').linkHost).toBe('meetupstg.duckdns.org');
  });
});

describe('Android', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  const gradle = read('android/app/build.gradle');

  it('declares one verified https link: the flavor host placeholder and path prefix /l/ only', () => {
    expect(manifest.match(/android:autoVerify="true"/g)).toHaveLength(1);
    expect(manifest.match(/android:pathPrefix=/g)).toHaveLength(1);
    expect(manifest).toContain(
      '<data android:scheme="https" android:host="${linkHost}" android:pathPrefix="/l/" />',
    );
    expect(manifest).toContain('android.intent.category.BROWSABLE');
  });

  it('adds no custom scheme and no host literal to the manifest', () => {
    expect(manifest.match(/android:scheme="([^"]+)"/g)).toEqual(['android:scheme="https"']);
    expect(manifest).not.toMatch(/android:host="(?!\$\{linkHost\})/);
  });

  it('feeds the placeholder per flavor from appConfig.json, not from a literal', () => {
    expect(gradle).toContain('manifestPlaceholders = [linkHost: appConfigJson.linkHost]');
    expect(gradle).toContain('manifestPlaceholders = [linkHost: stagingConfig.linkHost]');
    expect(gradle).not.toContain('duckdns.org"]');
  });
});

describe('iOS', () => {
  const entitlements = read('ios/MeetupMobile/MeetupMobile.entitlements');
  const pbx = read('ios/MeetupMobile.xcodeproj/project.pbxproj');

  it('Associated Domains reads the host from the build setting', () => {
    expect(entitlements).toContain('com.apple.developer.associated-domains');
    expect(entitlements.match(/applinks:/g)).toHaveLength(1);
    expect(entitlements).toContain('<string>applinks:$(APP_LINK_HOST)</string>');
  });

  it('production Debug and Release carry the production host; the staging script sets the staging host', () => {
    expect(pbx.split(`APP_LINK_HOST = ${appConfig.linkHost};`).length - 1).toBe(2);
    const script = read('scripts/ios-set-environment.rb');
    expect(script).toContain("staging['linkHost']");
    expect(script).toContain("build_settings['APP_LINK_HOST'] = link_host");
  });

  it('the scene delegate forwards universal links to React Native', () => {
    expect(read('ios/MeetupMobile/SceneDelegate.swift')).toContain('continue: userActivity');
  });
});
