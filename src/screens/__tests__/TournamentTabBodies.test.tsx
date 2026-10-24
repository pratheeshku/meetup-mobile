/**
 * Tab bodies of the tournament page for lifecycle version 2 (te-a2; AD-T7 to AD-T10; boards TV2MobOpenParticipants,
 * TV2MobDoneFixtures, TV2MobScore, TV2MobEditScore, TV2MobLiveStandings, TV2MobLiveKnockouts, TV2MobLiveApprovals,
 * TV2MobDoneResults, TV2MobClose, TV2MobLiveMedia, TV2MobOpen). The real screen, tabs and API layer run; only the HTTP
 * client, the picker and the native alert are doubles. Checks that the app never sends a winner, never computes
 * standings, shows the server's preview, polls at the server's interval only while focused, and hard-codes no media limit.
 */
import React from 'react';
import { Alert, AppState } from 'react-native';

import TournamentDetailScreen from '../TournamentDetailScreen';
import { apiClient } from '../../api/client';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { pickImage } from '../../utils/imagePicker';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() } }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn().mockResolvedValue({ items: [] }) }));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn().mockResolvedValue([]) }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-me' } }) }));
jest.mock('../../utils/imagePicker', () => ({ pickImage: jest.fn(), isPickerCancelled: jest.fn(() => false) }));
jest.mock('../../components/UserSearchPicker', () => {
  const ReactMock = require('react');
  const { Pressable } = require('react-native');
  return {
    __esModule: true,
    default: ({ onSelect }: { onSelect: (user: { id: string }) => void }) =>
      ReactMock.createElement(Pressable, { testID: 'picker-select', onPress: () => onSelect({ id: 'u-new' }) }),
  };
});

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;
const put = apiClient.put as jest.Mock;
const del = apiClient.delete as jest.Mock;
const pick = pickImage as jest.Mock;

type Props = React.ComponentProps<typeof TournamentDetailScreen>;

const ORGANIZER = { user_id: 'u-org', display_name: 'Ravi K.', nickname: null, avatar_url: null };
const COMMITTEE = [{ user_id: 'u-alicia', display_name: 'Alicia Lim', nickname: null, avatar_url: null }];

const ALL_OPEN = {
  overview: { state: 'open' },
  participants: { state: 'open' },
  fixtures: { state: 'open' },
  standings: { state: 'open' },
  results: { state: 'open' },
  media: { state: 'open' },
};

const player = (id: string, name: string, mine = false) => ({ registration_id: id, name, placeholder: null, placeholder_detail: null, is_mine: mine });
const open = { registration_id: null, name: null, placeholder: 'group_place', placeholder_detail: { type: 'group_place', group: 'B', place: 2 }, is_mine: false };
const rawMatch = (over: Record<string, unknown> = {}) => ({
  fixture_id: 'f1',
  match_id: 'G1',
  stage: 'group',
  round_number: 1,
  fixture_order: 1,
  status: 'scheduled',
  scheduled_at: '2026-11-14T03:20:00Z',
  court: 'Court 1',
  side_a: player('ra', 'Ravi K.'),
  side_b: player('rb', 'Alicia Lim'),
  winner_registration_id: null,
  result: null,
  ...over,
});
const row = (id: string, name: string, rank: number) => ({ rank, tied: false, registration_id: id, name, played: 0, won: 0, lost: 0, sets_for: 0, sets_against: 0, set_diff: 0, points_for: 0, points_against: 0, point_diff: 0, qualifies: null });
const standings = (matches = [rawMatch()]) => ({
  tournament_id: 't-1',
  published: true,
  tiebreakers: ['matches_won', 'head_to_head'],
  groups: [
    { group_key: 'A', complete: false, provisional: true, unresolved_tie: false, needs_override: false, adjusted_by_committee: false, qualifiers_resolved: false, matches_total: matches.length, matches_played: 0, advance_per_group: 2, table: [row('ra', 'Ravi K.', 1), row('rb', 'Alicia Lim', 2)], matches },
  ],
  knockout: [rawMatch({ fixture_id: 'k1', match_id: 'SF1', stage: 'semifinal', round_number: 2, side_a: player('ra', 'Ravi K.'), side_b: open })],
});

const server: Record<string, any> = {};

