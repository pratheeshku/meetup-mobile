/**
 * Participants on the version 2 tournament page for the organizer and committee (teams-payments AD-9 to AD-13; boards P1-P5): the summary tiles
 * and Cash collected from the server, the unpaid count first, filters, the Paid switch (idempotent PUT, undoable), points per entrant, team rows
 * by team name, the details pop-ups with the organizer section, and Remove behind "Are you sure?". The real screen, tab and API layer run; only the
 * HTTP client is mocked.
 */
import React from 'react';
import { Alert } from 'react-native';

import TournamentDetailScreen from '../TournamentDetailScreen';
import { apiClient } from '../../api/client';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() } }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn().mockResolvedValue({ items: [] }) }));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn().mockResolvedValue([]) }));
let mockUser = 'u-me';
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: mockUser } }) }));

const get = apiClient.get as jest.Mock;
const put = apiClient.put as jest.Mock;
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
const reset = (over: { mode?: 'individual' | 'team'; registrations?: unknown[]; summary?: unknown; applicable?: boolean; committee?: boolean } = {}): void => {
  Object.assign(server, {
    tournament: {
      id: 't-1', organizer_id: 'u-org', sport: 'badminton', title: 'City Open', name: null, description: '', format: 'knockout', capacity: 16,
      registration_closes_at: '2026-10-30T15:59:00Z', starts_at: '2026-11-14T01:00:00Z', ends_at: '2999-11-15T10:00:00Z', status: 'upcoming',
      created_at: '2026-09-01T10:00:00Z', lifecycle_version: 2, participation_mode: over.mode ?? 'individual', my_invite_access: over.committee === false ? 'none' : 'full',
      organizer: { user_id: 'u-org', display_name: 'Olivia', nickname: null, avatar_url: null }, committee: [], has_custom_banner: true,
      registration_fee_cents: 1000, registration_fee_currency: 'SGD',
    },
    state: {
      enabled: true, applicable: over.applicable ?? true, is_committee: over.committee ?? true, registration_phase: 'open', fixtures_published: false,
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

describe('the summary (P1)', () => {
  it('reads the summary from the server and shows the tiles, Cash collected and the unpaid count first', async () => {
    const root = await mount();
    expect(of(root, 'tile-registered')).toContain('3');
    expect(of(root, 'tile-paid')).toContain('1');
    expect(of(root, 'tile-unpaid')).toContain('2');
    expect(of(root, 'cash-collected')).toMatch(/10\.00/);
    expect(all(hostById(root, 'participants-summary')[0])).toMatch(/1 paid × .*10\.00/);
    expect(of(root, 'participants-warning')).toContain('2 unpaid players will be left out of fixtures. Mark them Paid to include them.');
    // The unpaid count comes before the filters and the list.
    const order = root.findAll(n => ['participants-warning', 'participants-filters', 'participant-a'].includes(String(n.props.testID)) && typeof n.type === 'string').map(n => n.props.testID);
    expect(order).toEqual(['participants-warning', 'participants-filters', 'participant-a']);
    expect(of(root, 'participants-subtitle')).toContain('City Open · Individual · ');
  });

  it('rows: the registered date, an unpaid row says it is left out, the organizer row has a chip and no switch', async () => {
    reset({ registrations: [reg('a', 'Mei Lin', { payment_received_at: '2026-10-25T00:00:00Z' }), reg('c', 'Coach Tan'), reg('o', 'Olivia', { user_id: 'u-org', payment_exempt: true })] });
    const root = await mount();
    expect(all(hostById(root, 'participant-a')[0])).toContain('Registered');
    expect(all(hostById(root, 'participant-c')[0])).toContain('Unpaid · left out of fixtures');
    expect(all(hostById(root, 'participant-o')[0])).toContain('Organizer');
    expect(byId(root, 'participant-paid-o').filter(n => typeof n.props.onValueChange === 'function')).toHaveLength(0);
    expect(byId(root, 'participant-paid-a').filter(n => typeof n.props.onValueChange === 'function')).not.toHaveLength(0);
  });

  it('filters All, Paid and Unpaid by the server\'s payment state', async () => {
    const root = await mount();
    await press(root, 'participants-filter-paid');
    expect(hostById(root, 'participant-a')).toHaveLength(1);
    expect(hostById(root, 'participant-b')).toHaveLength(0);
    await press(root, 'participants-filter-unpaid');
    expect(hostById(root, 'participant-a')).toHaveLength(0);
    expect(hostById(root, 'participant-b')).toHaveLength(1);
  });

  it('a failed summary read leaves the list without tiles, filters or Paid switches', async () => {
    reset({ summary: new Error('down') });
    const root = await mount();
    expect(hostById(root, 'participants-summary')).toHaveLength(0);
    expect(hostById(root, 'participants-filters')).toHaveLength(0);
    expect(byId(root, 'participant-paid-a').filter(n => typeof n.props.onValueChange === 'function')).toHaveLength(0);
    expect(hostById(root, 'participant-a')).toHaveLength(1);
    expect(of(root, 'participants-summary-failed')).toContain('payment totals could not be loaded');
  });

  it('a free tournament hides payment tiles, Cash collected, the Paid column, filters and the warning; points stay', async () => {
    reset({ summary: summary({ payments_enabled: false, fee_cents: null, paid: 0, unpaid: 0, excluded_from_fixtures: 0 }) });
    const root = await mount();
    expect(hostById(root, 'participants-summary')).toHaveLength(0);
    expect(hostById(root, 'participants-warning')).toHaveLength(0);
    expect(hostById(root, 'participants-filters')).toHaveLength(0);
    expect(byId(root, 'participant-paid-a').filter(n => typeof n.props.onValueChange === 'function')).toHaveLength(0);
    expect(byId(root, 'participant-points-a').filter(n => typeof n.props.onEndEditing === 'function')).not.toHaveLength(0);
  });
});

describe('the Paid switch (idempotent set, undoable)', () => {
  it('Paid sends { received: true } and the tiles and Cash collected move from the answer', async () => {
    const root = await mount();
    put.mockResolvedValueOnce({
      data: { registration_id: 'b', payment_received_at: '2026-10-26T00:00:00Z', effective_fee_cents: 1000, draft_exists: false, summary: summary({ paid: 2, unpaid: 1, collected_cents: 2000, excluded_from_fixtures: 1 }) },
    });
    await flip(root, 'participant-paid-b', true);
    expect(put).toHaveBeenCalledWith('/tournaments/t-1/registrations/b/payment', { received: true }, expect.objectContaining({ correlationId: expect.any(String) }));
    expect(of(root, 'tile-paid')).toContain('2');
    expect(of(root, 'tile-unpaid')).toContain('1');
    expect(of(root, 'cash-collected')).toMatch(/20\.00/);
    expect(of(root, 'participants-warning')).toContain('1 unpaid player will be left out');
    expect(node(root, 'participant-paid-b').props.value).toBe(true);
  });

  it('undo sends { received: false }', async () => {
    const root = await mount();
    put.mockResolvedValueOnce({ data: { registration_id: 'a', payment_received_at: null, effective_fee_cents: 1000, draft_exists: false, summary: summary({ paid: 0, unpaid: 3, collected_cents: 0, excluded_from_fixtures: 3 }) } });
    await flip(root, 'participant-paid-a', false);
    expect(put.mock.calls[0][1]).toEqual({ received: false });
    expect(of(root, 'cash-collected')).toMatch(/0\.00/);
    expect(node(root, 'participant-paid-a').props.value).toBe(false);
  });

  it('after a draft exists the late payer notice shows', async () => {
    const root = await mount();
    put.mockResolvedValueOnce({ data: { registration_id: 'b', payment_received_at: '2026-10-26T00:00:00Z', effective_fee_cents: 1000, draft_exists: true, summary: summary() } });
    await flip(root, 'participant-paid-b', true);
    expect(of(root, 'participants-notice')).toBe('Fixtures are already generated. A late payer joins unrated.');
  });

  it('a refusal keeps the switch where it was and shows its own label, never the server text', async () => {
    const root = await mount();
    put.mockRejectedValueOnce({ response: { status: 409, data: { detail: 'RAW SERVER TEXT', code: 'NO_FEE' } } });
    await flip(root, 'participant-paid-b', true);
    expect(node(root, 'participant-paid-b').props.value).toBe(false);
    expect(of(root, 'participant-error-b')).toBe('There is no fee to confirm for this entry.');
    expect(all(root)).not.toContain('RAW SERVER TEXT');
    expect(of(root, 'tile-paid')).toContain('1');
  });
});

describe('points per entrant (AD-13)', () => {
  const edit = async (root: Instance, id: string, text: string): Promise<void> => {
    await act(async () => {
      input(root, id).props.onChangeText(text);
    });
    await act(async () => {
      await input(root, id).props.onEndEditing();
    });
  };

  it('shows the server\'s points without trailing zeros and sends { points } on commit', async () => {
    const root = await mount();
    expect(input(root, 'participant-points-a').props.value).toBe('1450');
    await edit(root, 'participant-points-b', '1300.5');
    expect(put).toHaveBeenCalledWith('/tournaments/t-1/registrations/b/points', { points: 1300.5 }, expect.objectContaining({ correlationId: expect.any(String) }));
    expect(input(root, 'participant-points-b').props.value).toBe('1300.5');
  });

  it('an empty box sends null (unrated); nothing is sent when the value did not change', async () => {
    const root = await mount();
    await edit(root, 'participant-points-b', '');
    expect(put.mock.calls[0][1]).toEqual({ points: null });
    put.mockClear();
    await edit(root, 'participant-points-a', '1450');
    expect(put).not.toHaveBeenCalled();
  });

  it('a refusal shows its label beside the row and the box reads the server value again', async () => {
    const root = await mount();
    put.mockRejectedValueOnce({ response: { status: 409, data: { detail: 'locked', code: 'POINTS_LOCKED' } } });
    await edit(root, 'participant-points-b', '900');
    expect(of(root, 'participant-error-b')).toBe('Points are locked because the fixtures are already generated.');
    expect(input(root, 'participant-points-b').props.value).toBe('1100');
  });

  it('an invalid value is not sent', async () => {
    const root = await mount();
    await edit(root, 'participant-points-b', '1.1234567');
    expect(put).not.toHaveBeenCalled();
  });

  it('is read-only once the server says the points are locked, and hidden where the engine does not apply', async () => {
    reset({ summary: summary({ points_locked: true }) });
    const locked = await mount();
    expect(byId(locked, 'participant-points-a').filter(n => n.props.editable === false)).not.toHaveLength(0);
    reset({ applicable: false });
    const none = await mount();
    expect(byId(none, 'participant-points-a')).toHaveLength(0);
  });
});

describe('details pop-up with the organizer section (P3)', () => {
  it('opens the user details pop-up with fee, Payment received, Points and Remove; the switch there sets payment too', async () => {
    const root = await mount();
    await press(root, 'participant-open-b');
    expect(hostById(root, 'user-menu-sheet')).toHaveLength(1);
    const section = hostById(root, 'organizer-section')[0];
    expect(all(section)).toContain('Registration fee');
    expect(all(section)).toMatch(/10\.00 per player/);
    expect(all(section)).toContain('Payment received');
    expect(all(section)).toContain('Remove from tournament');
    put.mockResolvedValueOnce({ data: { registration_id: 'b', payment_received_at: '2026-10-26T00:00:00Z', effective_fee_cents: 1000, draft_exists: false, summary: summary({ paid: 2, unpaid: 1, collected_cents: 2000, excluded_from_fixtures: 1 }) } });
    await flip(root, 'details-paid', true);
    expect(put.mock.calls[0][0]).toBe('/tournaments/t-1/registrations/b/payment');
    expect(of(root, 'cash-collected')).toMatch(/20\.00/);
  });

  it('another viewer sees only the identity, no organizer section', async () => {
    mockUser = 'u-other';
    reset({ committee: false });
    const root = await mount();
    await press(root, 'participant-open-b');
    expect(hostById(root, 'user-menu-sheet')).toHaveLength(1);
    expect(hostById(root, 'organizer-section')).toHaveLength(0);
  });
});

describe('remove (P5, AD-12)', () => {
  it('"…" offers Remove, which asks "Are you sure?" with the approved text; Yes deletes and the page refreshes', async () => {
    const root = await mount();
    await press(root, 'participant-remove-b');
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find(b => b.text === 'Remove from tournament')!.onPress!());
    expect(of(root, 'remove-confirm-body')).toBe('Remove Dev P from City Open? Their registration, payment status and points are cleared, and the player is told.');
    expect(hostById(root, 'remove-confirm-paid')).toHaveLength(0);
    expect(del).not.toHaveBeenCalled();
    const before = get.mock.calls.filter(c => c[0] === '/tournaments/t-1/registrations').length;
    await press(root, 'remove-yes');
    expect(del).toHaveBeenCalledWith('/tournaments/t-1/registrations/b', expect.objectContaining({ correlationId: expect.any(String) }));
    expect(get.mock.calls.filter(c => c[0] === '/tournaments/t-1/registrations').length).toBeGreaterThan(before);
  });

  it('a paid entrant adds the refund line', async () => {
    const root = await mount();
    await press(root, 'participant-open-a');
    await press(root, 'details-remove');
    expect(of(root, 'remove-confirm-paid')).toBe('Payment was marked received. Refunds are arranged outside the app.');
  });

  it('Cancel deletes nothing', async () => {
    const root = await mount();
    await press(root, 'participant-open-b');
    await press(root, 'details-remove');
    await press(root, 'remove-cancel');
    expect(del).not.toHaveBeenCalled();
    expect(hostById(root, 'remove-confirm')).toHaveLength(0);
  });

  it('WITHDRAWAL_CLOSED shows its own label, never the server text', async () => {
    const root = await mount();
    del.mockRejectedValueOnce({ response: { status: 409, data: { detail: 'RAW', code: 'WITHDRAWAL_CLOSED' } } });
    await press(root, 'participant-open-b');
    await press(root, 'details-remove');
    await press(root, 'remove-yes');
    expect(of(root, 'participant-error-b')).toBe('Registration is frozen, so entries can no longer be removed. Use a walkover or a disqualification.');
    expect(all(root)).not.toContain('RAW');
  });
});

describe('team tournament (P2, P4)', () => {
  const team = (id: string, name: string, over: Record<string, unknown> = {}) =>
    reg(id, name, { user_id: null, team_id: `team-${id}`, effective_fee_cents: 4000, team_player_count: 4, team_captain_name: 'Mei Lin', ...over });

  it('rows carry the team name, "n team players · Capt. name", never a member name; Add player is replaced by Add team (AD-2)', async () => {
    reset({ mode: 'team', registrations: [team('t1', 'Team Smashers', { payment_received_at: '2026-10-25T00:00:00Z' }), team('t2', 'Net Ninjas')], summary: summary({ registered: 2, paid: 1, unpaid: 1, fee_cents: 4000, collected_cents: 4000, excluded_from_fixtures: 1 }) });
    const root = await mount();
    const row = all(hostById(root, 'participant-t1')[0]);
    expect(row).toContain('Team Smashers');
    expect(row).toContain('4 team players · Capt. Mei Lin');
    expect(of(root, 'tile-registered')).toContain('Tournament teams');
    expect(of(root, 'participants-warning')).toContain('1 unpaid tournament team will be left out of fixtures.');
    expect(of(root, 'participants-subtitle')).toContain('Tournament teams');
    expect(byId(root, 'participants-add')).toHaveLength(0);
    expect(hostById(root, 'participants-add-team')).toHaveLength(1);
    expect(all(root)).not.toContain('adds individual players only');
  });

  it('tapping a team opens the team details with the roster from the frozen roster route, the captain marked, and the organizer section', async () => {
    reset({ mode: 'team', registrations: [team('t1', 'Team Smashers')], summary: summary({ registered: 1, paid: 0, unpaid: 1, fee_cents: 4000, collected_cents: 0, excluded_from_fixtures: 1 }) });
    server.roster = {
      registration_id: 't1', team_id: 'team-t1', team_name: 'Team Smashers', sport: 'badminton', captain_name: 'Mei Lin', player_count: 4,
      players: [{ user_id: 'p1', display_name: 'Mei Lin', is_captain: true }, { user_id: 'p2', display_name: 'Arjun S', is_captain: false }],
    };
    const root = await mount();
    await press(root, 'participant-open-t1');
    expect(get.mock.calls.some(c => c[0] === '/tournaments/t-1/registrations/t1/roster')).toBe(true);
    const sheet = hostById(root, 'team-details-sheet')[0];
    expect(all(sheet)).toContain('Team Smashers');
    expect(all(sheet)).toContain('Mei Lin · Captain');
    expect(all(sheet)).toContain('Arjun S');
    expect(all(sheet)).toContain('Remove tournament team');
    expect(all(sheet)).toMatch(/40\.00 per tournament team/);
    // A player opens the existing user details pop-up.
    await press(root, 'team-player-p2');
    expect(hostById(root, 'user-menu-sheet')).toHaveLength(1);
  });

  it('without the names (the server withheld them) the pop-up shows the captain and the count only', async () => {
    reset({ mode: 'team', registrations: [team('t1', 'Team Smashers')] });
    server.roster = { registration_id: 't1', team_id: 'team-t1', team_name: 'Team Smashers', sport: 'badminton', captain_name: 'Mei Lin', player_count: 4 };
    const root = await mount();
    await press(root, 'participant-open-t1');
    expect(hostById(root, 'team-details-hidden')).toHaveLength(1);
    expect(all(hostById(root, 'team-details-sheet')[0])).toContain('4 team players');
  });

  it('removing a team asks with the team wording', async () => {
    reset({ mode: 'team', registrations: [team('t1', 'Team Smashers')] });
    server.roster = { registration_id: 't1', sport: 'badminton', captain_name: 'Mei Lin', player_count: 4 };
    const root = await mount();
    await press(root, 'participant-open-t1');
    await press(root, 'details-remove');
    expect(of(root, 'remove-confirm-body')).toBe('Remove Team Smashers from City Open? Their registration, payment status and points are cleared, and the tournament team is told.');
  });
});

describe('another viewer', () => {
  it('sees the entrants and their registration date, no tiles, no switches, no points, no remove', async () => {
    mockUser = 'u-other';
    reset({ committee: false });
    const root = await mount();
    expect(hostById(root, 'participants-summary')).toHaveLength(0);
    expect(byId(root, 'participant-paid-a')).toHaveLength(0);
    expect(byId(root, 'participant-points-a')).toHaveLength(0);
    expect(byId(root, 'participant-remove-a')).toHaveLength(0);
    expect(get.mock.calls.some(c => c[0] === '/tournaments/t-1/registrations/summary')).toBe(false);
    expect(hostById(root, 'participant-a')).toHaveLength(1);
  });
});
