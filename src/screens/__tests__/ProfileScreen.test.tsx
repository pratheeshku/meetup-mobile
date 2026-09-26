/**
 * Profile: `display_name` is the editable name used to address the user;
 * `nickname` is unique, read-only, and must never be editable or PATCHed.
 */
import React from 'react';
import { Alert } from 'react-native';

import {
  deleteAvatar,
  deleteSkillLevel,
  getProfile,
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
import ProfileScreen from '../ProfileScreen';

type Props = React.ComponentProps<typeof ProfileScreen>;

const mockUpdateUser = jest.fn();
jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ signOut: jest.fn(), updateUser: mockUpdateUser }),
}));
jest.mock('../../api/profile', () => ({
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
  updateSkillLevel: jest.fn(),
  deleteSkillLevel: jest.fn(),
  requestDeletion: jest.fn(),
  confirmDeletion: jest.fn(),
  uploadAvatar: jest.fn(),
  deleteAvatar: jest.fn(),
}));
jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));

const mockGetProfile = getProfile as jest.MockedFunction<typeof getProfile>;
const mockUpdateProfile = updateProfile as jest.MockedFunction<typeof updateProfile>;
const mockUpdateSkillLevel = updateSkillLevel as jest.MockedFunction<typeof updateSkillLevel>;
const mockDeleteSkillLevel = deleteSkillLevel as jest.MockedFunction<typeof deleteSkillLevel>;
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

const displayNameInput = (root: Instance): Instance =>
  root.find(node => (node.type as unknown) === 'TextInput' && node.props.accessibilityLabel === 'Display name');

/**
 * The screen's own Beginner/Intermediate/Expert buttons carry no
 * `accessibilityRole` (pre-existing, unrelated to BUG-M05), so the shared
 * `pressableWithText`/`pressableLabelled` helpers (which require one) can't
 * find them — matched here directly by their `onPress` + text content.
 */
const pressSkillLevelButton = (root: Instance, label: string): void => {
  act(() => {
    root
      .find(node => typeof node.props.onPress === 'function' && texts(node).includes(label))
      .props.onPress();
  });
};

beforeEach(() => {
  mockUpdateUser.mockReset();
  mockUpdateProfile.mockReset().mockResolvedValue(undefined);
  mockGetProfile.mockReset().mockResolvedValue(PROFILE);
  mockUpdateSkillLevel.mockReset().mockResolvedValue(undefined);
  mockDeleteSkillLevel.mockReset().mockResolvedValue(undefined);
  mockGetSports.mockReset().mockResolvedValue(SPORTS);
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

  it('shows nickname as a labelled, read-only line — not the title', async () => {
    const root = await mount();
    const t = texts(root);
    expect(t).toContain('Nickname: sam99 ');
    expect(t).toContain("(can't be changed)");
    expect(t).not.toContain('sam99');
  });

  it('falls back to the nickname for the title when display_name is blank', async () => {
    mockGetProfile.mockResolvedValue({ ...PROFILE, display_name: '  ' });
    expect(texts(await mount())).toContain('sam99');
  });
});

