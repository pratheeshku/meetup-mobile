/* eslint-disable no-script-url -- the javascript: scheme is a rejection case under test */
import { toHttpsUrl } from '../httpsUrl';

describe('toHttpsUrl', () => {
  it.each([[''], ['   '], ['\n\t'], [undefined], [null]])('returns null for empty/blank %p', value => {
    expect(toHttpsUrl(value)).toBeNull();
  });

  it.each([
    ['http://example.com/form'],
    ['ftp://example.com'],
    ['javascript:void(0)'],
    ['example.com/form'],
    ['not a url'],
    ['https://'],
    ['https://exa mple.com'],
    ['HTTPS://example.com'],
    ['//example.com'],
  ])('returns null for %p', value => {
    expect(toHttpsUrl(value)).toBeNull();
  });

  it('returns a valid https URL trimmed', () => {
    expect(toHttpsUrl('  https://forms.example.com/report?x=1  ')).toBe(
      'https://forms.example.com/report?x=1',
    );
  });
});
