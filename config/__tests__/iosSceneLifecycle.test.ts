/**
 * Guards the iOS UIScene adoption (needed for the iOS 27 SDK) without Xcode:
 * the scene manifest, the SceneDelegate in the Sources build phase, and where
 * the window / React Native start lives.
 */
export {};

const fs = jest.requireActual('fs') as { readFileSync(file: string, enc: 'utf8'): string };
const read = (rel: string): string => fs.readFileSync(`ios/${rel}`, 'utf8');

describe('iOS scene lifecycle', () => {
  const plist = read('MeetupMobile/Info.plist');
  const pbx = read('MeetupMobile.xcodeproj/project.pbxproj');
  const app = read('MeetupMobile/AppDelegate.swift');
  const scene = read('MeetupMobile/SceneDelegate.swift');

  it('Info.plist declares a single-window scene manifest with the SceneDelegate', () => {
    expect(plist).toContain('<key>UIApplicationSceneManifest</key>');
    expect(plist).toMatch(/<key>UIApplicationSupportsMultipleScenes<\/key>\s*<false\/>/);
    expect(plist).toContain('<key>UIWindowSceneSessionRoleApplication</key>');
    expect(plist).toContain('<string>$(PRODUCT_MODULE_NAME).SceneDelegate</string>');
    expect(plist.match(/<key>UISceneDelegateClassName<\/key>/g)).toHaveLength(1);
  });

  it('SceneDelegate.swift is a file reference, in the MeetupMobile group and in the Sources phase', () => {
    const ref = /(\w{24}) \/\* SceneDelegate\.swift \*\/ = \{isa = PBXFileReference/.exec(pbx)?.[1];
    expect(ref).toBeDefined();
    const buildFile = new RegExp(`(\\w{24}) /\\* SceneDelegate\\.swift in Sources \\*/ = \\{isa = PBXBuildFile; fileRef = ${ref}`).exec(pbx)?.[1];
    expect(buildFile).toBeDefined();
    const sources = pbx.slice(pbx.indexOf('Begin PBXSourcesBuildPhase'), pbx.indexOf('End PBXSourcesBuildPhase'));
    expect(sources).toContain(buildFile as string);
    const group = pbx.slice(pbx.indexOf('/* MeetupMobile */ = {'), pbx.indexOf('name = MeetupMobile;'));
    expect(group).toContain(ref as string);
  });

  it('the window and React Native start in the SceneDelegate, not the AppDelegate', () => {
    expect(scene).toContain('UIWindow(windowScene: windowScene)');
    expect(scene).toContain('withModuleName: "MeetupMobile"');
    expect(app).not.toContain('startReactNative');
    expect(app).not.toContain('UIWindow(');
  });

  it('the AppDelegate keeps process-level setup', () => {
    expect(app).toContain('FirebaseApp.configure()');
    expect(app).toContain('RCTReactNativeFactory(delegate:');
    expect(app).toContain('class ReactNativeDelegate');
    expect(app).toContain('forResource: "main", withExtension: "jsbundle"'); // bundleURL logic kept
  });

  it('the SceneDelegate hands its window back and forwards URLs and activities to Linking', () => {
    expect(scene).toContain('appDelegate.window = window');
    expect(scene).toContain('openURLContexts');
    expect(scene).toContain('RCTLinkingManager.application(UIApplication.shared, open:');
    expect(scene).toContain('continue userActivity: NSUserActivity');
    expect(scene).toContain('launchOptions(from: connectionOptions)');
  });
});