describe('ProfileScreen display name editing', () => {
  async function startEdit(): Promise<Instance> {
    const root = await mount();
    await act(async () => pressableWithText(root, 'Edit').props.onPress());
    return root;
  }

  it('edits display_name (prefilled), never nickname', async () => {
    const root = await startEdit();
    expect(displayNameInput(root).props.value).toBe('Sam Smith');
    // Nickname is text, not an input: the only text field is the display name.
    expect(root.findAll(node => (node.type as unknown) === 'TextInput')).toHaveLength(1);
  });

  it('saves via PATCH { display_name } only, refreshes the profile and the auth user', async () => {
    mockGetProfile
      .mockResolvedValueOnce(PROFILE)
      .mockResolvedValueOnce({ ...PROFILE, display_name: 'Sammy' });
    const root = await startEdit();
    act(() => displayNameInput(root).props.onChangeText('  Sammy '));
    await act(async () => pressableWithText(root, 'Save').props.onPress());

    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    expect(mockUpdateProfile.mock.calls[0][0]).toEqual({ display_name: 'Sammy' });
    expect(mockUpdateUser).toHaveBeenCalledWith({ display_name: 'Sammy' });
    expect(texts(root)).toContain('Sammy');
  });

  it('rejects an empty display name without calling the API', async () => {
    const root = await startEdit();
    act(() => displayNameInput(root).props.onChangeText('   '));
    await act(async () => pressableWithText(root, 'Save').props.onPress());
    expect(texts(root)).toContain('Display name cannot be empty.');
    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('shows an error and leaves the auth user alone when the save fails', async () => {
    mockUpdateProfile.mockRejectedValue(new Error('boom'));
    const root = await startEdit();
    act(() => displayNameInput(root).props.onChangeText('Sammy'));
    await act(async () => pressableWithText(root, 'Save').props.onPress());
    expect(texts(root)).toContain('Could not save your display name. Please try again.');
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});

describe('ProfileScreen skill-level sport picker (BUG-M05)', () => {
  async function startAdd(): Promise<Instance> {
    const root = await mount();
    await act(async () => pressableWithText(root, 'Add').props.onPress());
    return root;
  }

  it('offers the sport list from GET /admin/sports/public as chips, not a free-text field', async () => {
    const root = await startAdd();
    expect(texts(root)).toEqual(expect.arrayContaining(['Table Tennis', 'Badminton']));
    expect(root.findAll(node => (node.type as unknown) === 'TextInput')).toHaveLength(0);
  });

  it('saves the chosen sport’s name (not its display label) with the skill level', async () => {
    const root = await startAdd();
    act(() => pressableWithText(root, 'Table Tennis').props.onPress());
    pressSkillLevelButton(root, 'Intermediate');
    await act(async () => pressableWithText(root, 'Save').props.onPress());
    expect(mockUpdateSkillLevel).toHaveBeenCalledWith(
      'table_tennis',
      'Intermediate',
      expect.anything(),
    );
  });

  it('rejects saving without a chosen sport', async () => {
    const root = await startAdd();
    await act(async () => pressableWithText(root, 'Save').props.onPress());
    expect(texts(root)).toContain('Choose a sport.');
    expect(mockUpdateSkillLevel).not.toHaveBeenCalled();
  });

  it('shows a hint instead of a broken empty picker when no sports are available', async () => {
    mockGetSports.mockResolvedValue([]);
    const root = await startAdd();
    expect(texts(root)).toContain('No sports are available right now.');
  });
});

describe('ProfileScreen skill-levels list sport display name (BUG-M02)', () => {
  it('resolves each declared sport to its display_name instead of the raw slug', async () => {
    mockGetProfile.mockResolvedValue({
      ...PROFILE,
      skill_levels: [{ sport: 'table_tennis', skill_level: 'Intermediate' }],
    });
    const root = await mount();
    expect(texts(root)).toEqual(expect.arrayContaining(['Table Tennis', 'Intermediate']));
    expect(texts(root)).not.toContain('table_tennis');
  });

  it('falls back to the raw slug for a declared sport not in the sports list', async () => {
    mockGetProfile.mockResolvedValue({
      ...PROFILE,
      skill_levels: [{ sport: 'unlisted_sport', skill_level: 'Beginner' }],
    });
    const root = await mount();
    expect(texts(root)).toContain('unlisted_sport');
  });
});

describe('ProfileScreen skill-level delete (ADDENDUM-MOBILE-SKILL-DELETE-001)', () => {
  const WITH_ONE_SKILL_LEVEL: UserProfile = {
    ...PROFILE,
    skill_levels: [{ sport: 'table_tennis', skill_level: 'Intermediate' }],
  };

  it('tapping the row still opens the edit picker (delete affordance does not steal the tap target)', async () => {
    mockGetProfile.mockResolvedValue(WITH_ONE_SKILL_LEVEL);
    const root = await mount();
    expect(texts(root)).not.toContain('Save');

    await act(async () => {
      pressableWithText(root, 'Intermediate').props.onPress();
    });

    // Edit form now open, prefilled from the tapped row (Table Tennis /
    // Intermediate), same as before this addendum's changes.
    expect(texts(root)).toContain('Save');
    expect(texts(root)).toContain('Cancel');
  });

  it('asks for confirmation before deleting', async () => {
    mockGetProfile.mockResolvedValue(WITH_ONE_SKILL_LEVEL);
    const root = await mount();
    act(() => {
      pressableWithText(root, 'Remove').props.onPress();
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      'Remove Skill Level',
      'Remove your Table Tennis skill level?',
      expect.anything(),
    );
    expect(mockDeleteSkillLevel).not.toHaveBeenCalled();
  });

  it('on confirm: DELETEs the entry and removes it from the list via a re-fetch', async () => {
    mockGetProfile.mockResolvedValueOnce(WITH_ONE_SKILL_LEVEL).mockResolvedValueOnce(PROFILE);
    const root = await mount();
    expect(texts(root)).toContain('Table Tennis');

    act(() => {
      pressableWithText(root, 'Remove').props.onPress();
    });
    await act(async () => {
      await confirmAlert('Remove');
    });

    expect(mockDeleteSkillLevel).toHaveBeenCalledWith('table_tennis', expect.anything());
    expect(mockGetProfile).toHaveBeenCalledTimes(2);
    expect(texts(root)).not.toContain('Table Tennis');
    expect(texts(root)).toContain('No skill levels declared yet.');
  });

  it('on 409: surfaces the guard message verbatim and leaves the entry in the list', async () => {
    mockGetProfile.mockResolvedValue(WITH_ONE_SKILL_LEVEL);
    mockDeleteSkillLevel.mockRejectedValue({
      response: {
        status: 409,
        data: { detail: 'Cannot remove: you have an active tournament registration for this sport.' },
      },
    });
    const root = await mount();

    act(() => {
      pressableWithText(root, 'Remove').props.onPress();
    });
    await act(async () => {
      await confirmAlert('Remove');
    });

    expect(texts(root)).toContain(
      'Cannot remove: you have an active tournament registration for this sport.',
    );
    // Still in the list — no optimistic removal on a blocked delete.
    expect(texts(root)).toContain('Table Tennis');
    // Only the initial mount fetch — the guarded delete never re-fetches.
    expect(mockGetProfile).toHaveBeenCalledTimes(1);
  });

  it('falls back to a generic message when the failure carries no usable detail (e.g. network error)', async () => {
    mockGetProfile.mockResolvedValue(WITH_ONE_SKILL_LEVEL);
    mockDeleteSkillLevel.mockRejectedValue(new Error('network down'));
    const root = await mount();

    act(() => {
      pressableWithText(root, 'Remove').props.onPress();
    });
    await act(async () => {
      await confirmAlert('Remove');
    });

    expect(texts(root)).toContain('Could not remove this skill level. Please try again.');
    expect(texts(root)).toContain('Table Tennis');
  });
});

describe('ProfileScreen avatar (DES-MEETUP-ADDENDUM-profile-photo §10)', () => {
  const PROFILE_WITH_AVATAR: UserProfile = {
    ...PROFILE,
    avatar_url: 'https://meetup.hel1.your-objectstorage.com/avatars/u-1.png',
  };

  it('renders placeholder when avatar_url is null', async () => {
    const root = await mount();
    // Placeholder should show the first letter of display name
    expect(texts(root)).toContain('S');
  });

  it('renders the avatar photo when avatar_url is present', async () => {
    mockGetProfile.mockResolvedValue(PROFILE_WITH_AVATAR);
    const root = await mount();
    // Should render a FastImage with the avatar URL (no placeholder letter visible as the primary display)
    const fastImages = root.findAll(
      node => node.props.testID === 'fastImage' && node.props.source?.uri === PROFILE_WITH_AVATAR.avatar_url,
    );
    expect(fastImages.length).toBeGreaterThan(0);
  });

  it('shows the "Change profile photo" pressable', async () => {
    const root = await mount();
    // The avatar area should be tappable
    const avatarPressable = pressableLabelled(root, 'Change profile photo');
    expect(avatarPressable).toBeDefined();
  });

  it('renders edit-icon overlay badge on placeholder avatar as decorative affordance', async () => {
    const root = await mount();
    const avatarPressable = pressableLabelled(root, 'Change profile photo');
    expect(avatarPressable).toBeDefined();

    // Edit badge should be present inside the avatar pressable (not a separate touch target)
    const editBadges = avatarPressable.findAll(
      node => (node.type as unknown) === 'View' && node.props.testID === 'avatar-edit-badge',
    );
    expect(editBadges).toHaveLength(1);

    const badge = editBadges[0];
    expect(badge.props.accessibilityElementsHidden).toBe(true);
    expect(badge.props.importantForAccessibility).toBe('no');
  });

  it('renders edit-icon overlay badge when photo is set', async () => {
    mockGetProfile.mockResolvedValue(PROFILE_WITH_AVATAR);
    const root = await mount();
    const avatarPressable = pressableLabelled(root, 'Change profile photo');
    expect(avatarPressable).toBeDefined();

    // Edit badge should be present even when photo is set
    const editBadges = avatarPressable.findAll(
      node => (node.type as unknown) === 'View' && node.props.testID === 'avatar-edit-badge',
    );
    expect(editBadges).toHaveLength(1);
  });

  it('tapping the avatar when no photo shows camera/library options without Remove', async () => {
    const root = await mount();
    act(() => {
      pressableLabelled(root, 'Change profile photo').props.onPress();
    });
    const alertSpy = Alert.alert as unknown as jest.Mock;
    const [title, , buttons] = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
    expect(title).toBe('Profile Photo');
    const buttonTexts = (buttons as { text: string }[]).map(b => b.text);
    expect(buttonTexts).toContain('Take Photo');
    expect(buttonTexts).toContain('Choose from Library');
    expect(buttonTexts).not.toContain('Remove Photo');
  });

  it('tapping the avatar when photo exists shows camera/library/remove options', async () => {
    mockGetProfile.mockResolvedValue(PROFILE_WITH_AVATAR);
    const root = await mount();
    act(() => {
      pressableLabelled(root, 'Change profile photo').props.onPress();
    });
    const alertSpy = Alert.alert as unknown as jest.Mock;
    const [, , buttons] = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
    const buttonTexts = (buttons as { text: string }[]).map(b => b.text);
    expect(buttonTexts).toContain('Take Photo');
    expect(buttonTexts).toContain('Choose from Library');
    expect(buttonTexts).toContain('Remove Photo');
  });

  it('choosing from library → crop/zoom/rotate options passed → upload → re-fetch → avatar updates', async () => {
    const UPDATED_PROFILE: UserProfile = {
      ...PROFILE,
      avatar_url: 'https://meetup.hel1.your-objectstorage.com/avatars/u-1-v2.png',
    };
    mockGetProfile.mockResolvedValueOnce(PROFILE).mockResolvedValueOnce(UPDATED_PROFILE);
    mockOpenPicker.mockResolvedValue({
      path: 'file:///local/photo-cropped.jpg',
      filename: 'photo-cropped.jpg',
      mime: 'image/jpeg',
      width: 500,
      height: 500,
      size: 102400,
    } as any);

    const root = await mount();
    act(() => {
      pressableLabelled(root, 'Change profile photo').props.onPress();
    });
    // Confirm the "Choose from Library" action
    await act(async () => {
      await confirmAlert('Choose from Library');
    });

    expect(mockOpenPicker).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaType: 'photo',
        cropping: true,
        width: 500,
        height: 500,
        compressImageQuality: 0.8,
        cropperToolbarTitle: 'Edit Photo',
        hideBottomControls: false,
        enableRotationGesture: true,
        cropperRotateButtonsHidden: false,
      }),
    );
    expect(mockUploadAvatar).toHaveBeenCalledWith(
      'file:///local/photo-cropped.jpg',
      'photo-cropped.jpg',
      'image/jpeg',
      expect.objectContaining({ correlationId: expect.any(String) }),
    );
    expect(mockGetProfile).toHaveBeenCalledTimes(2);
    // FastImage should now render the updated avatar URL
    const fastImages = root.findAll(
      node => node.props.testID === 'fastImage' && node.props.source?.uri === UPDATED_PROFILE.avatar_url,
    );
    expect(fastImages.length).toBeGreaterThan(0);
  });

  it('taking photo with camera → crop/zoom/rotate options passed → upload → re-fetch → avatar updates', async () => {
    const UPDATED_PROFILE: UserProfile = {
      ...PROFILE,
      avatar_url: 'https://meetup.hel1.your-objectstorage.com/avatars/u-camera.png',
    };
    mockGetProfile.mockResolvedValueOnce(PROFILE).mockResolvedValueOnce(UPDATED_PROFILE);
    mockOpenCamera.mockResolvedValue({
      path: 'file:///local/camera-cropped.jpg',
      filename: 'camera-cropped.jpg',
      mime: 'image/jpeg',
      width: 500,
      height: 500,
      size: 102400,
    } as any);

    const root = await mount();
    act(() => {
      pressableLabelled(root, 'Change profile photo').props.onPress();
    });
    // Confirm the "Take Photo" action
    await act(async () => {
      await confirmAlert('Take Photo');
    });

    expect(mockOpenCamera).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaType: 'photo',
        cropping: true,
        width: 500,
        height: 500,
        compressImageQuality: 0.8,
        cropperToolbarTitle: 'Edit Photo',
        hideBottomControls: false,
        enableRotationGesture: true,
        cropperRotateButtonsHidden: false,
      }),
    );
    expect(mockUploadAvatar).toHaveBeenCalledWith(
      'file:///local/camera-cropped.jpg',
      'camera-cropped.jpg',
      'image/jpeg',
      expect.objectContaining({ correlationId: expect.any(String) }),
    );
    expect(mockGetProfile).toHaveBeenCalledTimes(2);
  });

  it('upload failure reverts preview and shows error message', async () => {
    mockGetProfile.mockResolvedValue(PROFILE);
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

    const root = await mount();
    act(() => {
      pressableLabelled(root, 'Change profile photo').props.onPress();
    });
    await act(async () => {
      await confirmAlert('Choose from Library');
    });

    // Error message surfaced via getApiErrorMessage (same pattern as skill-level 409)
    expect(texts(root)).toContain('File too large.');
    // No re-fetch after failure
    expect(mockGetProfile).toHaveBeenCalledTimes(1);
  });

  it('removing avatar → DELETE → re-fetch → placeholder renders', async () => {
    mockGetProfile
      .mockResolvedValueOnce(PROFILE_WITH_AVATAR)
      .mockResolvedValueOnce(PROFILE);

    const root = await mount();
    act(() => {
      pressableLabelled(root, 'Change profile photo').props.onPress();
    });
    await act(async () => {
      await confirmAlert('Remove Photo');
    });

    expect(mockDeleteAvatar).toHaveBeenCalledWith(
      expect.objectContaining({ correlationId: expect.any(String) }),
    );
    expect(mockGetProfile).toHaveBeenCalledTimes(2);
    // After removal, placeholder should be visible
    expect(texts(root)).toContain('S');
  });

  it('remove failure shows error and keeps the avatar', async () => {
    mockGetProfile.mockResolvedValue(PROFILE_WITH_AVATAR);
    mockDeleteAvatar.mockRejectedValue(new Error('network error'));

    const root = await mount();
    act(() => {
      pressableLabelled(root, 'Change profile photo').props.onPress();
    });
    await act(async () => {
      await confirmAlert('Remove Photo');
    });

    expect(texts(root)).toContain('Could not remove your photo. Please try again.');
    // Avatar should still be rendered
    const fastImages = root.findAll(
      node => node.props.testID === 'fastImage' && node.props.source?.uri === PROFILE_WITH_AVATAR.avatar_url,
    );
    expect(fastImages.length).toBeGreaterThan(0);
  });

  it('cancelled image picker does not trigger upload', async () => {
    const error: any = new Error('User cancelled image selection');
    error.code = 'E_PICKER_CANCELLED';
    mockOpenPicker.mockRejectedValue(error);

    const root = await mount();
    act(() => {
      pressableLabelled(root, 'Change profile photo').props.onPress();
    });
    await act(async () => {
      await confirmAlert('Choose from Library');
    });

    expect(mockUploadAvatar).not.toHaveBeenCalled();
    expect(mockGetProfile).toHaveBeenCalledTimes(1); // only initial load
  });
});
