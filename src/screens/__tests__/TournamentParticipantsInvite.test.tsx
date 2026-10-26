/**
 * Participants tab (tp-mobile-invite): INVITING is the primary action for the committee, for individual and team tournaments; Register a player
 * (committee-add) only for individual tournaments before the roster is frozen, and every refusal shows its own label.
 */
import React from 'react';
import { Alert } from 'react-native';

import TournamentDetailScreen from '../TournamentDetailScreen';
import { apiClient } from '../../api/client';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() } }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn().mockResolvedValue({ items: [] }) }));
jest.mock('../../components/UserSearchPicker', () => {
  const ReactMock = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  const AddRemoveControl = jest.requireActual('../../components/AddRemoveControl').default;
  // A stand-in list of two people that uses the real row control with the host's immediateRow wording.
  return {
    __esModule: true,
    default: ({ onSelect, immediateRow }: any) =>
      ReactMock.createElement(
        View,
        { testID: 'picker' },
        ['a', 'b'].map(id =>
          ReactMock.createElement(AddRemoveControl, {
            key: id, mode: 'immediate', name: `Person ${id}`, testID: `pick-${id}`, onSend: () => onSelect({ id }),
            ...(immediateRow ? { actionLabel: immediateRow.actionLabel(`Person ${id}`), sentLabel: immediateRow.sentLabel, errorText: immediateRow.errorText } : {}),
          }),
        ),
      ),
  };
});
jest.mock('../../api/users', () => ({ searchUsers: jest.fn().mockResolvedValue([]) }));
let mockUser = 'u-me';
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: mockUser } }) }));

const get = apiClient.get as jest.Mock;
const put = apiClient.put as jest.Mock;
const post = apiClient.post as jest.Mock;
const del = apiClient.delete as jest.Mock;
type Props = React.ComponentProps<typeof TournamentDetailScreen>;

const TABS = {
  overview: { state: 'open' },
  participants: { state: 'open' },
  fixtures: { state: 'open' },
  standings: { state: 'locked', unlocks: 'fixtures_published' },
  results: { state: 'locked', unlocks: 'tournament_closed' },
  media: { state: 'locked', unlocks: 'play_starts' },
  approvals: { state: 'open', badge: 0 },
};

// Only the organizer and active committee members get the Approvals tab (the server decides).
const WITHOUT_APPROVALS = Object.fromEntries(Object.entries(TABS).filter(([key]) => key !== 'approvals'));

const reg = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  user_id: `u-${id}`,
  team_id: null,
  registered_at: '2026-10-24T00:00:00Z',
  participant_name: name,
  status: 'registered',
  payment_received_at: null,
  effective_fee_cents: 1000,
  points: null,
  payment_exempt: false,
  team_player_count: null,
  team_captain_name: null,
  ...over,
});
const summary = (over: Record<string, unknown> = {}) => ({
  payments_enabled: true, registered: 3, paid: 1, unpaid: 2, exempt: 0, collected_cents: 1000, currency: 'SGD', fee_cents: 1000, excluded_from_fixtures: 2, points_locked: false, ...over,
});

const server: Record<string, any> = {};
const reset = (over: { phase?: string; mode?: 'individual' | 'team'; registrations?: unknown[]; summary?: unknown; applicable?: boolean; committee?: boolean } = {}): void => {
  Object.assign(server, {
    tournament: {
      id: 't-1', organizer_id: 'u-org', sport: 'badminton', title: 'City Open', name: null, description: '', format: 'knockout', capacity: 16,
      registration_closes_at: '2026-10-30T15:59:00Z', starts_at: '2026-11-14T01:00:00Z', ends_at: '2999-11-15T10:00:00Z', status: 'upcoming',
      created_at: '2026-09-01T10:00:00Z', lifecycle_version: 2, participation_mode: over.mode ?? 'individual', my_invite_access: over.committee === false ? 'none' : 'full',
      organizer: { user_id: 'u-org', display_name: 'Olivia', nickname: null, avatar_url: null }, committee: [], has_custom_banner: true,
      registration_fee_cents: 1000, registration_fee_currency: 'SGD',
    },
    state: {
      enabled: true, applicable: over.applicable ?? true, is_committee: over.committee ?? true, registration_phase: over.phase ?? 'open', fixtures_published: false,
      live_poll_seconds: 10, tabs: over.committee === false ? WITHOUT_APPROVALS : TABS, committee: over.committee === false ? null : { points: null, latest_draft: null, group_options: null },
    },
    registrations: over.registrations ?? [reg('a', 'Mei Lin', { payment_received_at: '2026-10-25T00:00:00Z', points: '1450.000000' }), reg('b', 'Dev P', { points: '1100' }), reg('c', 'Coach Tan')],
    summary: over.summary ?? summary(),
  });
};

