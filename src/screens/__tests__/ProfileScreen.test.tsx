/**
 * Profile: `display_name` is the editable name used to address the user;
 * `nickname` is unique, read-only, and must never be editable or PATCHed.
 */
import React from 'react';

import { getProfile, updateProfile, updateSkillLevel } from '../../api/profile';
import { getSports } from '../../api/sports';
import { act, pressableWithText, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
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
  requestDeletion: jest.fn(),
  confirmDeletion: jest.fn(),
}));
jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));

const mockGetProfile = getProfile as jest.MockedFunction<typeof getProfile>;
const mockUpdateProfile = updateProfile as jest.MockedFunction<typeof updateProfile>;
const mockUpdateSkillLevel = updateSkillLevel as jest.MockedFunction<typeof updateSkillLevel>;
const mockGetSports = getSports as jest.MockedFunction<typeof getSports>;

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
  mockGetSports.mockReset().mockResolvedValue(SPORTS);
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
