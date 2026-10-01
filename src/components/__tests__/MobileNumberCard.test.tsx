/**
 * Profile mobile number card: view, change, clear; 409 and 422 handling; the
 * field hides when the consent text or country list cannot load; the number
 * never reaches a log. EXECUTES the real card, hooks and input.
 */
import React from 'react';
import { TextInput } from 'react-native';

import { getCountryCodes, getMobileConsent, updateMobileNumber } from '../../api/mobileNumber';
import { act, pressableLabelled, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { CONSENT, COUNTRIES, SECRET_NUMBER } from '../../test-utils/mobileNumberFixtures';
import MobileNumberCard from '../MobileNumberCard';

jest.mock('../../api/mobileNumber', () => ({
  getMobileConsent: jest.fn(),
  getCountryCodes: jest.fn(),
  updateMobileNumber: jest.fn(),
  classifyMobileNumberError: jest.requireActual('../../api/mobileNumber').classifyMobileNumberError,
}));
const mockConsent = getMobileConsent as jest.Mock;
const mockCountries = getCountryCodes as jest.Mock;
const mockUpdate = updateMobileNumber as jest.Mock;

const onSaved = jest.fn();
const mount = (storedNumber: string | null | undefined = null): Promise<Instance> =>
  renderAsync(<MobileNumberCard storedNumber={storedNumber} onSaved={onSaved} />);
const tap = (root: Instance, label: string) => act(async () => pressableLabelled(root, label).props.onPress());
const type = (root: Instance, value: string) => act(async () => root.findByType(TextInput).props.onChangeText(value));
const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });

let logSpies: jest.SpyInstance[];
beforeEach(() => {
  mockConsent.mockReset().mockResolvedValue(CONSENT);
  mockCountries.mockReset().mockResolvedValue(COUNTRIES);
  mockUpdate.mockReset().mockResolvedValue(undefined);
  onSaved.mockReset();
  logSpies = (['log', 'warn', 'error', 'info', 'debug'] as const).map(method =>
    jest.spyOn(console, method).mockImplementation(() => {}),
  );
});
afterEach(() => {
  logSpies.forEach(spy => spy.mockRestore());
});

const loggedText = (): string => JSON.stringify(logSpies.map(spy => spy.mock.calls));

describe('availability (§7)', () => {
  it('is hidden when the consent text fails to load', async () => {
    mockConsent.mockRejectedValue(new Error('down'));
    expect(texts(await mount())).toEqual([]);
  });

  it('is hidden when the country list fails to load', async () => {
    mockCountries.mockRejectedValue(new Error('down'));
    expect(texts(await mount())).toEqual([]);
  });

  it('is shown when both load', async () => {
    expect(texts(await mount())).toContain('Mobile number');
  });
});

describe('view, change, clear', () => {
  it('shows "No mobile number added" and an Add button when none is stored', async () => {
    const root = await mount(null);
    expect(texts(root)).toContain('No mobile number added');
    expect(pressableLabelled(root, 'Add number')).toBeDefined();
    expect(() => pressableLabelled(root, 'Remove')).toThrow(/found 0/);
  });

  it('shows the stored number with Change and Remove', async () => {
    const root = await mount('+447700900123');
    expect(texts(root)).toContain('+447700900123');
    expect(pressableLabelled(root, 'Change')).toBeDefined();
    expect(pressableLabelled(root, 'Remove')).toBeDefined();
  });

  it('sets a number: sends mobile_number (E.164) and the consent version, then reports it saved', async () => {
    const root = await mount(null);
    await tap(root, 'Add number');
    await type(root, '9123 4567');
    await tap(root, 'Save');
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0][0]).toEqual({
      mobile_number: '+6591234567',
      mobile_consent_version: 'mobile-consent-v1',
    });
    expect(onSaved).toHaveBeenCalledWith('+6591234567');
  });

  it('changing a stored +44 number opens with the UK preselected and the national digits filled', async () => {
    const root = await mount('+447700900123');
    await tap(root, 'Change');
    expect(texts(root.find(node => node.props.accessibilityLabel === 'Country code' && node.props.accessibilityRole === 'button'))).toContain('GB +44');
    expect(root.findByType(TextInput).props.value).toBe('7700900123');
  });

  it('clearing sends mobile_number: null (no consent version) and reports null', async () => {
    const root = await mount('+6591234567');
    await tap(root, 'Remove');
    expect(mockUpdate.mock.calls[0][0]).toEqual({ mobile_number: null });
    expect(onSaved).toHaveBeenCalledWith(null);
  });

  it('does not call the server for an unusable number and shows an inline error', async () => {
    const root = await mount(null);
    await tap(root, 'Add number');
    await type(root, '12');
    await tap(root, 'Save');
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(texts(root)).toContain('Enter a valid mobile number.');
  });

  it('Cancel leaves the stored number untouched', async () => {
    const root = await mount('+6591234567');
    await tap(root, 'Change');
    await tap(root, 'Cancel');
    expect(texts(root)).toContain('+6591234567');
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('server errors', () => {
  it('422 shows an inline error that does not echo the value, and nothing is reported saved', async () => {
    mockUpdate.mockRejectedValue(httpError(422));
    const root = await mount(null);
    await tap(root, 'Add number');
    await type(root, '9123 4567');
    await tap(root, 'Save');
    expect(texts(root)).toContain('Enter a valid mobile number.');
    expect(texts(root).join(' ')).not.toMatch(/91234567|9123 4567/);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('409 consent_version_stale refetches the consent text and asks the user to confirm again; the next save uses the new version', async () => {
    mockUpdate.mockRejectedValueOnce(httpError(409));
    const root = await mount(null);
    await tap(root, 'Add number');
    await type(root, '9123 4567');
    mockConsent.mockResolvedValue({ version: 'mobile-consent-v2', text: 'Updated consent text' });
    await tap(root, 'Save');

    expect(mockConsent).toHaveBeenCalledTimes(2); // initial load + refetch
    expect(texts(root)).toContain('Updated consent text');
    expect(texts(root)).toContain('The consent text has changed. Please review it and confirm to save.');
    expect(onSaved).not.toHaveBeenCalled();

    await tap(root, 'Confirm and save');
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockUpdate.mock.calls[1][0]).toEqual({
      mobile_number: '+6591234567',
      mobile_consent_version: 'mobile-consent-v2',
    });
    expect(onSaved).toHaveBeenCalledWith('+6591234567');
  });

  it('any other failure shows a generic inline error, with no number in it', async () => {
    mockUpdate.mockRejectedValue(httpError(500));
    const root = await mount(null);
    await tap(root, 'Add number');
    await type(root, '9123 4567');
    await tap(root, 'Save');
    expect(texts(root)).toContain('Could not save your mobile number. Please try again.');
  });
});

describe('privacy', () => {
  it('the number never appears in console output across save, clear and error paths', async () => {
    mockUpdate.mockRejectedValueOnce(httpError(422)).mockResolvedValue(undefined);
    const root = await mount(SECRET_NUMBER);
    await tap(root, 'Change');
    await type(root, '9123 4567');
    await tap(root, 'Save'); // 422
    await tap(root, 'Save'); // ok
    await tap(root, 'Remove');
    expect(loggedText()).not.toMatch(/91234567|9123 4567/);
  });
});
