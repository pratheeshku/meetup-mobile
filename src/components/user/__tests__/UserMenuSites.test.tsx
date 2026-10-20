/**
 * Migrated call sites (design UM-06, UM-12): home-card avatars are tap only, search rows give the
 * avatar a long-press only, tournament registrations show an avatar (placeholder without a user)
 * and open View Details from the row with no card request.
 */
import React from 'react';
import { Text, View } from 'react-native';

import { getGroupMemberCard } from '../../../api/groups';
import { searchUsers } from '../../../api/users';
import { closeUserMenu } from '../../../hooks/useUserMenu';
import { act, renderAsync, texts } from '../../../test-utils/render';
import type { Instance } from '../../../test-utils/render';
import { mockGet, rawTournament } from '../../../test-utils/tournamentDetailHarness';
import TournamentDetailScreen from '../../../screens/TournamentDetailScreen';
import { UnifiedCard } from '../../home/UnifiedCard';
import UserSearchPicker from '../../UserSearchPicker';
import UserMenuHost from '../UserMenuHost';

jest.mock('../../../api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../../../api/groups', () => ({ getGroupMemberCard: jest.fn(), getMyGroups: jest.fn() }));
jest.mock('../../../api/users', () => ({ searchUsers: jest.fn() }));
jest.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-me' } }) }));

const detailsOpen = (root: Instance): boolean =>
  root.findAll(n => n.props?.testID === 'user-details' && typeof n.type === 'string').length > 0;
const withHandlers = (root: Instance, label: string): Instance[] =>
  root.findAll(
    n =>
      n.props?.accessibilityLabel === label &&
      (typeof n.props.onPress === 'function' || typeof n.props.onLongPress === 'function'),
  );

beforeEach(() => {
  act(() => closeUserMenu());
  (getGroupMemberCard as jest.Mock).mockReset();
  (searchUsers as jest.Mock).mockReset().mockResolvedValue([]);
});

describe('home card avatars (22 px)', () => {
  const mountCard = (onPress: jest.Mock): Promise<Instance> =>
    renderAsync(
      <View>
        <UnifiedCard
          leftTile={<Text>tile</Text>}
          title="Sunday Doubles"
          details={<Text>d</Text>}
          avatars={[{ user_id: 'u-9', display_name: 'Mei Lin', photo_url: null }]}
          moreCount={0}
          countLabel="1/4"
          actionButtonLabel="Join"
          onPress={onPress}
          accessibilityLabel="card"
        />
        <UserMenuHost />
      </View>,
    );

  it('a tap on an avatar opens View Details, not the card, and makes no card request', async () => {
    const onPress = jest.fn();
    const root = await mountCard(onPress);
    const avatar = withHandlers(root, 'Mei Lin')[0];
    expect(avatar.props.onLongPress).toBeUndefined();
    await act(async () => avatar.props.onPress());
    expect(detailsOpen(root)).toBe(true);
    expect(texts(root)).toContain('Mei Lin');
    expect(onPress).not.toHaveBeenCalled();
    expect(getGroupMemberCard).not.toHaveBeenCalled();
  });

  it('the rest of the card keeps its behaviour', async () => {
    const onPress = jest.fn();
    const root = await mountCard(onPress);
    const card = withHandlers(root, 'card')[0];
    await act(async () => card.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('search rows (selectable)', () => {
  it('the avatar only long-presses (no tap); no card request, View Details only', async () => {
    (searchUsers as jest.Mock).mockResolvedValue([{ id: 'u-3', display_name: 'Dev P', nickname: 'dev', pending: false }]);
    const root = await renderAsync(
      <View>
        <UserSearchPicker onSelect={jest.fn()} />
        <UserMenuHost />
      </View>,
    );
    await act(async () => {});
    const avatar = withHandlers(root, 'Dev P')[0];
    expect(avatar.props.onPress).toBeUndefined();
    await act(async () => avatar.props.onLongPress());
    expect(getGroupMemberCard).not.toHaveBeenCalled();
    expect(
      root.findAll(n => n.props?.accessibilityLabel === 'View Details' && typeof n.type === 'string').length,
    ).toBeGreaterThan(0);
  });
});

describe('tournament registrations', () => {
  const REGISTRATIONS = [
    { id: 'r-1', user_id: 'u-5', participant_name: 'Dev', registered_at: '2026-09-02T10:00:00Z', status: 'registered' },
    { id: 'r-2', user_id: null, participant_name: 'Coach Tan', registered_at: '2026-09-03T10:00:00Z', status: 'registered' },
  ];

  async function mountRegistrations(): Promise<Instance> {
    const root = await renderAsync(
      <View>
        <TournamentDetailScreen
          {...({
            route: { key: 'k', name: 'TournamentDetail', params: { tournamentId: 't-1' } },
            navigation: {},
          } as unknown as React.ComponentProps<typeof TournamentDetailScreen>)}
        />
        <UserMenuHost />
      </View>,
    );
    await act(async () => root.find(n => n.props?.accessibilityRole === 'tab' && texts(n).includes('Registrations')).props.onPress());
    return root;
  }

  beforeEach(() => {
    mockGet.mockReset().mockImplementation((url: string) => {
      if (url === '/tournaments/t-1') return Promise.resolve({ data: rawTournament() });
      if (url === '/tournaments/t-1/registrations') return Promise.resolve({ data: REGISTRATIONS });
      if (url === '/config/client') return Promise.resolve({ data: {} });
      return Promise.resolve({ data: [] });
    });
  });

  it('a registration with a user: avatar and nickname; a tap opens View Details, no card request', async () => {
    const root = await mountRegistrations();
    const dev = withHandlers(root, 'Dev')[0];
    expect(dev).toBeDefined();
    await act(async () => dev.props.onPress());
    expect(detailsOpen(root)).toBe(true);
    expect(getGroupMemberCard).not.toHaveBeenCalled();
  });

  it('a registration with no user shows the placeholder picture and opens View Details from the row', async () => {
    const root = await mountRegistrations();
    const coach = withHandlers(root, 'Coach Tan')[0];
    expect(coach.findAll(n => n.props?.testID === 'user-avatar-placeholder').length).toBeGreaterThan(0);
    await act(async () => coach.props.onPress());
    expect(detailsOpen(root)).toBe(true);
    expect(texts(root)).toContain('Coach Tan');
    expect(getGroupMemberCard).not.toHaveBeenCalled();
  });
});