const reset = (over: Record<string, any> = {}): void => {
  Object.assign(server, {
    tournament: {
      id: 't-1',
      organizer_id: 'organiser-1',
      sport: 'badminton',
      title: 'Punggol Open',
      name: null,
      description: '',
      format: 'knockout',
      capacity: 32,
      registration_closes_at: '2026-10-30T15:59:00Z',
      starts_at: '2026-11-14T01:00:00Z',
      ends_at: '2999-11-15T10:00:00Z',
      status: 'upcoming',
      created_at: '2026-09-01T10:00:00Z',
      lifecycle_version: 2,
      participation_mode: 'individual',
      organizer: ORGANIZER,
      committee: COMMITTEE,
      banner_tone: 'light',
      banner_scrim: 40,
      has_custom_banner: true,
      ...(over.tournament ?? {}),
    },
    state: { enabled: true, applicable: true, registration_phase: 'frozen', fixtures_published: true, live_poll_seconds: 10, tabs: ALL_OPEN, ...(over.state ?? {}) },
    registrations: [
      { id: 'r1', user_id: 'u-org', registered_at: '2026-10-13T00:00:00Z', participant_name: 'Ravi K.', status: 'registered' },
      { id: 'r2', user_id: 'u-alicia', registered_at: '2026-10-14T00:00:00Z', participant_name: 'Alicia Lim', status: 'registered' },
      { id: 'r3', user_id: 'u-me', registered_at: '2026-10-15T00:00:00Z', participant_name: 'Me Player', status: 'registered' },
    ],
    standings: standings(),
    closure: { can_close: false, version: 0 },
    actions: [],
    members: [],
    media: { items: [], total: 0 },
    ...Object.fromEntries(Object.entries(over).filter(([k]) => !['tournament', 'state'].includes(k))),
  });
};

const listeners: Record<string, (() => void)[]> = {};
const fire = (name: string): void => (listeners[name] ?? []).forEach(cb => cb());
async function mount(): Promise<Instance> {
  get.mockReset().mockImplementation((url: string, config?: { params?: unknown }) => {
    if (url === '/tournaments/t-1') return Promise.resolve({ data: server.tournament });
    if (url === '/tournaments/t-1/scoring/state') return Promise.resolve({ data: server.state });
    if (url === '/tournaments/t-1/registrations') return Promise.resolve({ data: server.registrations });
    if (url === '/tournaments/t-1/standings') return Promise.resolve({ data: server.standings });
    if (url === '/tournaments/t-1/closure') return Promise.resolve({ data: server.closure });
    if (url === '/tournaments/t-1/committee/actions') return Promise.resolve({ data: server.actions });
    if (url === '/tournaments/t-1/committee/members') return Promise.resolve({ data: server.members });
    if (url === '/tournaments/t-1/media') return Promise.resolve({ data: server.media, config });
    if (url === '/home/court-booking') return Promise.resolve({ data: { items: [] } });
    if (url === '/config/client') return Promise.resolve({ data: {} });
    return Promise.resolve({ data: [] });
  });
  post.mockReset().mockResolvedValue({ data: {} });
  put.mockReset().mockResolvedValue({ data: {} });
  del.mockReset().mockResolvedValue({ data: {} });
  const props = {
    route: { key: 'k', name: 'TournamentDetail', params: { tournamentId: 't-1' } },
    navigation: {
      navigate: jest.fn(),
      addListener: (name: string, cb: () => void) => {
        listeners[name] = [...(listeners[name] ?? []), cb];
        return () => {
          listeners[name] = (listeners[name] ?? []).filter(item => item !== cb);
        };
      },
    },
  } as unknown as Props;
  return renderAsync(<TournamentDetailScreen {...props} />);
}

const byId = (root: Instance, id: string): Instance[] => root.findAll(n => n.props.testID === id && typeof n.type === 'string');
const node = (root: Instance, id: string): Instance => {
  const found = root.findAll(n => n.props.testID === id && (typeof n.props.onPress === 'function' || typeof n.props.onChangeText === 'function'))[0];
  if (!found) throw new Error(`nothing to use: ${id}`);
  return found;
};
const press = async (root: Instance, id: string): Promise<void> => {
  await act(async () => {
    node(root, id).props.onPress();
  });
};
const type = async (root: Instance, id: string, value: string): Promise<void> => {
  await act(async () => {
    node(root, id).props.onChangeText(value);
  });
};
const everyText = (root: Instance): string => texts(root).join(' | ');
const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
  });
};
const alertPress = async (label: string): Promise<void> => {
  const calls = (Alert.alert as jest.Mock).mock.calls;
  const buttons = calls[calls.length - 1][2] as { text: string; onPress?: () => void }[];
  const button = buttons.find(b => b.text === label);
  if (!button?.onPress) throw new Error(`no alert button ${label}`);
  await act(async () => {
    await button.onPress?.();
  });
};
const callsTo = (mock: jest.Mock, url: string): unknown[][] => mock.mock.calls.filter(c => c[0] === url);

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  reset();
});
afterEach(() => {
  jest.restoreAllMocks();
});

const committeeState = (): void =>
  reset({ state: { tabs: { ...ALL_OPEN, approvals: { state: 'open', badge: 1 } } }, tournament: { organizer_id: 'u-me', my_invite_access: 'full' } });

