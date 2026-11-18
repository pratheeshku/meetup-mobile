/**
 * Profile: `display_name` is the editable name used to address the user;
 * `nickname` is unique, read-only, and must never be editable or PATCHed.
 *
 * Editing lives on the screens the Profile screen links to: display name and
 * photo on `EditProfileScreen`, skill levels (add, change, delete) on
 * `EditSkillLevelsScreen`. Those flows are exercised here by rendering the
 * screen that now owns them.
 */
import React from 'react';
import { Alert } from 'react-native';

import {
  deleteAvatar,
  deleteSkillLevel,
  getProfile,
  getSkillLevels,
  updateProfile,
  updateSkillLevel,
  uploadAvatar,
} from '../../api/profile';
import { getSports } from '../../api/sports';
import ImageCropPicker from 'react-native-image-crop-picker';
import { act, pressableLabelled, pressableWithText, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { __resetSportDisplayNamesCacheForTests } from '../../utils/labels';
import type { UserProfile } from '../../types/user';
import EditProfileScreen from '../EditProfileScreen';
import EditSkillLevelsScreen from '../EditSkillLevelsScreen';
import ProfileScreen from '../ProfileScreen';

type Props = React.ComponentProps<typeof ProfileScreen>;
type EditProps = React.ComponentProps<typeof EditProfileScreen>;
type SkillProps = React.ComponentProps<typeof EditSkillLevelsScreen>;

const mockUpdateUser = jest.fn();
// Mobile number card (profile-onboarding addendum): its own endpoints are covered in
// `MobileNumberCard.test.tsx`; here they fail so the card stays hidden.
jest.mock('../../api/mobileNumber', () => ({
  getMobileConsent: jest.fn(() => Promise.reject(new Error('unavailable'))),
  getCountryCodes: jest.fn(() => Promise.reject(new Error('unavailable'))),
  updateMobileNumber: jest.fn(),
  classifyMobileNumberError: jest.fn(() => 'other'),
}));
jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ signOut: jest.fn(), updateUser: mockUpdateUser }),
}));
const mockShowCompletion = jest.fn();
jest.mock('../../navigation/showCompletion', () => ({
  showCompletion: (...args: unknown[]) => mockShowCompletion(...args),
}));
jest.mock('../../api/profile', () => ({
  getProfile: jest.fn(),
  getSkillLevels: jest.fn(),
  uploadCover: jest.fn(),
  deleteCover: jest.fn(),
  getProfileSummary: jest.fn().mockResolvedValue({ games_played: 0, games_hosted: 0, groups_count: 0, recent_games: [] }),
  updateProfile: jest.fn(),
  updateSkillLevel: jest.fn(),
  deleteSkillLevel: jest.fn(),
  requestDeletion: jest.fn(),
  confirmDeletion: jest.fn(),
  uploadAvatar: jest.fn(),
  deleteAvatar: jest.fn(),
}));
jest.mock('../../api/groups', () => ({
  getMyGroups: jest.fn().mockResolvedValue({ items: [], total: 0 }),
}));
jest.mock('../../api/home', () => ({
  getCachedBanners: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));

const mockGetProfile = getProfile as jest.MockedFunction<typeof getProfile>;
const mockUpdateProfile = updateProfile as jest.MockedFunction<typeof updateProfile>;
const mockUpdateSkillLevel = updateSkillLevel as jest.MockedFunction<typeof updateSkillLevel>;
const mockDeleteSkillLevel = deleteSkillLevel as jest.MockedFunction<typeof deleteSkillLevel>;
const mockGetSkillLevels = getSkillLevels as jest.MockedFunction<typeof getSkillLevels>;
const mockGetSports = getSports as jest.MockedFunction<typeof getSports>;
const mockUploadAvatar = uploadAvatar as jest.MockedFunction<typeof uploadAvatar>;
const mockDeleteAvatar = deleteAvatar as jest.MockedFunction<typeof deleteAvatar>;
const mockOpenPicker = ImageCropPicker.openPicker as jest.MockedFunction<typeof ImageCropPicker.openPicker>;
const mockOpenCamera = ImageCropPicker.openCamera as jest.MockedFunction<typeof ImageCropPicker.openCamera>;

/**
 * `Alert.alert` has no test-env implementation (bare RN, no mock configured
 * in `jest.setup.js` — nothing in this codebase confirms/dismisses a native
 * alert). Spied here to capture the buttons array and invoke the
 * destructive one directly, same as tapping "Remove" in the real dialog.
 */
function confirmAlert(buttonText: string): unknown {
  const alertSpy = Alert.alert as unknown as jest.Mock;
  const [, , buttons] = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
  const button = (buttons as { text: string; onPress?: () => unknown }[]).find(
    b => b.text === buttonText,
  );
  return button?.onPress?.();
}

const PROFILE: UserProfile = {
  id: 'u-1',
  email: 'sam@example.com',
  nickname: 'sam99',
  display_name: 'Sam Smith',
  skill_levels: [],
};

const SPORTS = [
  { name: 'table_tennis', display_name: 'Table Tennis' },
  { name: 'badminton', display_name: 'Badminton' },
];

const mount = (): Promise<Instance> =>
  renderAsync(<ProfileScreen {...({ navigation: { navigate: jest.fn() }, route: {} } as unknown as Props)} />);

const mountEditProfile = (): Promise<Instance> =>
  renderAsync(
    <EditProfileScreen
      {...({ navigation: { navigate: jest.fn(), goBack: mockGoBack }, route: {} } as unknown as EditProps)}
    />,
  );

const mountEditSkills = (): Promise<Instance> =>
  renderAsync(
    <EditSkillLevelsScreen
      {...({ navigation: { navigate: jest.fn(), goBack: mockGoBack }, route: {} } as unknown as SkillProps)}
    />,
  );

const mockGoBack = jest.fn();

/** The Edit profile form has a single text field, the display name. */
const displayNameInput = (root: Instance): Instance =>
  root.find(node => (node.type as unknown) === 'TextInput' && node.props.placeholder === 'Display name');

/** A control found by role + accessibility label (tiles are checkboxes, level segments are radios). */
const control = (root: Instance, role: string, label: string): Instance => {
  const matches = root.findAll(
    node =>
      node.props.accessibilityRole === role &&
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  );
  if (matches.length !== 1) {
    throw new Error(`Expected one ${role} labelled "${label}", found ${matches.length}`);
  }
  return matches[0];
};
const tap = (root: Instance, role: string, label: string): void => {
  act(() => control(root, role, label).props.onPress());
};

beforeEach(() => {
  mockUpdateUser.mockReset();
  mockUpdateProfile.mockReset().mockResolvedValue(undefined);
  mockGetProfile.mockReset().mockResolvedValue(PROFILE);
  mockUpdateSkillLevel.mockReset().mockResolvedValue(undefined);
  mockDeleteSkillLevel.mockReset().mockResolvedValue(undefined);
  mockGetSports.mockReset().mockResolvedValue(SPORTS);
  mockGetSkillLevels.mockReset().mockResolvedValue([]);
  mockShowCompletion.mockReset();
  mockGoBack.mockReset();
  mockUploadAvatar.mockReset().mockResolvedValue(undefined);
  mockDeleteAvatar.mockReset().mockResolvedValue(undefined);
  const cancelledError: any = new Error('User cancelled image selection');
  cancelledError.code = 'E_PICKER_CANCELLED';
  mockOpenCamera.mockReset().mockRejectedValue(cancelledError);
  mockOpenPicker.mockReset().mockRejectedValue(cancelledError);
  jest.spyOn(Alert, 'alert').mockReset();
  __resetSportDisplayNamesCacheForTests();
});

describe('ProfileScreen names', () => {
  it('titles the profile with display_name', async () => {
    const root = await mount();
    expect(texts(root)).toContain('Sam Smith');
  });

  it('shows the nickname as a read-only @ line, not the title', async () => {
    const root = await mount();
    const t = texts(root);
    // The nickname is a separate '@' line under the title (no longer a "Nickname: ... (can't be changed)" caption).
    expect(t).toContain('@sam99');
    expect(t).not.toContain('sam99');
  });

  it('falls back to the nickname for the title when display_name is blank', async () => {
    mockGetProfile.mockResolvedValue({ ...PROFILE, display_name: '  ' });
    expect(texts(await mount())).toContain('sam99');
  });
});

describe('ProfileScreen links to the editing screens', () => {
  it('offers Edit profile and Settings, and has no inline editing controls', async () => {
    const root = await mount();
    expect(pressableLabelled(root, 'Edit profile')).toBeTruthy();
    expect(pressableLabelled(root, 'Settings')).toBeTruthy();
    expect(root.findAll(node => (node.type as unknown) === 'TextInput')).toHaveLength(0);
    expect(texts(root)).not.toContain('Save');
  });
});

describe('EditProfileScreen display name editing', () => {
  async function startEdit(): Promise<Instance> {
    return mountEditProfile();
  }

  it('edits display_name (prefilled), never nickname', async () => {
    const root = await startEdit();
    expect(displayNameInput(root).props.value).toBe('Sam Smith');
    // Nickname is read-only text, not an input: the only text field is the display name.
    expect(texts(root)).toContain('sam99');
    expect(root.findAll(node => (node.type as unknown) === 'TextInput')).toHaveLength(1);
  });

  it('saves via PATCH { display_name } only', async () => {
    const root = await startEdit();
    act(() => displayNameInput(root).props.onChangeText('  Sammy '));
    await act(async () => pressableWithText(root, 'Save').props.onPress());

    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    expect(mockUpdateProfile.mock.calls[0][0]).toEqual({ display_name: 'Sammy' });
    expect(mockShowCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ flow: 'profile_updated', rows: [{ label: 'Display name', value: 'Sammy' }] }),
    );
  });

  // Product regression, left failing on purpose: EditProfileScreen never calls `updateUser`, so the
  // Home greeting (reads the cached auth user) stays stale after a rename.
  // Source: docs/reports/IMPL-DES-MEETUP-MOBILE-fixes-hooks-fab-displayname.md, P1.
  it('refreshes the auth user after a successful save', async () => {
    const root = await startEdit();
    act(() => displayNameInput(root).props.onChangeText('Sammy'));
    await act(async () => pressableWithText(root, 'Save').props.onPress());
    expect(mockUpdateUser).toHaveBeenCalledWith({ display_name: 'Sammy' });
  });

  it('rejects an empty display name without calling the API', async () => {
    const root = await startEdit();
    act(() => displayNameInput(root).props.onChangeText('   '));
    await act(async () => pressableWithText(root, 'Save').props.onPress());
    // An empty name is never sent; the form leaves without a PATCH or a completion screen.
    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(mockShowCompletion).not.toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('shows an error and leaves the auth user alone when the save fails', async () => {
    mockUpdateProfile.mockRejectedValue(new Error('boom'));
    const root = await startEdit();
    act(() => displayNameInput(root).props.onChangeText('Sammy'));
    await act(async () => pressableWithText(root, 'Save').props.onPress());
    expect(texts(root)).toContain('Could not save profile. Please try again.');
    expect(mockShowCompletion).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});

describe('EditSkillLevelsScreen add sport (BUG-M05, skill-level redesign)', () => {
  it('offers the sport list from GET /admin/sports/public as level radios, not a free-text field', async () => {
    const root = await mountEditSkills();
    expect(control(root, 'radio', 'Table Tennis, Beginner')).toBeTruthy();
    expect(control(root, 'radio', 'Badminton, Expert')).toBeTruthy();
    expect(root.findAll(node => (node.type as unknown) === 'TextInput')).toHaveLength(0);
  });

  it('lists every sport; a sport already set shows its level selected and Clear, the rest show Not set', async () => {
    mockGetSkillLevels.mockResolvedValue([{ sport: 'table_tennis', skill_level: 'beginner' }]);
    const root = await mountEditSkills();
    const selected = root.findAll(
      node =>
        node.props.accessibilityRole === 'radio' &&
        typeof node.props.onPress === 'function' &&
        node.props.accessibilityState?.selected === true,
    );
    expect(selected.map(node => node.props.accessibilityLabel)).toEqual(['Table Tennis, Beginner']);
    expect(control(root, 'radio', 'Badminton, Beginner')).toBeTruthy();
    expect(texts(root).filter(text => text === 'Clear')).toHaveLength(1);
    expect(texts(root).filter(text => text === 'Not set')).toHaveLength(1);
  });

  it('saves the chosen sport’s name (not its display label) with the chosen level', async () => {
    const root = await mountEditSkills();
    tap(root, 'radio', 'Table Tennis, Intermediate');
    await act(async () => pressableWithText(root, 'Done').props.onPress());
    expect(mockUpdateSkillLevel).toHaveBeenCalledTimes(1);
    expect(mockUpdateSkillLevel).toHaveBeenCalledWith('table_tennis', 'intermediate');
    expect(mockShowCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'skills_updated',
        rows: [{ label: 'Table Tennis', value: 'Intermediate' }],
      }),
    );
  });

  it('does not save a sport that has no level', async () => {
    const root = await mountEditSkills();
    await act(async () => pressableWithText(root, 'Done').props.onPress());
    expect(mockUpdateSkillLevel).not.toHaveBeenCalled();
    expect(mockDeleteSkillLevel).not.toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('shows a hint instead of a broken empty picker when no sports are available', async () => {
    mockGetSports.mockResolvedValue([]);
    const root = await mountEditSkills();
    expect(texts(root)).toContain('No sports are available right now.');
  });

  it('shows the save error on the screen when the PUT fails', async () => {
    mockUpdateSkillLevel.mockRejectedValue(new Error('down'));
    const root = await mountEditSkills();
    tap(root, 'radio', 'Badminton, Beginner');
    await act(async () => pressableWithText(root, 'Done').props.onPress());
    expect(texts(root)).toContain('Could not save your skill level. Please try again.');
    expect(mockShowCompletion).not.toHaveBeenCalled();
  });
});

describe('ProfileScreen skill-levels list sport display name (BUG-M02)', () => {
  it('resolves each declared sport to its display_name instead of the raw slug', async () => {
    mockGetProfile.mockResolvedValue({
      ...PROFILE,
      skill_levels: [{ sport: 'table_tennis', skill_level: 'intermediate' }],
    });
    const root = await mount();
    expect(texts(root)).toEqual(expect.arrayContaining(['Table Tennis', 'Intermediate']));
    expect(texts(root)).not.toContain('table_tennis');
  });

  it('falls back to the raw slug for a declared sport not in the sports list', async () => {
    mockGetProfile.mockResolvedValue({
      ...PROFILE,
      skill_levels: [{ sport: 'unlisted_sport', skill_level: 'beginner' }],
    });
    const root = await mount();
    expect(texts(root)).toContain('unlisted_sport');
  });
});

describe('ProfileScreen skills card and EditSkillLevelsScreen changes', () => {
  const WITH_ONE_SKILL_LEVEL: UserProfile = {
    ...PROFILE,
    skill_levels: [{ sport: 'table_tennis', skill_level: 'intermediate' }],
  };

  it('lists read-only rows on Profile: no editing controls', async () => {
    mockGetProfile.mockResolvedValue(WITH_ONE_SKILL_LEVEL);
    const root = await mount();
    expect(texts(root)).toContain('Skills');
    expect(texts(root)).toEqual(expect.arrayContaining(['Table Tennis', 'Intermediate']));
    expect(texts(root)).not.toContain('Save');
    expect(texts(root)).not.toContain('Remove');
    expect(texts(root)).not.toContain('Clear');
  });

  it('opens the skill screen for one sport with its stored level selected and the others unselected', async () => {
    mockGetSkillLevels.mockResolvedValue([
      { sport: 'table_tennis', skill_level: 'intermediate' },
      { sport: 'badminton', skill_level: 'beginner' },
    ]);
    const root = await mountEditSkills();
    const selected = root.findAll(
      node =>
        node.props.accessibilityRole === 'radio' &&
        typeof node.props.onPress === 'function' &&
        node.props.accessibilityState?.selected === true,
    );
    expect(selected.map(node => node.props.accessibilityLabel)).toEqual([
      'Table Tennis, Intermediate',
      'Badminton, Beginner',
    ]);
  });

  it('changes the level: PUTs the new level for that sport only', async () => {
    mockGetSkillLevels.mockResolvedValue([{ sport: 'table_tennis', skill_level: 'intermediate' }]);
    const root = await mountEditSkills();
    tap(root, 'radio', 'Table Tennis, Expert');
    await act(async () => pressableWithText(root, 'Done').props.onPress());
    expect(mockUpdateSkillLevel).toHaveBeenCalledTimes(1);
    expect(mockUpdateSkillLevel).toHaveBeenCalledWith('table_tennis', 'expert');
    expect(mockDeleteSkillLevel).not.toHaveBeenCalled();
  });

  it('Back leaves the screen without saving', async () => {
    mockGetSkillLevels.mockResolvedValue([{ sport: 'table_tennis', skill_level: 'intermediate' }]);
    const root = await mountEditSkills();
    tap(root, 'radio', 'Table Tennis, Expert');
    act(() => pressableLabelled(root, 'Back').props.onPress());
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(mockUpdateSkillLevel).not.toHaveBeenCalled();
  });
});

describe('EditSkillLevelsScreen skill-level delete (ADDENDUM-MOBILE-SKILL-DELETE-001)', () => {
  beforeEach(() => {
    mockGetSkillLevels.mockResolvedValue([{ sport: 'table_tennis', skill_level: 'intermediate' }]);
  });

  it('Clear only stages the removal: nothing is DELETEd until Done', async () => {
    const root = await mountEditSkills();
    await act(async () => pressableLabelled(root, 'Table Tennis Clear').props.onPress());
    expect(mockDeleteSkillLevel).not.toHaveBeenCalled();
    expect(texts(root)).toContain('Not set');
  });

  it('on Done: DELETEs the entry and shows the removal on the completion screen', async () => {
    const root = await mountEditSkills();
    await act(async () => pressableLabelled(root, 'Table Tennis Clear').props.onPress());
    await act(async () => pressableWithText(root, 'Done').props.onPress());

    expect(mockDeleteSkillLevel).toHaveBeenCalledWith('table_tennis');
    expect(mockShowCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'skills_updated',
        rows: [{ label: 'Table Tennis', value: 'Removed' }],
      }),
    );
  });

  it('tournament lock (409): shows the backend message verbatim; the entry stays; no completion screen', async () => {
    mockDeleteSkillLevel.mockRejectedValue({
      response: {
        status: 409,
        data: { detail: 'Cannot remove: you have an active tournament registration for this sport.' },
      },
    });
    const root = await mountEditSkills();
    await act(async () => pressableLabelled(root, 'Table Tennis Clear').props.onPress());
    await act(async () => pressableWithText(root, 'Done').props.onPress());

    expect(texts(root)).toContain('Cannot remove: you have an active tournament registration for this sport.');
    expect(mockShowCompletion).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('falls back to a generic message when the failure carries no usable detail (e.g. network error)', async () => {
    mockDeleteSkillLevel.mockRejectedValue(new Error('network down'));
    const root = await mountEditSkills();
    await act(async () => pressableLabelled(root, 'Table Tennis Clear').props.onPress());
    await act(async () => pressableWithText(root, 'Done').props.onPress());

    expect(texts(root)).toContain('Could not remove this skill level. Please try again.');
    expect(mockShowCompletion).not.toHaveBeenCalled();
  });
});

describe('EditProfileScreen avatar (DES-MEETUP-ADDENDUM-profile-photo §10)', () => {
  const PROFILE_WITH_AVATAR: UserProfile = {
    ...PROFILE,
    avatar_url: 'https://meetup.hel1.your-objectstorage.com/avatars/u-1.png',
  };
  const fastImageUris = (root: Instance): unknown[] =>
    root.findAll(node => node.props.testID === 'fastImage').map(node => node.props.source?.uri);
  /** The avatar itself and the "Change photo" link both open the photo menu; this is the avatar. */
  const avatarPressable = (root: Instance): Instance => {
    const matches = root.findAll(
      node =>
        node.props.accessibilityRole === 'button' &&
        node.props.accessibilityLabel === 'Change photo' &&
        typeof node.props.onPress === 'function' &&
        texts(node).every(text => text !== 'Change photo'),
    );
    expect(matches.length).toBeGreaterThan(0);
    return matches[0];
  };
  const openPhotoMenu = (root: Instance): void => {
    act(() => {
      avatarPressable(root).props.onPress();
    });
  };
  const photoPickerOptions = {
    mediaType: 'photo',
    cropping: true,
    width: 500,
    height: 500,
    compressImageQuality: 0.8,
    cropperToolbarTitle: 'Edit Photo',
  };

  it('renders the initials placeholder when avatar_url is null', async () => {
    const root = await mountEditProfile();
    expect(texts(root)).toContain('SS');
    expect(fastImageUris(root)).toHaveLength(0);
  });

  it('renders the avatar photo when avatar_url is present', async () => {
    mockGetProfile.mockResolvedValue(PROFILE_WITH_AVATAR);
    const root = await mountEditProfile();
    expect(fastImageUris(root)).toContain(PROFILE_WITH_AVATAR.avatar_url);
  });

  it('shows the "Change photo" pressable, with a decorative camera badge that is not a separate touch target', async () => {
    const root = await mountEditProfile();
    const avatar = avatarPressable(root);
    // The Pressable renders its own wrapper nodes (same label); a different button inside would be a second target.
    const nested = avatar.findAll(
      node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel !== 'Change photo',
    );
    expect(nested).toHaveLength(0);
  });

  it('tapping the avatar when no photo shows camera/library options without Remove', async () => {
    const root = await mountEditProfile();
    openPhotoMenu(root);
    const alertSpy = Alert.alert as unknown as jest.Mock;
    const [title, , buttons] = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
    expect(title).toBe('Profile photo');
    const buttonTexts = (buttons as { text: string }[]).map(b => b.text);
    expect(buttonTexts).toContain('Take Photo');
    expect(buttonTexts).toContain('Choose from Library');
    expect(buttonTexts).not.toContain('Remove Photo');
  });

  it('tapping the avatar when photo exists shows camera/library/remove options', async () => {
    mockGetProfile.mockResolvedValue(PROFILE_WITH_AVATAR);
    const root = await mountEditProfile();
    openPhotoMenu(root);
    const alertSpy = Alert.alert as unknown as jest.Mock;
    const [, , buttons] = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
    const buttonTexts = (buttons as { text: string }[]).map(b => b.text);
    expect(buttonTexts).toContain('Take Photo');
    expect(buttonTexts).toContain('Choose from Library');
    expect(buttonTexts).toContain('Remove Photo');
  });

  it('choosing from library → crop options passed → preview shown → Save uploads', async () => {
    mockOpenPicker.mockResolvedValue({
      path: 'file:///local/photo-cropped.jpg',
      filename: 'photo-cropped.jpg',
      mime: 'image/jpeg',
      width: 500,
      height: 500,
      size: 102400,
    } as any);

    const root = await mountEditProfile();
    openPhotoMenu(root);
    await act(async () => {
      await confirmAlert('Choose from Library');
    });

    expect(mockOpenPicker).toHaveBeenCalledWith(expect.objectContaining(photoPickerOptions));
    // The new photo is a local preview until Save.
    expect(fastImageUris(root)).toContain('file:///local/photo-cropped.jpg');
    expect(mockUploadAvatar).not.toHaveBeenCalled();

    await act(async () => pressableWithText(root, 'Save').props.onPress());
    expect(mockUploadAvatar).toHaveBeenCalledWith('file:///local/photo-cropped.jpg', 'photo-cropped.jpg', 'image/jpeg');
    expect(mockShowCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ flow: 'profile_updated', rows: [{ label: 'Profile photo', value: 'Updated' }] }),
    );
  });

  it('taking photo with camera → crop options passed → Save uploads', async () => {
    mockOpenCamera.mockResolvedValue({
      path: 'file:///local/camera-cropped.jpg',
      filename: 'camera-cropped.jpg',
      mime: 'image/jpeg',
      width: 500,
      height: 500,
      size: 102400,
    } as any);

    const root = await mountEditProfile();
    openPhotoMenu(root);
    await act(async () => {
      await confirmAlert('Take Photo');
    });

    expect(mockOpenCamera).toHaveBeenCalledWith(expect.objectContaining(photoPickerOptions));
    await act(async () => pressableWithText(root, 'Save').props.onPress());
    expect(mockUploadAvatar).toHaveBeenCalledWith('file:///local/camera-cropped.jpg', 'camera-cropped.jpg', 'image/jpeg');
  });

  it('upload failure on Save shows the server message and does not complete', async () => {
    mockUploadAvatar.mockRejectedValue({
      response: { status: 413, data: { detail: 'File too large.' } },
    });
    mockOpenPicker.mockResolvedValue({
      path: 'file:///local/big-photo.jpg',
      filename: 'big-photo.jpg',
      mime: 'image/jpeg',
      width: 4000,
      height: 4000,
      size: 10485760,
    } as any);

    const root = await mountEditProfile();
    openPhotoMenu(root);
    await act(async () => {
      await confirmAlert('Choose from Library');
    });
    await act(async () => pressableWithText(root, 'Save').props.onPress());

    // Error message surfaced via getApiErrorMessage (same pattern as skill-level 409)
    expect(texts(root)).toContain('File too large.');
    expect(mockShowCompletion).not.toHaveBeenCalled();
  });

  it('removing avatar → placeholder renders → Save DELETEs', async () => {
    mockGetProfile.mockResolvedValue(PROFILE_WITH_AVATAR);

    const root = await mountEditProfile();
    openPhotoMenu(root);
    act(() => {
      confirmAlert('Remove Photo');
    });

    expect(fastImageUris(root)).not.toContain(PROFILE_WITH_AVATAR.avatar_url);
    expect(texts(root)).toContain('SS');
    expect(mockDeleteAvatar).not.toHaveBeenCalled();

    await act(async () => pressableWithText(root, 'Save').props.onPress());
    expect(mockDeleteAvatar).toHaveBeenCalledTimes(1);
    expect(mockShowCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ flow: 'profile_updated', rows: [{ label: 'Profile photo', value: 'Removed' }] }),
    );
  });

  it('remove failure on Save shows an error and does not complete', async () => {
    mockGetProfile.mockResolvedValue(PROFILE_WITH_AVATAR);
    mockDeleteAvatar.mockRejectedValue(new Error('network error'));

    const root = await mountEditProfile();
    openPhotoMenu(root);
    act(() => {
      confirmAlert('Remove Photo');
    });
    await act(async () => pressableWithText(root, 'Save').props.onPress());

    expect(texts(root)).toContain('Could not save profile. Please try again.');
    expect(mockShowCompletion).not.toHaveBeenCalled();
  });

  it('cancelled image picker does not stage or upload anything', async () => {
    const error: any = new Error('User cancelled image selection');
    error.code = 'E_PICKER_CANCELLED';
    mockOpenPicker.mockRejectedValue(error);

    const root = await mountEditProfile();
    openPhotoMenu(root);
    await act(async () => {
      await confirmAlert('Choose from Library');
    });
    await act(async () => pressableWithText(root, 'Save').props.onPress());

    expect(mockUploadAvatar).not.toHaveBeenCalled();
    expect(mockShowCompletion).not.toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
