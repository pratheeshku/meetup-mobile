/** Mobile number + onboarding API: paths, payloads and error classification. */
import { apiClient } from '../client';
import {
  classifyMobileNumberError,
  getCountryCodes,
  getMobileConsent,
  updateMobileNumber,
} from '../mobileNumber';
import { completeOnboarding, getOnboardingState } from '../onboarding';

jest.mock('../client', () => ({ apiClient: { get: jest.fn(), patch: jest.fn(), post: jest.fn() } }));

const get = apiClient.get as jest.Mock;
const patch = apiClient.patch as jest.Mock;
const post = apiClient.post as jest.Mock;

afterEach(() => {
  get.mockReset();
  patch.mockReset();
  post.mockReset();
});

describe('getMobileConsent', () => {
  it('reads GET /public/consent/mobile-number and returns version and text', async () => {
    get.mockResolvedValueOnce({ data: { version: 'v1', text: 'Hello', extra: 'x' } });
    await expect(getMobileConsent({ correlationId: 'c' })).resolves.toEqual({ version: 'v1', text: 'Hello' });
    expect(get).toHaveBeenCalledWith('/public/consent/mobile-number', { correlationId: 'c' });
  });
});

describe('getCountryCodes', () => {
  it('reads GET /public/country-codes, keeps the server order, and drops disabled rows', async () => {
    get.mockResolvedValueOnce({
      data: [
        { iso2: 'SG', name: 'Singapore', dial_code: '+65', sort_order: 1, enabled: true },
        { iso2: 'ZZ', name: 'Off', dial_code: '+999', sort_order: 2, enabled: false },
        { iso2: 'AU', name: 'Australia', dial_code: '+61', sort_order: 3, enabled: true },
      ],
    });
    const rows = await getCountryCodes();
    expect(get).toHaveBeenCalledWith('/public/country-codes', { correlationId: undefined });
    expect(rows.map(row => row.iso2)).toEqual(['SG', 'AU']);
  });
});

describe('updateMobileNumber', () => {
  it('PATCHes /users/me with the number and the consent version', async () => {
    patch.mockResolvedValueOnce({});
    await updateMobileNumber(
      { mobile_number: '+6591234567', mobile_consent_version: 'v1' },
      { correlationId: 'c' },
    );
    expect(patch).toHaveBeenCalledWith(
      '/users/me',
      { mobile_number: '+6591234567', mobile_consent_version: 'v1' },
      { correlationId: 'c' },
    );
  });

  it('clearing sends mobile_number: null and no consent version', async () => {
    patch.mockResolvedValueOnce({});
    await updateMobileNumber({ mobile_number: null });
    const body = patch.mock.calls[0][1];
    expect(body).toEqual({ mobile_number: null });
    expect('mobile_consent_version' in body).toBe(false);
  });
});

describe('classifyMobileNumberError', () => {
  it('maps 409 to consent_version_stale and 422 to invalid_number, without reading the body', () => {
    expect(classifyMobileNumberError({ response: { status: 409, data: { detail: 'whatever +6591234567' } } })).toBe(
      'consent_version_stale',
    );
    expect(classifyMobileNumberError({ response: { status: 422, data: { detail: [{ input: '+6591234567' }] } } })).toBe(
      'invalid_number',
    );
  });

  it('maps everything else (network error, 500, null) to other', () => {
    expect(classifyMobileNumberError({ response: { status: 500 } })).toBe('other');
    expect(classifyMobileNumberError(new Error('Network Error'))).toBe('other');
    expect(classifyMobileNumberError(null)).toBe('other');
  });
});

describe('onboarding endpoints', () => {
  it('reads onboarding_required and whether a number is stored from GET /users/me, never the number', async () => {
    get.mockResolvedValueOnce({ data: { id: 'u', onboarding_required: true, mobile_number: '+6591234567' } });
    const state = await getOnboardingState({ correlationId: 'c' });
    expect(get).toHaveBeenCalledWith('/users/me', { correlationId: 'c' });
    expect(state).toEqual({ onboarding_required: true, has_mobile_number: true });
    expect(JSON.stringify(state)).not.toContain('6591234567');
  });

  it('treats a missing flag as not required and null/empty number as none', async () => {
    get.mockResolvedValueOnce({ data: { mobile_number: null } });
    await expect(getOnboardingState()).resolves.toEqual({ onboarding_required: false, has_mobile_number: false });
  });

  it('completes via POST /users/me/onboarding/complete', async () => {
    post.mockResolvedValueOnce({});
    await completeOnboarding({ correlationId: 'c' });
    expect(post).toHaveBeenCalledWith('/users/me/onboarding/complete', undefined, { correlationId: 'c' });
  });
});
