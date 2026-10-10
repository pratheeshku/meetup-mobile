/**
 * Edit skill levels reads active sports from the API, in that order, and
 * saves only sports that have a level.
 */
import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { deleteSkillLevel, getSkillLevels, updateSkillLevel } from '../../api/profile';
import { getSports } from '../../api/sports';
import { act, pressableLabelled, renderAsync, texts } from '../../test-utils/render';
import type { ProfileStackParamList } from '../../navigation/types';
import EditSkillLevelsScreen from '../EditSkillLevelsScreen';

jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../api/profile', () => ({
  getSkillLevels: jest.fn(),
  updateSkillLevel: jest.fn(),
  deleteSkillLevel: jest.fn(),
}));

const mockGetSports = getSports as jest.MockedFunction<typeof getSports>;
const mockGetSkills = getSkillLevels as jest.MockedFunction<typeof getSkillLevels>;
const mockUpdate = updateSkillLevel as jest.MockedFunction<typeof updateSkillLevel>;
const mockDelete = deleteSkillLevel as jest.MockedFunction<typeof deleteSkillLevel>;

const SPORTS = [
  { name: 'badminton', display_name: 'Badminton', slug: 'badminton', icon_key: 'badminton', color: '#2A7B72' },
  { name: 'tennis', display_name: 'Tennis', slug: 'tennis', icon_key: 'tennis', color: '#A54362' },
  { name: 'football', display_name: 'Football', slug: 'football', icon_key: 'football', color: '#835C2B' },
  { name: 'basketball', display_name: 'Basketball', slug: 'basketball', icon_key: null, color: null },
];

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditSkillLevels'>;

async function mount() {
  const navigation = { goBack: jest.fn(), navigate: jest.fn() } as unknown as Props['navigation'];
  const route = { key: 'EditSkillLevels', name: 'EditSkillLevels' } as Props['route'];
  return renderAsync(<EditSkillLevelsScreen navigation={navigation} route={route} />);
}

beforeEach(() => {
  mockGetSports.mockReset().mockResolvedValue(SPORTS);
  mockGetSkills.mockReset().mockResolvedValue([{ sport: 'tennis', skill_level: 'intermediate' }]);
  mockUpdate.mockReset().mockResolvedValue(undefined);
  mockDelete.mockReset().mockResolvedValue(undefined);
});

it('lists every active sport from the API, in that order, with full level names', async () => {
  const root = await mount();
  const rendered = texts(root);
  expect(rendered).not.toContain('Pickleball');
  expect(rendered).not.toContain('Inter.');
  expect(rendered).not.toContain('Adv.');
  const names = ['Badminton', 'Tennis', 'Football', 'Basketball'];
  const positions = names.map(name => rendered.indexOf(name));
  expect(positions.every(index => index >= 0)).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  expect(rendered.filter(text => text === 'Beginner').length).toBeGreaterThan(0);
  expect(rendered.filter(text => text === 'Intermediate').length).toBeGreaterThan(0);
  expect(rendered.filter(text => text === 'Expert').length).toBeGreaterThan(0);
  expect(rendered).toContain('Not set');
  expect(rendered).toContain('Clear');
});

it('saves only sports with a level and deletes a cleared one', async () => {
  const root = await mount();
  await act(async () => {
    root
      .findAll(
        node =>
          node.props.accessibilityRole === 'radio' &&
          node.props.accessibilityLabel === 'Badminton, Beginner',
      )[0]
      .props.onPress();
  });
  await act(async () => {
    pressableLabelled(root, 'Tennis Clear').props.onPress();
  });
  await act(async () => {
    pressableLabelled(root, 'Done').props.onPress();
  });

  expect(mockUpdate).toHaveBeenCalledTimes(1);
  expect(mockUpdate).toHaveBeenCalledWith('badminton', 'beginner');
  expect(mockDelete).toHaveBeenCalledTimes(1);
  expect(mockDelete).toHaveBeenCalledWith('tennis');
  expect(mockUpdate).not.toHaveBeenCalledWith('football', expect.anything());
  expect(mockUpdate).not.toHaveBeenCalledWith('basketball', expect.anything());
});