describe('Participants (TV2MobOpenParticipants)', () => {
  it('lists the players by name with Organizer and Committee marks; a player has no Add and no Remove', async () => {
    const root = await mount();
    await press(root, 'tournament-tab-participants');
    const body = everyText(byId(root, 'tournament-participants')[0]);
    expect(body).toContain('Ravi K.');
    expect(body).toContain('Organizer');
    expect(body).toContain('Committee');
    expect(body).toContain('3 of 32');
    expect(byId(root, 'participants-add')).toHaveLength(0);
    expect(byId(root, 'participant-remove-r1')).toHaveLength(0);
    expect(body).not.toMatch(/u-org|u-alicia|r1\b/);
  });

  it('the committee removes a player after confirming, and adds one from the search; one correlation id each', async () => {
    reset({
      state: { registration_phase: 'committee_only', tabs: { ...ALL_OPEN, approvals: { state: 'open', badge: 1 } } },
      tournament: { organizer_id: 'u-me', my_invite_access: 'full', registration_hard_block_at: '2026-11-01T10:00:00Z' },
    });
    const root = await mount();
    await press(root, 'tournament-tab-participants');
    expect(everyText(root)).toContain('Add or remove players until the roster is frozen on');
    await press(root, 'participant-remove-r2');
    await alertPress('Remove player');
    expect(del.mock.calls[0][0]).toBe('/tournaments/t-1/registrations/r2');
    expect(del.mock.calls[0][1].correlationId).toEqual(expect.any(String));

    await press(root, 'participants-add');
    await press(root, 'picker-select');
    const add = callsTo(post, '/tournaments/t-1/registrations/committee-add')[0];
    expect(add[1]).toEqual({ user_id: 'u-new' });
    expect((add[2] as { correlationId: string }).correlationId).toEqual(expect.any(String));
  });

  it('a frozen roster says so to the committee', async () => {
    committeeState();
    const root = await mount();
    await press(root, 'tournament-tab-participants');
    expect(everyText(root)).toContain('The roster is frozen. Only the committee can still change it.');
  });
});

describe('Fixtures (TV2MobDoneFixtures)', () => {
  it('shows each match with names, the server\'s result and "N of M played"; filters work on the board as sent', async () => {
    reset({ standings: standings([rawMatch({ result: { result_type: 'normal', sets: [{ a: 21, b: 17 }, { a: 21, b: 15 }], advancing_side: null, version: 1 }, winner_registration_id: 'ra', status: 'completed' }), rawMatch({ fixture_id: 'f2', side_a: player('rc', 'Priya', true), side_b: player('rd', 'Sam') })]) });
    const root = await mount();
    await press(root, 'tournament-tab-fixtures');
    const body = everyText(byId(root, 'tournament-fixtures')[0]);
    expect(body).toContain('1 of 3 played');
    expect(body).toContain('Completed');
    expect(body).toContain('Your match');
    expect(body).toContain('Not scored yet');
    await press(root, 'fixtures-filter-mine');
    expect(byId(root, 'fixture-f2')).toHaveLength(1);
    expect(byId(root, 'fixture-f1')).toHaveLength(0);
  });

  it('before publication it shows the neutral empty line and loads no board', async () => {
    reset({ state: { fixtures_published: false } });
    const root = await mount();
    await press(root, 'tournament-tab-fixtures');
    expect(everyText(byId(root, 'tournament-fixtures')[0])).toContain('There are no matches to show.');
    expect(callsTo(get, '/tournaments/t-1/standings')).toHaveLength(1);
  });

  it('a player has no Enter score; after the closure report nobody has it and the lock is said', async () => {
    const root = await mount();
    await press(root, 'tournament-tab-fixtures');
    expect(byId(root, 'fixture-score-f1')).toHaveLength(0);

    committeeState();
    reset({ state: { tabs: { ...ALL_OPEN, approvals: { state: 'open', badge: 0 } } }, tournament: { lifecycle_status: 'closed' } });
    const closed = await mount();
    await press(closed, 'tournament-tab-fixtures');
    expect(byId(closed, 'fixture-score-f1')).toHaveLength(0);
    expect(everyText(closed)).toContain('The tournament is closed out, so results can no longer be changed.');
  });

  it('Knockouts view: names, slot words for slots not filled yet, no scoring buttons for a slot without both sides', async () => {
    committeeState();
    const root = await mount();
    await press(root, 'tournament-tab-fixtures');
    await press(root, 'fixtures-filter-knockouts');
    expect(everyText(byId(root, 'tournament-fixtures')[0])).toContain('Knockout stage');
    const bracket = everyText(byId(root, 'fixtures-knockouts')[0]);
    expect(bracket).toContain('Group B, place 2');
    expect(bracket).toContain('Ravi K.');
    expect(byId(root, 'fixture-score-k1')).toHaveLength(0);
  });
});

