/** Client phone helpers. EXECUTES libphonenumber-js (no mocks). */
import { COUNTRIES } from '../../test-utils/mobileNumberFixtures';
import { buildE164, countryLabel, nationalDigits, splitE164 } from '../phoneNumber';

const country = (iso2: string) => COUNTRIES.find(row => row.iso2 === iso2) as (typeof COUNTRIES)[number];

describe('buildE164', () => {
  it.each([
    ['SG', '9123 4567', '+6591234567'],
    ['SG', '91234567', '+6591234567'],
    ['GB', '07700 900123', '+447700900123'],
    ['GB', '7700-900-123', '+447700900123'],
    ['AU', '0412 345 678', '+61412345678'],
    ['IN', '98765 43210', '+919876543210'],
    ['US', '(212) 555-0123', '+12125550123'],
  ])('builds E.164 for %s %s -> %s', (iso2, national, expected) => {
    expect(buildE164(country(iso2), national)).toBe(expected);
  });

  it('returns null for an empty field', () => {
    expect(buildE164(country('SG'), '')).toBeNull();
    expect(buildE164(country('SG'), '  - ')).toBeNull();
  });

  it('returns null for a number that cannot be a phone number (too short / too long)', () => {
    expect(buildE164(country('SG'), '12')).toBeNull();
    expect(buildE164(country('SG'), '1'.repeat(18))).toBeNull();
  });

  it('keeps the chosen country code even if the digits look international', () => {
    // 65 + 91234567 typed under SG stays a valid SG number rather than +6565...
    expect(buildE164(country('SG'), '6591234567')).toBe('+6591234567');
  });

  it('always starts with "+" and contains only digits after it', () => {
    for (const [iso2, national] of [['SG', '9123 4567'], ['GB', '07700 900123'], ['US', '212-555-0123']]) {
      expect(buildE164(country(iso2), national)).toMatch(/^\+[1-9][0-9]{6,14}$/);
    }
  });
});

describe('nationalDigits / countryLabel', () => {
  it('strips everything but digits', () => {
    expect(nationalDigits('+65 (9123)-4567')).toBe('6591234567');
  });

  it('shows the ISO code and dial code, no emoji flag', () => {
    expect(countryLabel(country('SG'))).toBe('SG +65');
    expect(countryLabel(country('GB'))).toBe('GB +44');
  });
});

describe('splitE164 (country preselect from dial code)', () => {
  it('a stored +44 number preselects the UK', () => {
    const split = splitE164('+447700900123', COUNTRIES);
    expect(split?.country.iso2).toBe('GB');
    expect(split?.national).toBe('7700900123');
  });

  it('a stored +65 number preselects Singapore', () => {
    expect(splitE164('+6591234567', COUNTRIES)?.country.iso2).toBe('SG');
  });

  it('resolves a shared +1 code by the number itself (US area code)', () => {
    expect(splitE164('+12125550123', COUNTRIES)?.country.iso2).toBe('US');
  });

  it('falls back to the default country when several countries share a code and the default is one of them', () => {
    // Default (first row) is US; +1 is shared by US/CA and the number does not resolve to either.
    const list = [country('US'), country('CA'), country('SG')];
    const split = splitE164('+15551234567', list);
    expect(split?.country.iso2).toBe('US');
    expect(split?.national).toBe('5551234567');
  });

  it('keeps the dial code consistent when the default does not share it (first sharing country)', () => {
    const split = splitE164('+15551234567', COUNTRIES); // default is SG (+65)
    expect(split?.country.dial_code).toBe('+1');
    expect(buildE164(split!.country, split!.national)).toBe('+15551234567');
  });

  it('uses the default country when no listed country has the dial code', () => {
    const split = splitE164('+81312345678', COUNTRIES);
    expect(split?.country.iso2).toBe('SG');
  });

  it('returns null for an empty country list', () => {
    expect(splitE164('+6591234567', [])).toBeNull();
  });

  it('round-trips: split then build gives the original number', () => {
    for (const number of ['+6591234567', '+447700900123', '+919876543210', '+61412345678', '+12125550123']) {
      const split = splitE164(number, COUNTRIES)!;
      expect(buildE164(split.country, split.national)).toBe(number);
    }
  });
});
