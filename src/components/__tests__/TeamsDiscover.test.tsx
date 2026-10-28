/** Groups > Tournament teams > Discover (team-screens-remarks AD-2, A1; TS-T10). */
import React from 'react';

import { act, pressableLabelled, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import TeamsSection from '../TeamsSection';

const mockGetTeams = jest.fn();
const mockGetMyTeams = jest.fn();
jest.mock('../../api/teams', () => ({
  getTeams: (...a: unknown[]) => mockGetTeams(...a),
  getMyTeams: (...a: unknown[]) => mockGetMyTeams(...a),
}));
jest.mock('../../sports/catalog', () => ({
  ...jest.requireActual('../../sports/catalog'),
  loadSportsCatalog: () =>
    Promise.resolve([
      { name: 'badminton', display_name: 'Badminton', slug: 'badminton' },
      { name: 'tennis', display_name: 'Tennis', slug: 'tennis' },
    ]),
  useSportRecord: () => undefined,
}));

const team = (id: string, name: string, sport: string, visibility = 'public') => ({
  id, name, sport, visibility, captain_user_id: 'c', created_at: 'x', player_count: null, my_role: null,
});
const MINE = [{ ...team('tm-1', 'Mine Smashers', 'badminton'), player_count: 4, my_role: 'captain' }];
const VISIBLE = [
  team('tm-1', 'Mine Smashers', 'badminton'),
  team('tm-2', 'Net Ninjas', 'badminton'),
  team('tm-3', 'Court Kings', 'tennis'),
  team('tm-4', 'Closed Circle', 'badminton', 'private'),
];

const onOpenTeam = jest.fn();
const mount = (): Promise<Instance> => renderAsync(<TeamsSection onCreateTeam={jest.fn()} onOpenTeam={onOpenTeam} reloadKey={0} />);
const tab = (root: Instance, label: string): Instance =>
  root.findAll(n => n.props.accessibilityRole === 'tab' && n.props.accessibilityLabel === label)[0];
const openDiscover = async (root: Instance): Promise<void> => {
  await act(async () => {
    tab(root, 'Discover').props.onPress();
  });
};

beforeEach(() => {
  mockGetTeams.mockReset().mockResolvedValue(VISIBLE);
  mockGetMyTeams.mockReset().mockResolvedValue(MINE);
  onOpenTeam.mockReset();
});

describe('Mine | Discover', () => {
  it('shows the switch with Mine selected and reads Discover only when it is opened', async () => {
    const root = await mount();
    expect(tab(root, 'Mine').props.accessibilityState.selected).toBe(true);
    expect(mockGetTeams).not.toHaveBeenCalled();
    await openDiscover(root);
    expect(tab(root, 'Discover').props.accessibilityState.selected).toBe(true);
    expect(mockGetTeams).toHaveBeenCalledTimes(1);
  });

  it('removes the teams already in Mine, keeps public teams and a private team the caller is invited to (marked Invite only)', async () => {
    const root = await mount();
    await openDiscover(root);
    const all = texts(root);
    expect(all).toEqual(expect.arrayContaining(['Net Ninjas', 'Court Kings', 'Closed Circle']));
    expect(all.filter(text => text === 'Mine Smashers')).toHaveLength(1); // the Mine list only
    expect(all).toContain('Invite only');
    expect(all).toContain('Open to join requests');
    // No player count on a Discover card: null hides the line.
    expect(all.some(text => /team players$/.test(text) && text !== 'Team players')).toBe(true); // Mine's "4 team players" only
    expect(all.filter(text => /^\d+ team players$/.test(text))).toEqual(['4 team players']);
  });

  it('a Discover card opens the team detail', async () => {
    const root = await mount();
    await openDiscover(root);
    const card = root.findAll(n => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Net Ninjas'))[0];
    await act(async () => {
      card.props.onPress();
    });
    expect(onOpenTeam).toHaveBeenCalledWith('tm-2');
  });

  it('filters by name (client-side) and by sport', async () => {
    const root = await mount();
    await openDiscover(root);
    const search = root.findAll(n => n.props.testID === 'discover-search')[0];
    await act(async () => {
      search.props.onChangeText('ninja');
    });
    let all = texts(root);
    expect(all).toContain('Net Ninjas');
    expect(all).not.toContain('Court Kings');
    await act(async () => {
      search.props.onChangeText('');
    });
    await act(async () => {
      pressableLabelled(root, 'Tennis').props.onPress();
    });
    all = texts(root);
    expect(all).toContain('Court Kings');
    expect(all).not.toContain('Net Ninjas');
    expect(mockGetTeams).toHaveBeenCalledTimes(1); // no new request for a filter
  });

  it('says so when there is nothing to discover', async () => {
    mockGetTeams.mockResolvedValue([VISIBLE[0]]);
    const root = await mount();
    await openDiscover(root);
    expect(texts(root)).toContain('There are no public tournament teams to join yet.');
  });

  it('a failed Discover read shows a retry state and leaves Mine usable', async () => {
    mockGetTeams.mockRejectedValueOnce(new Error('down'));
    const root = await mount();
    await openDiscover(root);
    expect(texts(root)).toContain('Could not load your tournament teams. Please try again.');
    await act(async () => {
      tab(root, 'Mine').props.onPress();
    });
    expect(texts(root)).toContain('Mine Smashers');
  });
});