describe('Enter score and Edit score (TV2MobScore, TV2MobEditScore)', () => {
  const openSheet = async (): Promise<Instance> => {
    committeeState();
    const root = await mount();
    await press(root, 'tournament-tab-fixtures');
    await press(root, 'fixture-score-f1');
    return root;
  };

  it('asks the server for the preview and never sends a winner; the final line is the server\'s', async () => {
    const root = await openSheet();
    expect(everyText(byId(root, 'score-sheet')[0])).toContain('Enter 1 to 3 sets. The winner is whoever won more sets. If sets are level, more total points wins.');
    expect(everyText(byId(root, 'score-sheet')[0])).toContain('Set 2 (optional)');
    post.mockResolvedValueOnce({
      data: { was: rawMatch(), will_be: rawMatch({ winner_registration_id: 'ra', result: { result_type: 'normal', sets: [{ a: 21, b: 17 }, { a: 18, b: 21 }, { a: 21, b: 19 }], advancing_side: null, version: 1 } }), standings_delta: [], advanced: [], blocked_by: [] },
    });
    jest.useFakeTimers();
    await type(root, 'score-set-1-a', '21');
    await type(root, 'score-set-1-b', '17');
    await type(root, 'score-set-2-a', '18');
    await type(root, 'score-set-2-b', '21');
    await type(root, 'score-set-3-a', '21');
    await type(root, 'score-set-3-b', '19');
    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    jest.useRealTimers();
    await flush();
    const preview = callsTo(post, '/tournaments/t-1/matches/f1/result/preview').pop() as unknown[];
    expect(preview[1]).toEqual({ result_type: 'normal', sets: [{ a: 21, b: 17 }, { a: 18, b: 21 }, { a: 21, b: 19 }], advancing_side: null, expected_version: 0 });
    expect(Object.keys(preview[1] as object).some(k => /winner|reason|client_request_id/i.test(k))).toBe(false);
    expect(everyText(byId(root, 'score-final-line')[0])).toContain('Final score 2–1. Ravi K. wins.');
  });

  it('saves with one request id, no winner field; the entry response refills the page without a reload', async () => {
    const root = await openSheet();
    await type(root, 'score-set-1-a', '21');
    await type(root, 'score-set-1-b', '10');
    const entry = {
      outcome: 'posted',
      match: rawMatch({ status: 'completed', winner_registration_id: 'ra', result: { result_type: 'normal', sets: [{ a: 21, b: 10 }], advancing_side: null, version: 1 } }),
      standings_delta: [],
      advanced: [{ match_id: 'SF1', fixture_id: 'k1', side: 'B', name: 'Priya Nair', registration_id: 'rz', change: 'slot_filled' }],
      qualified: [{ group_key: 'A', place: 1, registration_id: 'ra', name: 'Ravi K.' }],
      changed_matches: [rawMatch({ fixture_id: 'k1', match_id: 'SF1', stage: 'semifinal', round_number: 2, side_a: player('ra', 'Ravi K.'), side_b: player('rz', 'Priya Nair') })],
      bracket_version: 2,
    };
    post.mockImplementation((url: string) => (url.endsWith('/result') ? Promise.resolve({ data: entry }) : Promise.resolve({ data: { was: null, will_be: null, standings_delta: [], advanced: [], blocked_by: [] } })));
    const before = callsTo(get, '/tournaments/t-1/standings').length;
    await press(root, 'score-save');
    const save = callsTo(post, '/tournaments/t-1/matches/f1/result')[0];
    expect(save[1]).toMatchObject({ result_type: 'normal', sets: [{ a: 21, b: 10 }], advancing_side: null, expected_version: 0 });
    expect((save[1] as { client_request_id: string }).client_request_id).toEqual(expect.any(String));
    expect(Object.keys(save[1] as object).some(k => /winner/i.test(k))).toBe(false);
    expect(byId(root, 'score-sheet')).toHaveLength(0);
    expect(everyText(root)).toContain('Score saved.');
    // the knockout slot was refilled from the response; no board was fetched again
    await press(root, 'fixtures-filter-knockouts');
    expect(everyText(byId(root, 'fixtures-knockouts')[0])).toContain('Priya Nair');
    expect(everyText(byId(root, 'fixtures-knockouts')[0])).toContain('Just set');
    expect(everyText(byId(root, 'fixtures-knockouts')[0])).toContain('Group A is finished. Ravi K. go through.');
    expect(callsTo(get, '/tournaments/t-1/standings')).toHaveLength(before);
  });

  it('a level match shows the MATCH_TIED text (the server decides)', async () => {
    const root = await openSheet();
    await type(root, 'score-set-1-a', '21');
    await type(root, 'score-set-1-b', '19');
    post.mockImplementation((url: string) =>
      url.endsWith('/result') ? Promise.reject({ response: { status: 422, data: { code: 'MATCH_TIED', errors: [{ column: 'sets', code: 'MATCH_TIED' }] } } }) : Promise.resolve({ data: {} }),
    );
    await press(root, 'score-save');
    expect(everyText(byId(root, 'score-error')[0])).toBe('The sets and the points are level. Add another set.');
    expect(byId(root, 'score-sheet')).toHaveLength(1);
  });

  it('set 3 without set 2 is stopped on the device; nothing is sent', async () => {
    const root = await openSheet();
    await type(root, 'score-set-1-a', '21');
    await type(root, 'score-set-1-b', '10');
    await type(root, 'score-set-3-a', '21');
    await type(root, 'score-set-3-b', '10');
    expect(node(root, 'score-save').props.disabled).toBe(true);
    expect(callsTo(post, '/tournaments/t-1/matches/f1/result')).toHaveLength(0);
  });

  it('RESULTS_LOCKED after closure is shown from the server', async () => {
    const root = await openSheet();
    await type(root, 'score-set-1-a', '21');
    await type(root, 'score-set-1-b', '10');
    post.mockImplementation((url: string) =>
      url.endsWith('/result') ? Promise.reject({ response: { status: 409, data: { code: 'RESULTS_LOCKED' } } }) : Promise.resolve({ data: {} }),
    );
    await press(root, 'score-save');
    expect(everyText(byId(root, 'score-error')[0])).toContain('closed out');
  });

  it('a correction needs a reason, shows "was", and a winner change is sent for approval', async () => {
    reset({
      state: { tabs: { ...ALL_OPEN, approvals: { state: 'open', badge: 0 } } },
      tournament: { organizer_id: 'u-me', my_invite_access: 'full' },
      standings: standings([rawMatch({ status: 'completed', winner_registration_id: 'ra', result: { result_type: 'normal', sets: [{ a: 21, b: 12 }], advancing_side: null, version: 3 } })]),
    });
    const root = await mount();
    await press(root, 'tournament-tab-fixtures');
    await press(root, 'fixture-score-f1');
    expect(everyText(byId(root, 'score-sheet')[0])).toContain('Edit score');
    await type(root, 'score-set-1-a', '12');
    await type(root, 'score-set-1-b', '21');
    expect(everyText(byId(root, 'score-sheet')[0])).toContain('was 21');
    expect(node(root, 'score-save').props.disabled).toBe(true);
    await type(root, 'score-reason', 'Entered the wrong way round');
    post.mockImplementation((url: string) =>
      url.endsWith('/result')
        ? Promise.reject({ response: { status: 409, data: { code: 'CORRECTION_NEEDS_APPROVAL', submission: {} } } })
        : Promise.resolve({ data: { was: null, will_be: null, standings_delta: [], advanced: [], blocked_by: [] } }),
    );
    await press(root, 'score-save');
    const save = callsTo(post, '/tournaments/t-1/matches/f1/result')[0][1] as { reason: string; expected_version: number };
    expect(save.reason).toBe('Entered the wrong way round');
    expect(save.expected_version).toBe(3);
    const proposal = callsTo(post, '/tournaments/t-1/committee/actions')[0][1];
    expect(proposal).toEqual({ action_type: 'result_winner_change', fixture_id: 'f1', result_type: 'normal', sets: [{ a: 12, b: 21 }], advancing_side: null, reason: 'Entered the wrong way round' });
    expect(everyText(root)).toContain('Sent to another committee member for approval.');
  });
});