async function mount(): Promise<Instance> {
  get.mockReset().mockImplementation((url: string) => {
    if (url === '/tournaments/t-1') return Promise.resolve({ data: server.tournament });
    if (url === '/tournaments/t-1/scoring/state') return Promise.resolve({ data: server.state });
    if (url === '/tournaments/t-1/registrations') return Promise.resolve({ data: server.registrations });
    if (url === '/tournaments/t-1/registrations/summary') {
      return server.summary instanceof Error ? Promise.reject(server.summary) : Promise.resolve({ data: server.summary });
    }
    if (url === '/tournaments/t-1/standings') return Promise.resolve({ data: { published: false, groups: [], knockout: [] } });
    if (url === '/tournaments/t-1/committee/actions') return Promise.resolve({ data: [] });
    if (url === '/tournaments/t-1/committee/members') return Promise.resolve({ data: [] });
    if (url === '/tournaments/t-1/closure') return Promise.resolve({ data: { can_close: false, version: 0 } });
    if (url.endsWith('/roster')) return Promise.resolve({ data: server.roster });
    return Promise.resolve({ data: [] });
  });
  put.mockReset().mockResolvedValue({ data: {} });
  del.mockReset().mockResolvedValue({ data: { status: 'withdrawn', was_paid: false } });
  const props = { route: { key: 'k', name: 'TournamentDetail', params: { tournamentId: 't-1' } }, navigation: { navigate: jest.fn() } } as unknown as Props;
  const root = await renderAsync(<TournamentDetailScreen {...props} />);
  await act(async () => {
    root.findAll(n => n.props.testID === 'tournament-tab-participants' && typeof n.props.onPress === 'function')[0].props.onPress();
  });
  return root;
}

const byId = (root: Instance, id: string): Instance[] => root.findAll(n => n.props.testID === id);
const hostById = (root: Instance, id: string): Instance[] => root.findAll(n => n.props.testID === id && typeof n.type === 'string');
const node = (root: Instance, id: string): Instance => {
  const found = root.findAll(n => n.props.testID === id && (typeof n.props.onPress === 'function' || typeof n.props.onValueChange === 'function'))[0];
  if (!found) throw new Error(`nothing to press: ${id}`);
  return found;
};
const press = async (root: Instance, id: string): Promise<void> => {
  await act(async () => {
    await node(root, id).props.onPress();
  });
};
const input = (root: Instance, id: string): Instance => {
  const found = root.findAll(n => n.props.testID === id && typeof n.props.onEndEditing === 'function')[0];
  if (!found) throw new Error(`no points box: ${id}`);
  return found;
};
const flip = async (root: Instance, id: string, value: boolean): Promise<void> => {
  await act(async () => {
    await node(root, id).props.onValueChange(value);
  });
};
const all = (root: Instance): string => texts(root).join(' | ');
const of = (root: Instance, id: string): string => texts(hostById(root, id)[0]).join(' ');

beforeEach(() => {
  mockUser = 'u-me';
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  reset();
});
afterEach(() => jest.restoreAllMocks());


const lbl = (root: Instance, label: string): Instance[] => root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function');

