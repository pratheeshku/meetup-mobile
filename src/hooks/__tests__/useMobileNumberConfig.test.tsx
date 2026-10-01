/** Consent + country list loading. EXECUTES the hook through a probe component. */
import React from 'react';

import { getCountryCodes, getMobileConsent } from '../../api/mobileNumber';
import { act, renderAsync } from '../../test-utils/render';
import { CONSENT, COUNTRIES } from '../../test-utils/mobileNumberFixtures';
import { useMobileNumberConfig } from '../useMobileNumberConfig';
import type { MobileNumberConfig } from '../useMobileNumberConfig';

jest.mock('../../api/mobileNumber', () => ({ getMobileConsent: jest.fn(), getCountryCodes: jest.fn() }));
const mockConsent = getMobileConsent as jest.Mock;
const mockCountries = getCountryCodes as jest.Mock;

function probe() {
  const ref: { current: MobileNumberConfig | null } = { current: null };
  function Probe(): React.JSX.Element {
    ref.current = useMobileNumberConfig();
    return <></>;
  }
  return { ref, Probe };
}

beforeEach(() => {
  mockConsent.mockReset().mockResolvedValue(CONSENT);
  mockCountries.mockReset().mockResolvedValue(COUNTRIES);
});

describe('useMobileNumberConfig', () => {
  it('is ready with the consent text and the country list; the default is the FIRST row', async () => {
    const { ref, Probe } = probe();
    await renderAsync(<Probe />);
    const config = ref.current as Extract<MobileNumberConfig, { status: 'ready' }>;
    expect(config.status).toBe('ready');
    expect(config.consent).toEqual(CONSENT);
    expect(config.countries).toEqual(COUNTRIES);
    expect(config.defaultCountry.iso2).toBe('SG');
    expect(config.defaultCountry.dial_code).toBe('+65');
  });

  it('takes the default from the server order, not from SG: a different first row becomes the default', async () => {
    mockCountries.mockResolvedValue([COUNTRIES[1], COUNTRIES[0]]);
    const { ref, Probe } = probe();
    await renderAsync(<Probe />);
    expect((ref.current as Extract<MobileNumberConfig, { status: 'ready' }>).defaultCountry.iso2).toBe('AU');
  });

  it('is unavailable when the consent fetch fails', async () => {
    mockConsent.mockRejectedValue(new Error('down'));
    const { ref, Probe } = probe();
    await renderAsync(<Probe />);
    expect(ref.current?.status).toBe('unavailable');
  });

  it('is unavailable when the country list fails or is empty', async () => {
    mockCountries.mockRejectedValue(new Error('down'));
    const failed = probe();
    await renderAsync(<failed.Probe />);
    expect(failed.ref.current?.status).toBe('unavailable');

    mockCountries.mockResolvedValue([]);
    const empty = probe();
    await renderAsync(<empty.Probe />);
    expect(empty.ref.current?.status).toBe('unavailable');
  });

  it('is unavailable when the consent text is empty', async () => {
    mockConsent.mockResolvedValue({ version: 'v1', text: '' });
    const { ref, Probe } = probe();
    await renderAsync(<Probe />);
    expect(ref.current?.status).toBe('unavailable');
  });

  it('starts as loading', async () => {
    mockConsent.mockReturnValue(new Promise(() => {}));
    const { ref, Probe } = probe();
    await renderAsync(<Probe />);
    expect(ref.current?.status).toBe('loading');
  });

  it('reloadConsent refetches the consent text and updates it', async () => {
    const { ref, Probe } = probe();
    await renderAsync(<Probe />);
    mockConsent.mockResolvedValue({ version: 'mobile-consent-v2', text: 'New text' });
    let ok = false;
    await act(async () => {
      ok = await (ref.current as Extract<MobileNumberConfig, { status: 'ready' }>).reloadConsent();
    });
    expect(ok).toBe(true);
    expect((ref.current as Extract<MobileNumberConfig, { status: 'ready' }>).consent.version).toBe('mobile-consent-v2');
  });

  it('reloadConsent reports failure and keeps the old text', async () => {
    const { ref, Probe } = probe();
    await renderAsync(<Probe />);
    mockConsent.mockRejectedValue(new Error('x'));
    let ok = true;
    await act(async () => {
      ok = await (ref.current as Extract<MobileNumberConfig, { status: 'ready' }>).reloadConsent();
    });
    expect(ok).toBe(false);
    expect((ref.current as Extract<MobileNumberConfig, { status: 'ready' }>).consent).toEqual(CONSENT);
  });
});