describe('Standings and live fill (TV2MobLiveStandings)', () => {
  it('draws the tables as the server sent them, the tie-break order in words, and the knockout slots below', async () => {
    const root = await mount();
    await press(root, 'tournament-tab-standings');
    const body = everyText(byId(root, 'tournament-standings')[0]);
    expect(body).toContain('Group A');
    expect(body).toContain('Qualify: top 2');
    expect(body).toContain('Tie-break order: matches won, head-to-head');
    expect(body).toContain('Knockout stage');
    expect(body).toContain('Group B, place 2');
  });

  it('refreshes at live_poll_seconds, only while the screen is focused, and stops when it is not', async () => {
    jest.useFakeTimers();
    const root = await mount();
    await press(root, 'tournament-tab-standings');
    const base = callsTo(get, '/tournaments/t-1/standings').length;
    await act(async () => {
      jest.advanceTimersByTime(9000);
    });
    expect(callsTo(get, '/tournaments/t-1/standings')).toHaveLength(base);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(callsTo(get, '/tournaments/t-1/standings')).toHaveLength(base + 1);
    // a newer board from the server is swapped in without a reload
    server.standings = { ...standings(), groups: [{ ...standings().groups[0], table: [row('rb', 'Alicia Lim', 1), row('ra', 'Ravi K.', 2)] }] };
    await act(async () => {
      jest.advanceTimersByTime(10000);
    });
    // the screen loses focus: no more refreshes
    await act(async () => {
      fire('blur');
    });
    const frozen = callsTo(get, '/tournaments/t-1/standings').length;
    await act(async () => {
      jest.advanceTimersByTime(60000);
    });
    expect(callsTo(get, '/tournaments/t-1/standings')).toHaveLength(frozen);
    // and it starts again when the screen is focused again
    await act(async () => {
      fire('focus');
    });
    await act(async () => {
      jest.advanceTimersByTime(10000);
    });
    expect(callsTo(get, '/tournaments/t-1/standings').length).toBeGreaterThan(frozen);
    jest.useRealTimers();
  });

  it('does not refresh when the server sent no interval, and not while the app is in the background', async () => {
    jest.useFakeTimers();
    reset({ state: { live_poll_seconds: null } });
    const root = await mount();
    await press(root, 'tournament-tab-standings');
    const base = callsTo(get, '/tournaments/t-1/standings').length;
    await act(async () => {
      jest.advanceTimersByTime(60000);
    });
    expect(callsTo(get, '/tournaments/t-1/standings')).toHaveLength(base);
    expect(AppState.currentState).toBeDefined();
    jest.useRealTimers();
  });
});

