/** Edit profile mobile number (teams-payments AD-6): country dropdown (default +65) and number as two fields, saved as the same E.164 string. */
import React from 'react';

import { getProfile, getSkillLevels } from '../../api/profile';
import { getCountryCodes, getMobileConsent, updateMobileNumber } from '../../api/mobileNumber';
import { act, pressableWithText, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import EditProfileScreen from '../EditProfileScreen';

type Props = React.ComponentProps<typeof EditProfileScreen>;

const mockShowCompletion = jest.fn();
jest.mock('../../navigation/showCompletion', () => ({ showCompletion: (...args: unknown[]) => mockShowCompletion(...args) }));
jest.mock('@react-navigation/native', () => ({ ...jest.requireActual('@react-navigation/native'), useFocusEffect: jest.fn() }));
jest.mock('react-native-image-crop-picker', () => ({ openPicker: jest.fn(), openCamera: jest.fn() }));
jest.mock('../../api/sports', () => ({ getSports: jest.fn().mockResolvedValue([]) }));
jest.mock('../../api/profile', () => ({
  getProfile: jest.fn(),
  getSkillLevels: jest.fn(),
  updateProfile: jest.fn(),
  uploadAvatar: jest.fn(),
  deleteAvatar: jest.fn(),
  uploadCover: jest.fn(),
  deleteCover: jest.fn(),
}));
jest.mock('../../api/mobileNumber', () => ({
  getMobileConsent: jest.fn(),
  getCountryCodes: jest.fn(),
  updateMobileNumber: jest.fn(),
  classifyMobileNumberError: jest.fn((error: { response?: { status?: number } }) =>
    error?.response?.status === 422 ? 'invalid_number' : error?.response?.status === 409 ? 'consent_version_stale' : 'other',
  ),
}));

const COUNTRIES = [
  { iso2: 'SG', name: 'Singapore', dial_code: '+65', sort_order: 1, enabled: true },
  { iso2: 'MY', name: 'Malaysia', dial_code: '+60', sort_order: 2, enabled: true },
];
const profile = (mobile: string | null) => ({
  id: 'u-1',
  nickname: 'sam',
  display_name: 'Sam',
  avatar_url: null,
  cover_url: null,
  mobile_number: mobile,
  skill_levels: [],
});

const navigation = { goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() };
const mount = (mobile: string | null): Promise<Instance> => {
  (getProfile as jest.Mock).mockResolvedValue(profile(mobile));
  return renderAsync(<EditProfileScreen {...({ navigation, route: { params: undefined } } as unknown as Props)} />);
};
const numberInput = (root: Instance): Instance =>
  root.findAll(n => n.props.accessibilityLabel === 'Mobile number' && typeof n.props.onChangeText === 'function')[0];
const type = async (root: Instance, text: string): Promise<void> => {
  await act(async () => {
    numberInput(root).props.onChangeText(text);
  });
};
const save = async (root: Instance): Promise<void> => {
  await act(async () => {
    pressableWithText(root, 'Save').props.onPress();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  (getSkillLevels as jest.Mock).mockResolvedValue([]);
  (getMobileConsent as jest.Mock).mockResolvedValue({ version: 'v3', text: 'Consent text' });
  (getCountryCodes as jest.Mock).mockResolvedValue(COUNTRIES);
  (updateMobileNumber as jest.Mock).mockResolvedValue(undefined);
});

describe('two fields', () => {
  it('shows the country dropdown defaulting to the first row (+65) and the number field, not one plain text box', async () => {
    const root = await mount(null);
    expect(root.findAll(n => n.props.testID === 'edit-profile-mobile')).not.toHaveLength(0);
    expect(texts(root)).toEqual(expect.arrayContaining(['SG +65', 'Consent text']));
    expect(numberInput(root)).toBeDefined();
  });

  it('a stored +65 number preselects SG and shows the national digits', async () => {
    const root = await mount('+6591234567');
    expect(texts(root)).toContain('SG +65');
    expect(numberInput(root).props.value).toBe('91234567');
  });

  it('is hidden while the country list is unavailable', async () => {
    (getCountryCodes as jest.Mock).mockRejectedValue(new Error('down'));
    const root = await mount(null);
    expect(root.findAll(n => n.props.testID === 'edit-profile-mobile')).toHaveLength(0);
  });
});

describe('save', () => {
  it('sends the same E.164 string with the consent version when the number is set', async () => {
    const root = await mount(null);
    await type(root, '9123 4567');
    await save(root);
    expect(updateMobileNumber).toHaveBeenCalledWith({ mobile_number: '+6591234567', mobile_consent_version: 'v3' });
  });

  it('sends nothing for the number when it was not touched', async () => {
    const root = await mount('+6591234567');
    await save(root);
    expect(updateMobileNumber).not.toHaveBeenCalled();
  });

  it('clearing the field clears the stored number', async () => {
    const root = await mount('+6591234567');
    await type(root, '');
    await save(root);
    expect(updateMobileNumber).toHaveBeenCalledWith({ mobile_number: null });
  });

  it('an impossible number shows the fixed invalid text and sends nothing', async () => {
    const root = await mount(null);
    await type(root, '12');
    await save(root);
    expect(updateMobileNumber).not.toHaveBeenCalled();
    expect(texts(root)).toContain('Enter a valid mobile number.');
  });

  it('a 422 shows the fixed invalid text, never the server detail or the number', async () => {
    (updateMobileNumber as jest.Mock).mockRejectedValue({ response: { status: 422, data: { detail: 'bad +6591234567' } } });
    const root = await mount(null);
    await type(root, '91234567');
    await save(root);
    expect(texts(root).join(' ')).not.toContain('bad +6591234567');
    expect(texts(root)).toContain('Enter a valid mobile number.');
  });
});
