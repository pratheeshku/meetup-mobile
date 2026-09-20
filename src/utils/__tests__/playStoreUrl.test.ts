/**
 * The force-update "Update" button opens the backend-supplied `store_url` only
 * if it is an https URL on EXACTLY `play.google.com`; everything else falls back
 * to this app's own Play Store page.
 */
import { PLAY_STORE_FALLBACK_URL, isAllowedStoreUrl, resolveStoreUrl } from '../playStoreUrl';

describe('PLAY_STORE_FALLBACK_URL', () => {
  it('is the Play page for org.duckdns.meetups', () => {
    expect(PLAY_STORE_FALLBACK_URL).toBe('https://play.google.com/store/apps/details?id=org.duckdns.meetups');
  });
});

describe('resolveStoreUrl — accepted', () => {
  it.each([
    'https://play.google.com/store/apps/details?id=org.duckdns.meetups',
    'https://play.google.com/store/apps/details?id=org.duckdns.meetups&hl=en&gl=IN',
    'https://play.google.com/store/apps/details?id=some.other.app', // host is what is validated
    'https://play.google.com/',
    'https://play.google.com',
    'https://play.google.com/apps/testing/org.duckdns.meetups#section',
  ])('opens %s as given', url => {
    expect(isAllowedStoreUrl(url)).toBe(true);
    expect(resolveStoreUrl(url)).toBe(url);
  });
});

describe('resolveStoreUrl — rejected, falls back', () => {
  it.each([
    ['plain http', 'http://play.google.com/store/apps/details?id=org.duckdns.meetups'],
    ['other scheme: market', 'market://details?id=org.duckdns.meetups'],
    ['other scheme: intent', 'intent://details?id=org.duckdns.meetups#Intent;scheme=market;end'],
    // Built by concatenation so the linter's script-URL rule doesn't flag test data.
    ['other scheme: javascript', ['java', 'script:alert(1)'].join('')],
    ['other scheme: file', 'file:///sdcard/x.apk'],
    ['other scheme: ftp', 'ftp://play.google.com/x'],
    ['scheme-relative', '//play.google.com/store/apps'],
    ['different host', 'https://evil.example.com/store/apps/details?id=org.duckdns.meetups'],
    ['look-alike subdomain suffix', 'https://play.google.com.evil.example/store'],
    ['look-alike prefix', 'https://evilplay.google.com/store'],
    ['subdomain of play.google.com', 'https://a.play.google.com/store'],
    ['other Google host', 'https://market.android.com/details?id=org.duckdns.meetups'],
    ['host only in the path', 'https://evil.example/play.google.com/store'],
    ['host only in the query', 'https://evil.example/?u=https://play.google.com/store'],
    ['userinfo hides the real host', 'https://play.google.com@evil.example/store'],
    ['userinfo before the host', 'https://evil.example@play.google.com/store'],
    ['explicit port', 'https://play.google.com:8443/store'],
    ['explicit default port', 'https://play.google.com:443/store'],
    ['backslash trick', 'https://play.google.com\\@evil.example/store'],
    ['backslash in path', 'https://play.google.com/store\\..\\x'],
    ['query directly after host', 'https://play.google.com?next=evil'],
    ['fragment directly after host', 'https://play.google.com#evil'],
    ['uppercase host (conservative)', 'https://PLAY.GOOGLE.COM/store'],
    ['uppercase scheme (conservative)', 'HTTPS://play.google.com/store'],
    ['leading space', ' https://play.google.com/store'],
    ['trailing space', 'https://play.google.com/store '],
    ['space in path', 'https://play.google.com/store /apps'],
    ['tab in path', 'https://play.google.com/store\t/apps'],
    ['newline injected', 'https://play.google.com/store\nhttps://evil.example'],
    ['carriage return', 'https://play.google.com/store\r'],
    ['NUL byte', 'https://play.google.com/store\u0000.evil'],
    ['DEL character', 'https://play.google.com/store\u007f'],
    ['empty string', ''],
    ['just the scheme', 'https://'],
    ['no scheme', 'play.google.com/store'],
    ['over-long URL', `https://play.google.com/${'a'.repeat(2100)}`],
  ])('%s -> fallback', (_label, url) => {
    expect(isAllowedStoreUrl(url)).toBe(false);
    expect(resolveStoreUrl(url)).toBe(PLAY_STORE_FALLBACK_URL);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a number', 5],
    ['an object', { url: 'https://play.google.com/' }],
    ['an array', ['https://play.google.com/']],
    ['a boolean', true],
  ])('a non-string (%s) -> fallback', (_label, value) => {
    expect(isAllowedStoreUrl(value)).toBe(false);
    expect(resolveStoreUrl(value)).toBe(PLAY_STORE_FALLBACK_URL);
  });
});