describe('Approvals (TV2MobLiveApprovals, TV2MobClosedApprovals)', () => {
  const requests = [
    { id: 'a1', action_type: 'result_winner_change', command_payload: { fixture_id: 'f1', reason: 'Wrong way round' }, consequence_description: 'x', initiator_user_id: 'u-alicia', approver_user_id: null, status: 'pending', created_at: '2026-11-14T01:00:00Z', resolved_at: null },
    { id: 'a2', action_type: 'fixture_publication', command_payload: {}, consequence_description: 'x', initiator_user_id: 'u-me', approver_user_id: null, status: 'pending', created_at: '2026-11-13T01:00:00Z', resolved_at: null },
  ];
  const members = [
    { user_id: 'u-me', display_name: 'Me Player', status: 'active', is_organizer: true },
    { user_id: 'u-alicia', display_name: 'Alicia Lim', status: 'active', is_organizer: false },
  ];

  it('is not drawn at all unless the server sent tabs.approvals', async () => {
    const root = await mount();
    expect(byId(root, 'tournament-tab-approvals')).toHaveLength(0);
  });

  it('Approve runs the request; Reject takes no reason and no body; Withdraw is the maker\'s own reject', async () => {
    committeeState();
    reset({ state: { tabs: { ...ALL_OPEN, approvals: { state: 'open', badge: 1 } } }, tournament: { organizer_id: 'u-me', my_invite_access: 'full' }, actions: requests, members });
    const root = await mount();
    await press(root, 'tournament-tab-approvals');
    const body = everyText(byId(root, 'tournament-approvals')[0]);
    expect(body).toContain('Needs your review');
    expect(body).toContain('Change a match winner');
    expect(body).toContain('Ravi K. against Alicia Lim');
    expect(body).toContain('Requested by Alicia Lim');
    expect(body).toContain('Submitted by you (Me Player)');
    expect(body).toContain('Waiting for Alicia Lim.');
    expect(body).not.toMatch(/u-alicia|u-me|a1\b/);
    // no reason field exists
    expect(root.findAll(n => n.props.testID === 'approval-reason')).toHaveLength(0);

    await press(root, 'approval-approve-a1');
    const approve = callsTo(post, '/tournaments/t-1/committee/actions/a1/approve')[0];
    expect(approve[1]).toEqual({});
    expect((approve[2] as { correlationId: string }).correlationId).toEqual(expect.any(String));

    await press(root, 'approval-reject-a1');
    await alertPress('Reject');
    const reject = callsTo(post, '/tournaments/t-1/committee/actions/a1/reject')[0];
    expect(reject[1]).toBeUndefined();

    await press(root, 'approval-withdraw-a2');
    await alertPress('Withdraw request');
    expect(callsTo(post, '/tournaments/t-1/committee/actions/a2/reject')).toHaveLength(1);
  });

  it('shows the server\'s refusal of an approval in words', async () => {
    reset({ state: { tabs: { ...ALL_OPEN, approvals: { state: 'open', badge: 1 } } }, tournament: { organizer_id: 'u-me', my_invite_access: 'full' }, actions: [requests[0]], members });
    const root = await mount();
    await press(root, 'tournament-tab-approvals');
    post.mockRejectedValueOnce({ response: { status: 409, data: { code: 'DOWNSTREAM_PLAYED', detail: 'x' } } });
    await press(root, 'approval-approve-a1');
    expect(everyText(root)).toContain('A later match already has a result');
  });
});

