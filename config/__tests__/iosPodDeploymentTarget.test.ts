/**
 * Xcode 27 rejects pod targets below iOS 15.0. The Podfile raises any lower
 * pod target to 15.0 in post_install (never lowers a higher one), and the app
 * itself must stay at or above that.
 */
export {};

const fs = jest.requireActual('fs') as { readFileSync(file: string, enc: 'utf8'): string };
const read = (rel: string): string => fs.readFileSync(`ios/${rel}`, 'utf8');

describe('iOS pod deployment target override', () => {
  const podfile = read('Podfile');
  const postInstall = podfile.slice(podfile.indexOf('post_install do |installer|'));

  it('raises pod targets below 15.0 to 15.0 after react_native_post_install', () => {
    expect(postInstall).toContain('react_native_post_install(');
    expect(postInstall).toContain("Gem::Version.new('15.0')");
    expect(postInstall).toContain('IPHONEOS_DEPLOYMENT_TARGET');
    expect(postInstall).toContain("= '15.0'");
    expect(postInstall.indexOf('IPHONEOS_DEPLOYMENT_TARGET')).toBeGreaterThan(
      postInstall.indexOf('react_native_post_install('),
    );
  });

  it('covers every pod target and the Pods project, and only raises (a "<" comparison)', () => {
    expect(postInstall).toContain('installer.pods_project.targets.each');
    expect(postInstall).toContain('installer.pods_project.build_configurations');
    expect(postInstall).toContain('target.build_configurations');
    expect(postInstall).toMatch(/Gem::Version\.new\(current\.to_s\) < min_pod_deployment_target/);
  });

  it('the app target and the Podfile platform are at least 15.0', () => {
    const pbx = read('MeetupMobile.xcodeproj/project.pbxproj');
    const targets = [...pbx.matchAll(/IPHONEOS_DEPLOYMENT_TARGET = ([\d.]+);/g)].map(m => Number(m[1]));
    expect(targets.length).toBeGreaterThan(0);
    for (const value of targets) {
      expect(value).toBeGreaterThanOrEqual(15);
    }
    expect(podfile).toContain('platform :ios, min_ios_version_supported');
  });

  it('Podfile.lock records the current Podfile checksum', () => {
    const crypto = jest.requireActual('crypto') as {
      createHash(alg: string): { update(data: string): { digest(enc: 'hex'): string } };
    };
    const lock = read('Podfile.lock');
    const expected = crypto.createHash('sha1').update(podfile).digest('hex');
    expect(lock).toContain(`PODFILE CHECKSUM: ${expected}`);
  });
});