describe('what the organizer sees', () => {
  it.each(['individual', 'team'] as const)('%s tournament: an Invite people section with Invite players and Invite Group', async mode => {
    reset({ mode, registrations: [] });
    const root = await mount();
    expect(hostById(root, 'participants-invite')).toHaveLength(1);
    expect(all(hostById(root, 'participants-invite')[0])).toContain('Invite people');
    expect(all(hostById(root, 'participants-invite')[0])).toContain('Invited people can register themselves.');
    expect(lbl(root, 'Invite players').length + lbl(root, 'Invite Players').length).toBeGreaterThan(0);
  });

  it('individual: Register a player (not "Add player", not an invitation) while the roster is not frozen', async () => {
    reset({ registrations: [] });
    const root = await mount();
    expect(node(root, 'participants-add').props.label).toBe('Register a player');
    expect(all(root)).not.toContain('Add player');
  });

  it('team tournament: no Register a player', async () => {
    reset({ mode: 'team', registrations: [] });
    expect(byId(await mount(), 'participants-add')).toHaveLength(0);
  });

  it('frozen roster: no Register a player, invitations stay (the server answers INVITES_CLOSED)', async () => {
    reset({ phase: 'frozen', registrations: [] });
    const root = await mount();
    expect(byId(root, 'participants-add')).toHaveLength(0);
    expect(hostById(root, 'participants-invite')).toHaveLength(1);
  });

  it('another viewer sees neither', async () => {
    mockUser = 'u-other';
    reset({ committee: false, registrations: [] });
    const root = await mount();
    expect(hostById(root, 'participants-invite')).toHaveLength(0);
    expect(byId(root, 'participants-add')).toHaveLength(0);
  });
});

describe('Register a player: each refusal shows its own label on that row only', () => {
  const open = async (): Promise<Instance> => {
    reset({ registrations: [] });
    const root = await mount();
    await press(root, 'participants-add');
    return root;
  };
  const tap = async (root: Instance, id: string): Promise<void> => {
    await act(async () => {
      await node(root, id).props.onPress();
    });
  };

  it('the sheet is titled "Register a player" and says it registers now', async () => {
    const root = await open();
    expect(all(hostById(root, 'participants-add-sheet')[0])).toContain('Register a player');
    expect(all(hostById(root, 'participants-add-sheet')[0])).toContain('Registers the player in this tournament now.');
    expect(lbl(root, 'Register Person a')).toHaveLength(1);
  });

  it.each([
    ['COMMITTEE_ADD_CLOSED', 409, 'The committee can no longer add players: registration is frozen.'],
    ['INDIVIDUAL_ONLY', 409, 'The committee adds individual players only. A tournament team registers itself.'],
    ['ALREADY_REGISTERED', 409, 'You are already registered.'],
    ['LIFECYCLE_V2_ONLY', 409, 'This action is not available for this tournament.'],
    ['COMMITTEE_ONLY', 403, 'Only a committee member can do this.'],
  ])('%s', async (code, status, label) => {
    const root = await open();
    post.mockRejectedValueOnce({ response: { status, data: { detail: 'RAW', code } } });
    await tap(root, 'pick-a');
    const errors = root.findAll(n => n.props.testID === 'add-remove-error' && typeof n.type === 'string');
    expect(errors.map(e => texts(e).join(''))).toEqual([label]);
    expect(all(root)).not.toContain('RAW');
    expect(texts(root).join(' ')).not.toContain('Could not send the invitation');
  });

  it('403/404/429 by status; the generic text only for a 500', async () => {
    const root = await open();
    post.mockRejectedValueOnce({ response: { status: 403, data: { detail: 'x' } } });
    await tap(root, 'pick-a');
    post.mockRejectedValueOnce({ response: { status: 500, data: {} } });
    await tap(root, 'pick-b');
    expect(root.findAll(n => n.props.testID === 'add-remove-error' && typeof n.type === 'string').map(e => texts(e).join(''))).toEqual(['You cannot do this.', 'Could not send the invitation. Try again.']);
  });

  it('success shows "Registered"', async () => {
    const root = await open();
    await tap(root, 'pick-a');
    expect(texts(hostById(root, 'pick-a-status')[0])).toEqual(['Registered']);
  });
});