describe('Results and Close tournament (TV2MobDoneResults, TV2MobClose)', () => {
  const closed = {
    can_close: true,
    outcome: 'completed',
    version: 2,
    closed_at: '2026-11-16T01:00:00Z',
    winner: { display_name: 'Priya Nair', registration_id: 'rc' },
    runner_up: { display_name: 'Ravi K.', registration_id: 'ra' },
    third_place: { display_name: 'Daniel Soh', registration_id: 'rd' },
    star: { display_name: 'Priya Nair', user_id: 'u-pri' },
    comments: 'Thank you all for a fantastic weekend.',
    attendees: [{ registration_id: 'ra', display_name: 'Ravi K.' }, { registration_id: 'rc', display_name: 'Priya Nair' }, { registration_id: 'rd', display_name: 'Daniel Soh' }],
    candidates: [
      { registration_id: 'ra', display_name: 'Ravi K.', user_id: 'u-org', members: [{ user_id: 'u-org', display_name: 'Ravi K.' }] },
      { registration_id: 'rc', display_name: 'Priya Nair', user_id: 'u-pri', members: [{ user_id: 'u-pri', display_name: 'Priya Nair' }] },
      { registration_id: 'rd', display_name: 'Daniel Soh', user_id: 'u-dan', members: [{ user_id: 'u-dan', display_name: 'Daniel Soh' }] },
    ],
  };

  it('shows champion, runner-up, third, star, comments and the summary, all from the server', async () => {
    reset({ closure: { ...closed, can_close: false }, tournament: { lifecycle_status: 'closed', closure_outcome: 'completed', ends_at: '2026-11-15T10:00:00Z' }, media: { items: [{ id: 'm1', kind: 'photo', url: 'https://cdn.example/1.jpg', created_at: 'x', uploaded_by: 'Ravi K.', can_remove: false }], total: 24 } });
    const root = await mount();
    await press(root, 'tournament-tab-results');
    const body = everyText(byId(root, 'tournament-results')[0]);
    expect(body).toContain('Champion');
    expect(body).toContain('Priya Nair');
    expect(body).toContain('Third place');
    expect(body).toContain('Daniel Soh');
    expect(body).toContain('Star of the tournament');
    expect(body).toContain('Thank you all for a fantastic weekend.');
    expect(body).toContain('See all 24 in Media');
    expect(body).toContain('Submitted');
    expect(texts(byId(root, 'results-summary')[0])).toContain('2');
    expect(byId(root, 'results-close-button')).toHaveLength(0);
  });

  it('the committee files the report: third place, star, comments with a counter; one PUT with the version', async () => {
    reset({ state: { tabs: { ...ALL_OPEN, approvals: { state: 'open', badge: 0 } } }, tournament: { organizer_id: 'u-me', my_invite_access: 'full', lifecycle_status: 'past' }, closure: { can_close: true, version: 0, candidates: closed.candidates, prefill: { winner: closed.winner, runner_up: closed.runner_up, attendees: closed.attendees } } });
    const root = await mount();
    await press(root, 'tournament-tab-results');
    expect(everyText(byId(root, 'tournament-results')[0])).toContain('Edit the closure report: comments, star of the tournament and photos.');
    await press(root, 'results-close-button');
    expect(byId(root, 'close-sheet')).toHaveLength(1);
    await type(root, 'close-comments', 'Great weekend');
    expect(everyText(byId(root, 'close-counter')[0])).toBe('13 of 500');
    put.mockResolvedValueOnce({ data: { ...closed } });
    await press(root, 'close-submit');
    const [url, body, config] = put.mock.calls[0];
    expect(url).toBe('/tournaments/t-1/closure');
    expect(body).toMatchObject({ outcome: 'completed', winner_registration_id: 'rc', runner_up_registration_id: 'ra', third_place_registration_id: null, star_user_id: null, comments: 'Great weekend', expected_version: 0 });
    expect(config.correlationId).toEqual(expect.any(String));
  });

  it('stops comments over 500 characters before asking, and shows the server\'s coded refusal', async () => {
    reset({ state: { tabs: { ...ALL_OPEN, approvals: { state: 'open', badge: 0 } } }, tournament: { organizer_id: 'u-me', my_invite_access: 'full', lifecycle_status: 'past' }, closure: { can_close: true, version: 1, candidates: closed.candidates, prefill: { winner: closed.winner, runner_up: closed.runner_up, attendees: closed.attendees } } });
    const root = await mount();
    await press(root, 'tournament-tab-results');
    await press(root, 'results-close-button');
    await type(root, 'close-comments', 'x'.repeat(501));
    await press(root, 'close-submit');
    expect(put).not.toHaveBeenCalled();
    expect(everyText(byId(root, 'close-sheet')[0])).toContain('The comments are too long.');
    await type(root, 'close-comments', 'ok');
    put.mockRejectedValueOnce({ response: { status: 422, data: { code: 'star_not_attendee' } } });
    await press(root, 'close-submit');
    expect(everyText(byId(root, 'close-sheet')[0])).toContain('The star of the tournament must be one of the players.');
  });
});

describe('Media (TV2MobLiveMedia)', () => {
  const items = { items: [{ id: 'm1', kind: 'photo', url: 'https://cdn.example/1.jpg', created_at: 'x', uploaded_by: 'Ravi K.', can_remove: true }, { id: 'm2', kind: 'photo', url: 'https://cdn.example/2.jpg', created_at: 'x', uploaded_by: 'Alicia Lim', can_remove: false }], total: 2 };

  it('lists the photos newest first, shows Remove only where the server allows it, and the empty state', async () => {
    reset({ media: items });
    const root = await mount();
    await press(root, 'tournament-tab-media');
    expect(byId(root, 'media-m1')).toHaveLength(1);
    expect(root.findAll(n => n.props.testID === 'media-remove-m1' && typeof n.props.onPress === 'function')).toHaveLength(1);
    expect(root.findAll(n => n.props.testID === 'media-remove-m2' && typeof n.props.onPress === 'function')).toHaveLength(0);
    expect(everyText(byId(root, 'tournament-media')[0])).toContain('2 items');

    reset({ media: { items: [], total: 0 } });
    const empty = await mount();
    await press(empty, 'tournament-tab-media');
    expect(everyText(byId(empty, 'tournament-media')[0])).toContain('No photos or videos yet.');
  });

  it('uploads a picked photo as one multipart field, with no size or count check on the device', async () => {
    const root = await (async () => {
      reset({ media: items });
      return mount();
    })();
    await press(root, 'tournament-tab-media');
    pick.mockResolvedValueOnce({ path: 'file:///p.jpg', filename: 'p.jpg', mime: 'image/jpeg' });
    await press(root, 'media-upload');
    await alertPress('Choose from library');
    await flush();
    expect(pick).toHaveBeenCalledWith('library', expect.any(String), null);
    const [url, form, config] = callsTo(post, '/tournaments/t-1/media')[0] as [string, FormData, { correlationId: string; headers: Record<string, string> }];
    expect(url).toBe('/tournaments/t-1/media');
    expect(form).toBeInstanceOf(FormData);
    expect(config.correlationId).toEqual(expect.any(String));
    expect(config.headers['Content-Type']).toBe('multipart/form-data');
    expect(everyText(byId(root, 'media-message')[0])).toBe('Added.');
  });

  it('shows the server\'s refusal when the limit is reached, and removes a photo after confirming', async () => {
    reset({ media: items });
    const root = await mount();
    await press(root, 'tournament-tab-media');
    pick.mockResolvedValueOnce({ path: 'file:///p.jpg', filename: 'p.jpg', mime: 'image/jpeg' });
    post.mockRejectedValueOnce({ response: { status: 409, data: { detail: { code: 'MEDIA_LIMIT_REACHED', message: 'limit' } } } });
    await press(root, 'media-upload');
    await alertPress('Take photo');
    await flush();
    expect(everyText(byId(root, 'media-message')[0])).toBe('This tournament has reached its limit of photos and videos.');

    await press(root, 'media-remove-m1');
    await alertPress('Remove');
    expect(del.mock.calls[0][0]).toBe('/tournaments/t-1/media/m1');
  });

  it('a person who is not registered and not on the committee sees the gallery but no upload', async () => {
    reset({ registrations: [], media: items });
    const root = await mount();
    await press(root, 'tournament-tab-media');
    expect(byId(root, 'media-upload')).toHaveLength(0);
    expect(byId(root, 'media-m1')).toHaveLength(1);
  });
});

