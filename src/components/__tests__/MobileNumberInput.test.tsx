/** Reusable number field. EXECUTES real renders and interactions (libphonenumber-js unmocked). */
import React from 'react';
import { TextInput } from 'react-native';

import { act, pressableLabelled, render, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { CONSENT, COUNTRIES } from '../../test-utils/mobileNumberFixtures';
import MobileNumberInput from '../MobileNumberInput';
import type { MobileNumberChange } from '../MobileNumberInput';

function field(props: Partial<React.ComponentProps<typeof MobileNumberInput>> = {}) {
  const onChange = jest.fn<void, [MobileNumberChange]>();
  const root = render(
    <MobileNumberInput countries={COUNTRIES} consentText={CONSENT.text} onChange={onChange} {...props} />,
  );
  return { root, onChange };
}

const type = (root: Instance, text: string) =>
  act(() => root.findByType(TextInput).props.onChangeText(text));
const lastChange = (onChange: jest.Mock): MobileNumberChange => onChange.mock.calls.at(-1)![0];
const triggerText = (root: Instance): string[] =>
  texts(root.find(node => node.props.accessibilityLabel === 'Country code' && node.props.accessibilityRole === 'button'));

describe('MobileNumberInput', () => {
  it('defaults to the first row of the country list: "SG +65"', () => {
    const { root } = field();
    expect(triggerText(root)).toContain('SG +65');
  });

  it('shows the consent text passed in (never hardcoded)', () => {
    expect(texts(field({ consentText: 'Custom consent copy' }).root)).toContain('Custom consent copy');
  });

  it('lists the ISO and dial code for every row, with no emoji flags', () => {
    const { root } = field();
    act(() => pressableLabelled(root, 'Country code').props.onPress());
    const labels = root
      .findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')
      .map(node => node.props.accessibilityLabel as string);
    for (const country of COUNTRIES) {
      expect(labels).toContain(`${country.iso2} ${country.dial_code}`);
    }
    expect(labels.join(' ')).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('builds E.164 from the default code and typed digits', () => {
    const { root, onChange } = field();
    type(root, '9123 4567');
    expect(lastChange(onChange)).toEqual({ e164: '+6591234567', isEmpty: false });
  });

  it('rebuilds the number when the country changes', () => {
    const { root, onChange } = field();
    type(root, '07700 900123');
    act(() => pressableLabelled(root, 'Country code').props.onPress());
    act(() => pressableLabelled(root, 'GB +44').props.onPress());
    expect(triggerText(root)).toContain('GB +44');
    expect(lastChange(onChange)).toEqual({ e164: '+447700900123', isEmpty: false });
  });

  it.each([
    ['AU', '0412 345 678', '+61412345678'],
    ['IN', '98765 43210', '+919876543210'],
    ['US', '(212) 555-0123', '+12125550123'],
  ])('produces E.164 for %s', (iso2, national, expected) => {
    const { root, onChange } = field();
    const country = COUNTRIES.find(row => row.iso2 === iso2)!;
    act(() => pressableLabelled(root, 'Country code').props.onPress());
    act(() => pressableLabelled(root, `${country.iso2} ${country.dial_code}`).props.onPress());
    type(root, national);
    expect(lastChange(onChange).e164).toBe(expected);
  });

  it('reports an empty field and a null number for junk', () => {
    const { root, onChange } = field();
    type(root, '');
    expect(lastChange(onChange)).toEqual({ e164: null, isEmpty: true });
    type(root, '12');
    expect(lastChange(onChange)).toEqual({ e164: null, isEmpty: false });
  });

  it('editing a stored +44 number preselects the UK and shows the national part', () => {
    const { root } = field({ initialValue: '+447700900123' });
    expect(triggerText(root)).toContain('GB +44');
    expect(root.findByType(TextInput).props.value).toBe('7700900123');
  });

  it('editing a stored +65 number preselects Singapore', () => {
    expect(triggerText(field({ initialValue: '+6591234567' }).root)).toContain('SG +65');
  });

  it('a shared dial code falls back to the default when the default shares it', () => {
    const us = COUNTRIES.find(row => row.iso2 === 'US')!;
    const ca = COUNTRIES.find(row => row.iso2 === 'CA')!;
    const { root } = field({ countries: [us, ca, COUNTRIES[0]], initialValue: '+15551234567' });
    expect(triggerText(root)).toContain('US +1');
  });

  it('shows an inline error without the number in it', () => {
    const { root } = field({ error: 'Enter a valid mobile number.' });
    expect(texts(root)).toContain('Enter a valid mobile number.');
  });

  it('never logs the number while typing', () => {
    const spies = (['log', 'warn', 'error', 'info', 'debug'] as const).map(method =>
      jest.spyOn(console, method).mockImplementation(() => {}),
    );
    const { root } = field();
    type(root, '9123 4567');
    for (const spy of spies) {
      expect(JSON.stringify(spy.mock.calls)).not.toMatch(/91234567|9123 4567/);
      spy.mockRestore();
    }
  });
});
