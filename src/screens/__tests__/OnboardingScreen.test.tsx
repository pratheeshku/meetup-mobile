/**
 * First-run interstitial. EXECUTES the real screen, step components, the
 * shared notification list and the mobile number input; only the API,
 * permission-check and BackHandler boundaries are mocked.
 */
import React from 'react';
import { BackHandler, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { completeOnboarding } from '../../api/onboarding';
import { getCountryCodes, getMobileConsent, updateMobileNumber } from '../../api/mobileNumber';
import { getPreferences, updatePreference } from '../../api/notifications';
import { getSkillLevels, updateSkillLevel } from '../../api/profile';
import { getSports } from '../../api/sports';
import NotificationPreferencesList from '../../components/NotificationPreferencesList';
import { hasNotificationPermission, requestPermission } from '../../notifications/fcm';
import { CONSENT, COUNTRIES } from '../../test-utils/mobileNumberFixtures';
import { act, pressables, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import OnboardingScreen from '../OnboardingScreen';

jest.mock('../../api/onboarding', () => ({ completeOnboarding: jest.fn() }));
jest.mock('../../api/mobileNumber', () => ({
  getMobileConsent: jest.fn(),
  getCountryCodes: jest.fn(),
  updateMobileNumber: jest.fn(),
  classifyMobileNumberError: jest.requireActual('../../api/mobileNumber').classifyMobileNumberError,
}));
jest.mock('../../api/notifications', () => ({ getPreferences: jest.fn(), updatePreference: jest.fn() }));
jest.mock('../../api/profile', () => ({ getSkillLevels: jest.fn(), updateSkillLevel: jest.fn() }));
jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../notifications/fcm', () => ({
  hasNotificationPermission: jest.fn(),
  requestPermission: jest.fn(),
}));

const mockComplete = completeOnboarding as jest.Mock;
const mockConsent = getMobileConsent as jest.Mock;
const mockCountries = getCountryCodes as jest.Mock;
const mockUpdateMobile = updateMobileNumber as jest.Mock;
const mockPrefs = getPreferences as jest.Mock;
const mockUpdatePref = updatePreference as jest.Mock;
const mockSkills = getSkillLevels as jest.Mock;
const mockUpdateSkill = updateSkillLevel as jest.Mock;
const mockSports = getSports as jest.Mock;
const mockHasPermission = hasNotificationPermission as jest.Mock;
const mockRequestPermission = requestPermission as jest.Mock;

const METRICS = { frame: { x: 0, y: 0, width: 360, height: 640 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const SPORTS = [
  { name: 'badminton', display_name: 'Badminton', slug: 'badminton' },
  { name: 'tennis', display_name: 'Tennis', slug: 'tennis' },
];
const onDone = jest.fn();
let backHandlers: Array<() => boolean>;

function element(props: Partial<React.ComponentProps<typeof OnboardingScreen>> = {}) {
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <OnboardingScreen hasMobileNumber={false} onDone={onDone} {...props} />
    </SafeAreaProvider>
  );
}
const mount = (props?: Partial<React.ComponentProps<typeof OnboardingScreen>>): Promise<Instance> =>
  renderAsync(element(props));

const press = (root: Instance, text: string) =>
  act(async () => {
    const matches = pressables(root).filter(node => texts(node).includes(text));
    if (matches.length !== 1) {
      throw new Error(`Expected one "${text}" button, found ${matches.length}`);
    }
    matches[0].props.onPress();
  });
// The screen title is the first header; the skills step adds its own section headings after it.
const title = (root: Instance): string =>
  texts(root.findAll(node => node.props.accessibilityRole === 'header')[0])[0];
const progress = (root: Instance): string | undefined => texts(root).find(text => text.startsWith('Step '));
const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });

beforeEach(() => {
  onDone.mockReset();
  backHandlers = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_event: string, handler: () => boolean) => {
    backHandlers.push(handler);
    return { remove: jest.fn() };
  }) as never);
  mockComplete.mockReset().mockResolvedValue(undefined);
  mockConsent.mockReset().mockResolvedValue(CONSENT);
  mockCountries.mockReset().mockResolvedValue(COUNTRIES);
  mockUpdateMobile.mockReset().mockResolvedValue(undefined);
  mockPrefs.mockReset().mockResolvedValue([]);
  mockUpdatePref.mockReset().mockResolvedValue(undefined);
  mockSkills.mockReset().mockResolvedValue([]);
  mockUpdateSkill.mockReset().mockResolvedValue(undefined);
  mockSports.mockReset().mockResolvedValue(SPORTS);
  mockHasPermission.mockReset().mockResolvedValue(true);
  mockRequestPermission.mockReset();
});
afterEach(() => jest.restoreAllMocks());

