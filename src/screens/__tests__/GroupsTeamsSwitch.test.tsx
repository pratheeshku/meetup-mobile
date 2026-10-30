/** Groups | Tournament teams (teams-payments AD-4, AD-15): the switch, the teams list from GET /teams/mine (cards open the detail), and the create entry. */
import React from 'react';

import { act, pressableLabelled, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import GroupsScreen from '../GroupsScreen';

type Props = React.ComponentProps<typeof GroupsScreen>;

const mockGetGroups = jest.fn();
const mockGetMyTeams = jest.fn();
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-1', nickname: 'sam' } }) }));
jest.mock('../../api/groups', () => ({ getGroups: (...args: unknown[]) => mockGetGroups(...args) }));
jest.mock('../../api/teams', () => ({ getMyTeams: (...args: unknown[]) => mockGetMyTeams(...args) }));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useScrollToTop: jest.fn(),
  useFocusEffect: jest.fn(),
}));
jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn().mockResolvedValue({ data: [] }) } }));

const navigate = jest.fn();
const setOptions = jest.fn();
const EMPTY = { items: [], total: 0, page: 1, page_size: 0 };
const TEAMS = [
  { id: 'tm-1', name: 'Team Smashers', sport: 'badminton', visibility: 'public', captain_user_id: 'u-1', created_at: 'x', player_count: 4, my_role: 'captain' },
  { id: 'tm-2', name: 'Net Ninjas', sport: 'badminton', visibility: 'private', captain_user_id: 'u-9', created_at: 'x', player_count: 3, my_role: 'player' },
];

const setParams = jest.fn();
const mount = (params?: { refreshKey?: number; section?: 'groups' | 'teams' }): Promise<Instance> =>
  renderAsync(<GroupsScreen {...({ navigation: { navigate, setOptions, setParams }, route: { params } } as unknown as Props)} />);

const byId = (root: Instance, id: string): Instance[] => root.findAll(n => n.props.testID === id);
const tab = (root: Instance, label: string): Instance =>
  root.findAll(n => n.props.accessibilityRole === 'tab' && n.props.accessibilityLabel === label)[0];
const lastHeaderRight = (): React.ReactElement => setOptions.mock.calls[setOptions.mock.calls.length - 1][0].headerRight();

beforeEach(() => {
  mockGetGroups.mockReset().mockResolvedValue(EMPTY);
  mockGetMyTeams.mockReset().mockResolvedValue(TEAMS);
  navigate.mockReset();
  setOptions.mockReset();
  setParams.mockReset();
});

describe('the switch', () => {
  it('shows Groups | Tournament teams, Groups selected, and does not read the teams until Tournament teams is opened', async () => {
    const root = await mount();
    expect(tab(root, 'Groups').props.accessibilityState.selected).toBe(true);
    expect(tab(root, 'Tournament teams').props.accessibilityState.selected).toBe(false);
    expect(mockGetMyTeams).not.toHaveBeenCalled();
  });

  it('tapping Tournament teams reads GET /teams/mine and lists the cards: name, sport, role, players, visibility', async () => {
    const root = await mount();
    await act(async () => {
      tab(root, 'Tournament teams').props.onPress();
    });
    expect(mockGetMyTeams).toHaveBeenCalledTimes(1);
    const all = texts(root);
    expect(all).toEqual(expect.arrayContaining(['Team Smashers', 'Net Ninjas', 'Captain', 'Team player', '4 team players', '3 team players']));
    expect(all).toEqual(expect.arrayContaining(['Open to join requests', 'Invite only']));
  });

  it('a team push (route section "teams") opens with Tournament teams selected', async () => {
    const root = await mount({ section: 'teams' });
    expect(tab(root, 'Tournament teams').props.accessibilityState.selected).toBe(true);
    expect(mockGetMyTeams).toHaveBeenCalledTimes(1);
    expect(texts(root)).toContain('Team Smashers');
    // The request is consumed, so a later tap on Groups is not undone by the same param.
    expect(setParams).toHaveBeenCalledWith({ section: undefined });
  });
});

describe('the cards open the tournament team detail (team-screens-remarks AD-1, TS-01, TS-T9)', () => {
  it('a team card is pressable with a View button and a tap opens TeamDetail with the team id', async () => {
    const root = await mount({ section: 'teams' });
    const card = root.findAll(n => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Team Smashers'))[0];
    expect(typeof card.props.onPress).toBe('function');
    expect(texts(root)).toContain('View');
    await act(async () => {
      card.props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('TeamDetail', { teamId: 'tm-1' });
  });
});

describe('create entry', () => {
  it('the header "+" creates a group on Groups and a tournament team on Tournament teams', async () => {
    const root = await mount();
    // `headerRight` is a plain function returning the "+" element (React Navigation calls it the same way).
    const groupsPlus = lastHeaderRight() as React.ReactElement<{ label: string; onPress: () => void }>;
    expect(groupsPlus.props.label).toBe('Create Group');
    groupsPlus.props.onPress();
    expect(navigate).toHaveBeenLastCalledWith('CreateGroup');
    await act(async () => {
      tab(root, 'Tournament teams').props.onPress();
    });
    const teamsPlus = lastHeaderRight() as React.ReactElement<{ label: string; onPress: () => void }>;
    expect(teamsPlus.props.label).toBe('Create a tournament team');
    teamsPlus.props.onPress();
    expect(navigate).toHaveBeenLastCalledWith('CreateGroup', { kind: 'team' });
  });

  it('an empty list says so and offers Create a tournament team', async () => {
    mockGetMyTeams.mockResolvedValue([]);
    const root = await mount({ section: 'teams' });
    expect(texts(root)).toContain("You're not on a tournament team yet.");
    await act(async () => {
      pressableLabelled(root, 'Create a tournament team').props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('CreateGroup', { kind: 'team' });
  });

  it('a failed read shows the error with a retry, not a stale list', async () => {
    mockGetMyTeams.mockRejectedValueOnce(new Error('down'));
    const root = await mount({ section: 'teams' });
    expect(texts(root)).toContain('Could not load your tournament teams. Please try again.');
    expect(byId(root, 'x')).toHaveLength(0);
  });
});