describe('Overview additions (A2, A3)', () => {
  it('draws Format and Key dates rows only for values the server sent; never a hard-coded elimination or court row', async () => {
    reset({
      tournament: {
        registration_opened_at: '2026-09-01T10:00:00Z',
        registration_hard_block_at: '2026-11-01T10:00:00Z',
        roster_frozen_at: '2026-11-01T10:00:00Z',
        format_rules: { elimination: null, sets_best_of: 3, points_to_win: 21, courts: null, min_participants: 6, max_participants: 32 },
      },
    });
    const root = await mount();
    const format = everyText(byId(root, 'overview-format')[0]);
    expect(format).toContain('Best of 3 sets');
    expect(format).toContain('21 points to win');
    expect(format).toContain('Min 6, max 32');
    expect(format).not.toMatch(/elimination|court/i);
    const dates = everyText(byId(root, 'overview-key-dates')[0]);
    expect(dates).toContain('Registration opened');
    expect(dates).toContain('Hard block');
    expect(byId(root, 'key-date-hard-done')).toHaveLength(1);
  });

  it('draws no rules row and no hard block row when the server sent none', async () => {
    reset({ tournament: { format_rules: null, registration_hard_block_at: null, registration_opened_at: null } });
    const root = await mount();
    expect(byId(root, 'format-rule-sets')).toHaveLength(0);
    expect(everyText(byId(root, 'overview-key-dates')[0])).not.toContain('Hard block');
    expect(everyText(byId(root, 'overview-key-dates')[0])).not.toContain('Registration opened');
  });

  it('offers Add banner to the committee only while has_custom_banner is false, and uploads with one correlation id', async () => {
    reset({ state: { tabs: { ...ALL_OPEN, approvals: { state: 'open', badge: 0 } } }, tournament: { organizer_id: 'u-me', my_invite_access: 'full', has_custom_banner: false, lifecycle_status: 'active' } });
    const root = await mount();
    expect(everyText(byId(root, 'overview-tools')[0])).toContain('Add banner');
    pick.mockResolvedValueOnce({ path: 'file:///b.jpg', filename: 'b.jpg', mime: 'image/jpeg' });
    put.mockResolvedValueOnce({ data: { banner_url: 'https://cdn.example/b.jpg', logo_url: null, banner_tone: 'dark', banner_scrim: 30, has_custom_banner: true } });
    await press(root, 'overview-tool-banner');
    await alertPress('Choose from library');
    await flush();
    const [url, , config] = put.mock.calls[0];
    expect(url).toBe('/tournaments/t-1/banner');
    expect(config.correlationId).toEqual(expect.any(String));
    expect(pick).toHaveBeenCalledWith('library', expect.any(String), { width: 1600, height: 400 });

    reset({ state: { tabs: { ...ALL_OPEN, approvals: { state: 'open', badge: 0 } } }, tournament: { organizer_id: 'u-me', my_invite_access: 'full', has_custom_banner: true } });
    const own = await mount();
    expect(byId(own, 'overview-tool-banner')).toHaveLength(0);
    reset({ tournament: { has_custom_banner: false } });
    const viewer = await mount();
    expect(byId(viewer, 'overview-tool-banner')).toHaveLength(0);
  });

  it('the Closure report tool opens the Results tab (the Close form), not a separate modal', async () => {
    reset({ state: { tabs: { ...ALL_OPEN, approvals: { state: 'open', badge: 0 } } }, tournament: { organizer_id: 'u-me', my_invite_access: 'full', lifecycle_status: 'past' }, closure: { can_close: true, version: 0, candidates: [], prefill: null } });
    const root = await mount();
    await press(root, 'overview-tool-closure');
    expect(byId(root, 'tournament-results')).toHaveLength(1);
  });
});