describe('step order and navigation', () => {
  it('runs skills, notifications, then mobile number, with a step counter', async () => {
    const root = await mount();
    expect(title(root)).toBe('Your sports');
    expect(progress(root)).toBe('Step 1 of 3');
    await press(root, 'Skip');
    expect(title(root)).toBe('Notifications');
    expect(progress(root)).toBe('Step 2 of 3');
    await press(root, 'Skip');
    expect(title(root)).toBe('Mobile number (optional)');
    expect(progress(root)).toBe('Step 3 of 3');
  });

  it('every step has Skip, and Save (on the skills step Save follows Next, once a sport is picked)', async () => {
    const root = await mount();
    for (let step = 0; step < 3; step += 1) {
      const labels = pressables(root).map(node => node.props.accessibilityLabel);
      expect(labels).toEqual(expect.arrayContaining([step === 0 ? 'Next' : 'Save', 'Skip']));
      await press(root, 'Skip');
    }
  });

  it('Save advances just like Skip (notifications: toggles already saved)', async () => {
    const root = await mount();
    await press(root, 'Skip');
    expect(title(root)).toBe('Notifications');
    await press(root, 'Save');
    expect(title(root)).toBe('Mobile number (optional)');
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it('the final Save or Skip calls POST /users/me/onboarding/complete once, then finishes', async () => {
    const root = await mount();
    await press(root, 'Skip');
    await press(root, 'Skip');
    await press(root, 'Skip');
    expect(mockComplete).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('a failed complete dismisses locally for the session (fail open)', async () => {
    mockComplete.mockRejectedValue(httpError(500));
    const root = await mount();
    await press(root, 'Skip');
    await press(root, 'Skip');
    await press(root, 'Skip');
    expect(mockComplete).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('hardware back', () => {
  it('is consumed and never dismisses or advances the interstitial', async () => {
    const root = await mount();
    expect(backHandlers).toHaveLength(1);
    expect(backHandlers[0]()).toBe(true);
    expect(onDone).not.toHaveBeenCalled();
    expect(title(root)).toBe('Your sports');
  });
});

describe('flags and omitted steps', () => {
  it('omits the notification step when NOTIFICATION_STEP is OMIT', async () => {
    const root = await mount({ stepFlags: { notificationStep: 'OMIT', photoStep: 'OMIT' } });
    expect(progress(root)).toBe('Step 1 of 2');
    await press(root, 'Skip');
    expect(title(root)).toBe('Mobile number (optional)');
  });

  it('leaves the photo step out by default, and no photo screen exists even if flagged on', async () => {
    const root = await mount({ stepFlags: { notificationStep: 'ENABLED', photoStep: 'ENABLED' } });
    expect(progress(root)).toBe('Step 1 of 3');
    const seen: string[] = [title(root)];
    await press(root, 'Skip');
    seen.push(title(root));
    await press(root, 'Skip');
    seen.push(title(root));
    expect(seen).not.toContain('Profile photo');
  });

  it('omits the mobile number step when a number is already stored', async () => {
    const root = await mount({ hasMobileNumber: true });
    expect(progress(root)).toBe('Step 1 of 2');
    await press(root, 'Skip');
    await press(root, 'Skip');
    expect(mockComplete).toHaveBeenCalledTimes(1);
  });

  it('omits the mobile number step when the consent text fails to load', async () => {
    mockConsent.mockRejectedValue(new Error('down'));
    const root = await mount();
    expect(progress(root)).toBe('Step 1 of 2');
  });

  it('omits the mobile number step when the country list fails to load', async () => {
    mockCountries.mockRejectedValue(new Error('down'));
    const root = await mount();
    expect(progress(root)).toBe('Step 1 of 2');
  });
});

describe('skills step', () => {
  const allControls = (root: Instance, role: string): Instance[] =>
    root.findAll(node => node.props.accessibilityRole === role && typeof node.props.onPress === 'function');
  const tapRole = (root: Instance, role: string, label: string) =>
    act(async () => {
      const match = allControls(root, role).filter(node => node.props.accessibilityLabel === label);
      if (match.length !== 1) {
        throw new Error(`Expected one ${role} labelled "${label}", found ${match.length}`);
      }
      match[0].props.onPress();
    });

  it('picks sports, then a level per sport, and saves through the existing skill-level endpoint', async () => {
    const root = await mount();
    await tapRole(root, 'checkbox', 'Badminton');
    await tapRole(root, 'checkbox', 'Tennis');
    await press(root, 'Next');
    await tapRole(root, 'radio', 'Badminton, Beginner');
    await tapRole(root, 'radio', 'Tennis, Expert');
    await press(root, 'Save');
    expect(mockUpdateSkill.mock.calls.map(([sport, level]) => [sport, level])).toEqual([
      ['badminton', 'Beginner'],
      ['tennis', 'Expert'],
    ]);
    expect(title(root)).toBe('Notifications');
  });

  it('pre-selects sports that already have a level and only sends changed levels', async () => {
    mockSkills.mockResolvedValue([{ sport: 'Badminton', skill_level: 'Intermediate' }]);
    const root = await mount();
    const checked = allControls(root, 'checkbox').filter(node => node.props.accessibilityState.checked);
    expect(checked.map(node => node.props.accessibilityLabel)).toEqual(['Badminton']);
    await press(root, 'Next');
    await press(root, 'Save');
    expect(mockUpdateSkill).not.toHaveBeenCalled();
    expect(title(root)).toBe('Notifications');
  });

  it('does not save while a selected sport has no level', async () => {
    const root = await mount();
    await tapRole(root, 'checkbox', 'Badminton');
    await press(root, 'Next');
    await press(root, 'Save');
    expect(mockUpdateSkill).not.toHaveBeenCalled();
    expect(title(root)).toBe('Your sports');
    expect(root.findAll(node => node.props.accessibilityRole === 'alert', { deep: false })).toHaveLength(1);
  });

  it('shows an inline error when a save fails and keeps Skip available', async () => {
    mockUpdateSkill.mockRejectedValue(httpError(500));
    const root = await mount();
    await tapRole(root, 'checkbox', 'Badminton');
    await press(root, 'Next');
    await tapRole(root, 'radio', 'Badminton, Expert');
    await press(root, 'Save');
    expect(texts(root)).toContain('Could not save your skill levels. Please try again.');
    expect(title(root)).toBe('Your sports');
    await press(root, 'Skip');
    expect(title(root)).toBe('Notifications');
  });

  it('lets the user continue when the sports list cannot load', async () => {
    mockSports.mockRejectedValue(new Error('down'));
    const root = await mount();
    expect(texts(root)).toContain('Could not load sports.');
    await press(root, 'Skip');
    expect(title(root)).toBe('Notifications');
  });
});

describe('notifications step', () => {
  it('embeds the same list component the Settings screen uses', async () => {
    const root = await mount();
    await press(root, 'Skip');
    expect(root.findAllByType(NotificationPreferencesList)).toHaveLength(1);
  });

  it('shows the device-permission banner only when the permission is not granted, and never re-prompts', async () => {
    mockHasPermission.mockResolvedValue(false);
    const denied = await mount();
    await press(denied, 'Skip');
    expect(denied.findAll(node => node.props.testID === 'notification-permission-banner')).not.toHaveLength(0);

    mockHasPermission.mockResolvedValue(true);
    const granted = await mount();
    await press(granted, 'Skip');
    expect(granted.findAll(node => node.props.testID === 'notification-permission-banner')).toHaveLength(0);
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });
});

describe('mobile number step', () => {
  async function toMobileStep(): Promise<Instance> {
    const root = await mount();
    await press(root, 'Skip');
    await press(root, 'Skip');
    return root;
  }
  const type = (root: Instance, value: string) => act(async () => root.findByType(TextInput).props.onChangeText(value));

  it('saves a number with the consent version, then completes', async () => {
    const root = await toMobileStep();
    await type(root, '9123 4567');
    await press(root, 'Save');
    expect(mockUpdateMobile).toHaveBeenCalledWith(
      { mobile_number: '+6591234567', mobile_consent_version: 'mobile-consent-v1' },
      expect.anything(),
    );
    expect(mockComplete).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalled();
  });

  it('Save with an empty field sends nothing and completes', async () => {
    const root = await toMobileStep();
    await press(root, 'Save');
    expect(mockUpdateMobile).not.toHaveBeenCalled();
    expect(mockComplete).toHaveBeenCalledTimes(1);
  });

  it('a 422 shows an inline error without the value and keeps Skip available', async () => {
    mockUpdateMobile.mockRejectedValue(httpError(422));
    const root = await toMobileStep();
    await type(root, '9123 4567');
    await press(root, 'Save');
    expect(texts(root)).toContain('Enter a valid mobile number.');
    expect(texts(root).join(' ')).not.toMatch(/91234567|9123 4567/);
    expect(mockComplete).not.toHaveBeenCalled();
    await press(root, 'Skip');
    expect(mockComplete).toHaveBeenCalledTimes(1);
  });

  it('a 409 refetches the consent text and asks for a fresh confirmation', async () => {
    mockUpdateMobile.mockRejectedValueOnce(httpError(409));
    const root = await toMobileStep();
    await type(root, '9123 4567');
    mockConsent.mockResolvedValue({ version: 'mobile-consent-v2', text: 'New consent' });
    await press(root, 'Save');
    expect(texts(root)).toContain('New consent');
    await press(root, 'Confirm and save');
    expect(mockUpdateMobile.mock.calls[1][0]).toEqual({
      mobile_number: '+6591234567',
      mobile_consent_version: 'mobile-consent-v2',
    });
    expect(mockComplete).toHaveBeenCalledTimes(1);
  });
});
