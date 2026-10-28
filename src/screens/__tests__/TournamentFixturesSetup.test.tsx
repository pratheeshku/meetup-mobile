/**
 * Fixtures setup, Review fixtures and the results file on the version 2 tournament page (te-a3, AD-T12; boards
 * TV2MobSetupDraw, TV2MobSetupSubmit, TV2MobSetupResultsFile,
 * TV2MobReviewFixtures). The real screen, tabs and API layer run; the HTTP client, the document picker, the file store
 * and the native alert are doubles. Checks the four steps, the server-driven options and waiting state, names for ids,
 * the refusal lists, and that Reject sends no reason.
 */
import React from 'react';
import { Alert } from 'react-native';
import { pick } from '@react-native-documents/picker';
import ReactNativeBlobUtil from 'react-native-blob-util';

import TournamentDetailScreen from '../TournamentDetailScreen';
import { apiClient } from '../../api/client';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() } }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn().mockResolvedValue({ items: [] }) }));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn().mockResolvedValue([]) }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-me' } }) }));

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;
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

const draftRaw = {
  draft_id: 'draft-1',
  version: 1,
  status: 'draft',
  payload_hash: 'hash-1',
  groups: 2,
  advance_per_group: 2,
  match_count: 2,
  payload: {
    fixture: {
      entrants: [{ entrant_id: 'r1', rank: 1 }, { entrant_id: 'r2', rank: 3 }, { entrant_id: 'r3', rank: 2 }, { entrant_id: 'r4', rank: 4 }],
      stages: [
        { stage_id: 'sA', kind: 'group', group_key: 'A', entrant_ids: ['r1', 'r2'] },
        { stage_id: 'sB', kind: 'group', group_key: 'B', entrant_ids: ['r3', 'r4'] },
        { stage_id: 'sK', kind: 'knockout' },
      ],
      matches: [
        { stage_id: 'sA', round: 1, ordinal: 1, a: { kind: 'entrant', entrant_id: 'r1' }, b: { kind: 'entrant', entrant_id: 'r2' }, schedule: { start: '2026-11-14T01:00:00Z', court: 'Court 1' } },
        { stage_id: 'sK', round: 2, ordinal: 1, a: { kind: 'group_place', group_key: 'A', place: 1 }, b: { kind: 'group_place', group_key: 'B', place: 2 } },
      ],
    },
  },
};
const latest = { draft_id: 'draft-1', version: 1, status: 'draft', payload_hash: 'hash-1', groups: 2, advance_per_group: 2, created_at: '2026-11-13T01:00:00Z' };

const server: Record<string, any> = {};
const reset = (over: { phase?: string; published?: boolean; committee?: unknown; actions?: unknown[]; standings?: unknown } = {}): void => {
  Object.assign(server, {
    tournament: {
      id: 't-1', organizer_id: 'u-me', sport: 'badminton', title: 'Punggol Open 2026', name: null, description: '', format: 'knockout', capacity: 32,
      registration_closes_at: '2026-10-30T15:59:00Z', starts_at: '2026-11-14T01:00:00Z', ends_at: '2999-11-15T10:00:00Z', status: 'upcoming',
      created_at: '2026-09-01T10:00:00Z', lifecycle_version: 2, participation_mode: 'individual', my_invite_access: 'full',
      organizer: { user_id: 'u-me', display_name: 'Me', nickname: null, avatar_url: null }, committee: [], has_custom_banner: true,
    },
    state: {
      enabled: true, applicable: true, is_committee: true, registration_phase: over.phase ?? 'frozen', fixtures_published: over.published ?? false,
      live_poll_seconds: 10, tabs: TABS,
      committee: over.committee ?? { points: null, latest_draft: null, group_options: { suggested: 4, allowed: [2, 4], advance_per_group_allowed: [1, 2] } },
    },
    registrations: ['r1:Ravi K.', 'r2:Alicia Lim', 'r3:Priya Nair', 'r4:Sam Tan'].map(x => ({ id: x.split(':')[0], user_id: `u-${x.split(':')[0]}`, registered_at: '2026-10-13T00:00:00Z', participant_name: x.split(':')[1], status: 'registered' })),
    actions: over.actions ?? [],
    standings: over.standings ?? { published: false, groups: [], knockout: [] },
  });
};

async function mount(): Promise<Instance> {
  get.mockReset().mockImplementation((url: string) => {
    if (url === '/tournaments/t-1') return Promise.resolve({ data: server.tournament });
    if (url === '/tournaments/t-1/scoring/state') return Promise.resolve({ data: server.state });
    if (url === '/tournaments/t-1/registrations') return Promise.resolve({ data: server.registrations });
    if (url === '/tournaments/t-1/standings') return Promise.resolve({ data: server.standings });
    if (url === '/tournaments/t-1/committee/actions') return Promise.resolve({ data: server.actions });
    if (url === '/tournaments/t-1/committee/members') return Promise.resolve({ data: [{ user_id: 'u-me', display_name: 'Me', status: 'active', is_organizer: true }, { user_id: 'u-ali', display_name: 'Alicia Lim', status: 'active', is_organizer: false }] });
    if (url === '/tournaments/t-1/drafts/draft-1') return Promise.resolve({ data: draftRaw });
    if (url.endsWith('/points/template') || url.endsWith('/fixtures/workbook')) return Promise.resolve({ data: new Uint8Array([1, 2, 3]).buffer });
    if (url === '/tournaments/t-1/closure') return Promise.resolve({ data: { can_close: false, version: 0 } });
    if (url === '/home/court-booking') return Promise.resolve({ data: { items: [] } });
    return Promise.resolve({ data: [] });
  });
  post.mockReset().mockResolvedValue({ data: {} });
  const props = { route: { key: 'k', name: 'TournamentDetail', params: { tournamentId: 't-1' } }, navigation: { navigate: jest.fn() } } as unknown as Props;
  return renderAsync(<TournamentDetailScreen {...props} />);
}

const byId = (root: Instance, id: string): Instance[] => root.findAll(n => n.props.testID === id && typeof n.type === 'string');
const node = (root: Instance, id: string): Instance => {
  const found = root.findAll(n => n.props.testID === id && typeof n.props.onPress === 'function')[0];
  if (!found) throw new Error(`nothing to press: ${id}`);
  return found;
};
const press = async (root: Instance, id: string): Promise<void> => {
  await act(async () => {
    await node(root, id).props.onPress();
  });
};
const all = (root: Instance): string => texts(root).join(' | ');
const alertPress = async (label: string): Promise<void> => {
  const calls = (Alert.alert as jest.Mock).mock.calls;
  const button = (calls[calls.length - 1][2] as { text: string; onPress?: () => void }[]).find(b => b.text === label);
  if (!button?.onPress) throw new Error(`no alert button ${label}`);
  await act(async () => {
    await button.onPress?.();
  });
};
const open = async (): Promise<Instance> => {
  const root = await mount();
  await press(root, 'tournament-tab-fixtures');
  return root;
};
const refusal = (status: number, data: unknown) => ({ response: { status, data } });
const picked = { uri: 'file:///tmp/points.xlsx', name: 'points.xlsx', size: 18432, error: null };

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest.clearAllMocks();
  reset();
});
afterEach(() => jest.restoreAllMocks());

describe('Step 1: the points (the points Excel is retired, teams-payments AD-13)', () => {
  it('has no template download and no upload: points are entered on the Participants tab', async () => {
    const root = await open();
    expect(byId(root, 'setup-download')).toHaveLength(0);
    expect(byId(root, 'setup-choose')).toHaveLength(0);
    expect(byId(root, 'setup-upload')).toHaveLength(0);
    expect(all(byId(root, 'setup-points')[0])).toContain('Points are entered on the Participants tab');
    expect(get.mock.calls.some(c => String(c[0]).endsWith('/points/template'))).toBe(false);
  });

  it('before registration is frozen it says so', async () => {
    reset({ phase: 'committee_only' });
    const root = await open();
    expect(all(byId(root, 'fixtures-setup')[0])).toContain('Registration has not closed yet.');
  });

  it('keeps the setup note and shows the points on file from the server', async () => {
    reset({ committee: { points: { entrants: 6, rated: 5, unrated: 1, locked: true, uploaded_at: null }, latest_draft: null, group_options: null } });
    const root = await open();
    expect(all(byId(root, 'fixtures-setup')[0])).toContain('Players cannot see these fixtures until a second committee member approves.');
    expect(all(byId(root, 'setup-points-status')[0])).toContain('6 entries, 5 rated, 1 unrated');
    expect(all(byId(root, 'setup-points')[0])).toContain('locked');
  });
});

describe('unpaid entrants left out of the draw (teams-payments AD-10)', () => {
  const withPoints = { points: { entrants: 4, rated: 4, unrated: 0, locked: false, uploaded_at: null }, latest_draft: null, group_options: { suggested: 2, allowed: [2], advance_per_group_allowed: [1] } };
  const summary = (over: Record<string, unknown> = {}) => ({
    payments_enabled: true, registered: 6, paid: 4, unpaid: 2, exempt: 0, collected_cents: 4000, currency: 'SGD', fee_cents: 1000, excluded_from_fixtures: 2, points_locked: false, ...over,
  });
  const withSummary = (data: unknown): void => {
    const previous = get.getMockImplementation()!;
    get.mockImplementation((url: string) => (url === '/tournaments/t-1/registrations/summary' ? (data instanceof Error ? Promise.reject(data) : Promise.resolve({ data })) : previous(url)));
  };
  const openWith = async (data: unknown): Promise<Instance> => {
    reset({ committee: withPoints });
    const root = await mount();
    withSummary(data);
    await press(root, 'tournament-tab-fixtures');
    return root;
  };

  it('shows the server\'s excluded count before the draw controls, as unpaid players', async () => {
    reset({ committee: withPoints });
    const previous = get;
    const root = await (async () => {
      const r = await mount();
      withSummary(summary());
      await press(r, 'tournament-tab-fixtures');
      return r;
    })();
    expect(previous).toBe(get);
    expect(all(byId(root, 'participants-warning')[0])).toContain('2 unpaid players will be left out of fixtures.');
  });

  it('shows nothing about payment when the tournament is free (payments off)', async () => {
    const root = await openWith(summary({ payments_enabled: false, fee_cents: null, excluded_from_fixtures: 0, paid: 0, unpaid: 0 }));
    expect(byId(root, 'participants-warning')).toHaveLength(0);
    expect(byId(root, 'setup-generate')).not.toHaveLength(0);
  });

  it('a failed summary read hides Generate and says why, never a guessed count', async () => {
    const root = await openWith(new Error('down'));
    expect(byId(root, 'setup-generate')).toHaveLength(0);
    expect(byId(root, 'participants-warning')).toHaveLength(0);
    expect(all(byId(root, 'setup-draw')[0])).toContain('Generating is unavailable until the payment totals can be read.');
  });

  it('the generate answer reports the number actually left out', async () => {
    const root = await openWith(summary());
    post.mockResolvedValueOnce({ data: { ...draftRaw, excluded_unpaid: 2 } });
    await press(root, 'setup-generate');
    expect(all(root)).toContain('2 unpaid left out of the draft.');
  });
});

describe('Step 3: the draw', () => {
  const withPoints = { points: { entrants: 24, rated: 20, unrated: 4, locked: false, uploaded_at: '2026-11-13T00:00:00Z' }, latest_draft: null, group_options: { suggested: 4, allowed: [2, 4], advance_per_group_allowed: [1, 2] } };

  it('needs the points first', async () => {
    const root = await open();
    expect(all(byId(root, 'setup-draw')[0])).toContain('Enter points for at least one entrant');
    expect(byId(root, 'setup-generate')).toHaveLength(0);
  });

  it('offers only the group counts and advance values the server allows, starting on its suggestion', async () => {
    reset({ committee: withPoints });
    const root = await open();
    expect(byId(root, 'setup-groups-2')).not.toHaveLength(0);
    expect(byId(root, 'setup-groups-4')).not.toHaveLength(0);
    expect(byId(root, 'setup-groups-8')).toHaveLength(0);
    expect(byId(root, 'setup-advance-3')).toHaveLength(0);
    expect(node(root, 'setup-groups-4').props.accessibilityState).toEqual({ selected: true });
    expect(all(byId(root, 'setup-points')[0])).toContain('Points on file: 24 entries, 20 rated, 4 unrated.');
  });

  it('generates with the chosen values (one correlation id), without confirming when no draft exists', async () => {
    reset({ committee: withPoints });
    const root = await open();
    await press(root, 'setup-groups-2');
    await press(root, 'setup-advance-1');
    await press(root, 'setup-generate');
    expect(Alert.alert).not.toHaveBeenCalled();
    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe('/tournaments/t-1/fixtures/generate');
    expect(body).toEqual({ group_count: 2, advance_per_group: 1 });
    expect(config.correlationId).toEqual(expect.any(String));
    expect(all(root)).toContain('Draft created.');
  });

  it('shows no group controls when the server sent no options', async () => {
    reset({ committee: { ...withPoints, group_options: null } });
    const root = await open();
    expect(all(byId(root, 'setup-draw')[0])).toContain('Group options are not available yet.');
  });

  it('shows the draft with names, seeds, counts and version, never an id; replacing it is confirmed first', async () => {
    reset({ committee: { ...withPoints, latest_draft: latest } });
    const root = await open();
    const draft = all(byId(root, 'setup-draft')[0]);
    expect(draft).toContain('Version 1, groups: 2, advancing per group: 2');
    expect(draft).toContain('1 group matches, 1 knockout matches');
    expect(draft).toContain('Group A');
    expect(draft).toContain('1. Ravi K.');
    expect(draft).toContain('3. Alicia Lim');
    expect(draft).toContain('2. Priya Nair');
    expect(draft).not.toMatch(/\br[1-4]\b|draft-1|hash-1/);
    await press(root, 'setup-generate');
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(post).not.toHaveBeenCalled();
    await alertPress('Generate a new draft');
    expect(post.mock.calls[0][0]).toBe('/tournaments/t-1/fixtures/generate');
  });

  it('maps FIXTURE_FROZEN once a result exists', async () => {
    reset({ committee: withPoints });
    const root = await open();
    post.mockRejectedValueOnce(refusal(409, { code: 'FIXTURE_FROZEN', detail: 'x' }));
    await press(root, 'setup-generate');
    expect(all(byId(root, 'upload-refusal')[0])).toContain('The fixture cannot be generated again because a result has been posted.');
  });
});

describe('Step 4: submit for review', () => {
  const committee = { points: { entrants: 4, rated: 4, unrated: 0, locked: true, uploaded_at: '2026-11-13T00:00:00Z' }, latest_draft: latest, group_options: { suggested: 2, allowed: [2], advance_per_group_allowed: [1, 2] } };

  it('confirms, then posts fixture_publication bound to the draft and its hash', async () => {
    reset({ committee });
    const root = await open();
    await press(root, 'setup-submit');
    expect(post).not.toHaveBeenCalled();
    await alertPress('Submit for approval');
    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe('/tournaments/t-1/committee/actions');
    expect(body).toEqual({ action_type: 'fixture_publication', draft_id: 'draft-1', payload_hash: 'hash-1' });
    expect(config.correlationId).toEqual(expect.any(String));
    expect(all(root)).toContain('Submitted. Another committee member now has to approve it.');
  });

  it('shows the waiting state from the server\'s requests, with no submit button', async () => {
    reset({ committee, actions: [{ id: 'a1', action_type: 'fixture_publication', status: 'pending', command_payload: { draft_id: 'draft-1' }, consequence_description: '', initiator_user_id: 'u-me', approver_user_id: null, created_at: '2026-11-13T01:00:00Z', resolved_at: null }] });
    const root = await open();
    expect(all(byId(root, 'setup-waiting')[0])).toContain('A publication request for this draft is waiting for approval. See Approvals.');
    expect(byId(root, 'setup-submit')).toHaveLength(0);
  });

  it('a draft that is no longer open cannot be submitted', async () => {
    reset({ committee: { ...committee, latest_draft: { ...latest, status: 'superseded' } } });
    const root = await open();
    expect(byId(root, 'setup-submit')).toHaveLength(0);
    expect(all(byId(root, 'setup-draft')[0])).toContain('This draft is no longer open.');
  });
});

describe('Review fixtures (TV2MobReviewFixtures)', () => {
  const request = { id: 'a1', action_type: 'fixture_publication', status: 'pending', command_payload: { draft_id: 'draft-1' }, consequence_description: 'Publish draft draft-1', initiator_user_id: 'u-ali', approver_user_id: null, created_at: '2026-11-13T01:00:00Z', resolved_at: null };
  const openReview = async (): Promise<Instance> => {
    reset({ committee: { points: null, latest_draft: null, group_options: null }, actions: [request], published: false });
    const root = await mount();
    await press(root, 'tournament-tab-approvals');
    await press(root, 'approval-review-a1');
    return root;
  };

  it('shows the draw with names, never ids, and the counts', async () => {
    const root = await openReview();
    const sheet = all(byId(root, 'review-fixtures')[0]);
    expect(sheet).toContain('Publish fixtures');
    expect(sheet).toContain('Requested by Alicia Lim');
    expect(sheet).toContain('2 matches');
    expect(sheet).toContain('4 players');
    expect(sheet).toContain('Ravi K. against Alicia Lim');
    expect(sheet).toContain('Group A, place 1 against Group B, place 2');
    expect(sheet).not.toMatch(/\br[1-4]\b|draft-1|u-ali/);
  });

  it('Approve and publish uses the approve route; Reject asks to confirm and sends no body and no reason', async () => {
    const root = await openReview();
    expect(root.findAll(n => /reason/i.test(String(n.props.testID ?? '')) || /reason/i.test(String(n.props.accessibilityLabel ?? '')))).toHaveLength(0);
    await press(root, 'review-approve');
    const approve = post.mock.calls.find(c => String(c[0]).endsWith('/a1/approve'))!;
    expect(approve[1]).toEqual({});

    const second = await openReview();
    await press(second, 'review-reject');
    await alertPress('Reject');
    const reject = post.mock.calls.find(c => String(c[0]).endsWith('/a1/reject'))!;
    expect(reject[1]).toBeUndefined();
  });
});

describe('Results file after publication (TV2MobSetupResultsFile)', () => {
  const standings = {
    tournament_id: 't-1', published: true,
    groups: [{ group_key: 'A', complete: false, provisional: true, unresolved_tie: false, needs_override: false, adjusted_by_committee: false, qualifiers_resolved: false, matches_total: 1, matches_played: 0, advance_per_group: 2, table: [], matches: [{ fixture_id: 'f1', match_id: 'G1', stage: 'group', round_number: 1, fixture_order: 1, status: 'scheduled', scheduled_at: null, court: null, side_a: { registration_id: 'r1', name: 'Ravi K.' }, side_b: { registration_id: 'r2', name: 'Alicia Lim' }, winner_registration_id: null, result: null }] }],
    knockout: [],
  };
  const openPublished = async (): Promise<Instance> => {
    reset({ published: true, standings, committee: { points: null, latest_draft: null, group_options: null } });
    return open();
  };

  it('downloads the scoring workbook to the share sheet', async () => {
    const root = await openPublished();
    await press(root, 'results-file-download');
    expect(get.mock.calls.some(c => c[0] === '/tournaments/t-1/fixtures/workbook')).toBe(true);
    expect(ReactNativeBlobUtil.ios.presentOptionsMenu).toHaveBeenCalledWith('/cache/punggol-open-2026-scoring.xlsx');
  });

  it('uploads the filled file, shows posted, corrected and unchanged, and refreshes the board in place', async () => {
    const root = await openPublished();
    (pick as jest.Mock).mockResolvedValueOnce([{ ...picked, name: 'scoring.xlsx' }]);
    await press(root, 'results-file-choose');
    post.mockResolvedValueOnce({ data: { posted: 12, corrected: 2, unchanged: 1 } });
    const before = get.mock.calls.filter(c => c[0] === '/tournaments/t-1/standings').length;
    await press(root, 'results-file-upload');
    expect(post.mock.calls[0][0]).toBe('/tournaments/t-1/fixtures/results-upload');
    expect(all(byId(root, 'results-file-saved')[0])).toBe('Results saved: 12 posted, 2 corrected, 1 unchanged.');
    expect(get.mock.calls.filter(c => c[0] === '/tournaments/t-1/standings').length).toBeGreaterThan(before);
    expect(ReactNativeBlobUtil.fs.unlink).toHaveBeenCalled();
  });

  it('WORKBOOK_STALE asks for a fresh download; rows name the players and point to the correction flow', async () => {
    const root = await openPublished();
    (pick as jest.Mock).mockResolvedValue([picked]);
    await press(root, 'results-file-choose');
    post.mockRejectedValueOnce(refusal(409, { code: 'WORKBOOK_STALE', detail: 'x' }));
    await press(root, 'results-file-upload');
    expect(all(byId(root, 'upload-refusal')[0])).toContain('This workbook is out of date. Download a fresh one.');

    post.mockRejectedValueOnce(
      refusal(422, { code: 'RESULTS_UPLOAD_INVALID', error_count: 2, errors: [{ sheet: 'Group A', row: 4, column: 'Set 1', code: 'MATCH_TIED', match_id: 'G1' }, { sheet: 'Group A', row: 5, column: null, code: 'CORRECTION_NEEDS_APPROVAL', match_id: 'G1' }] }),
    );
    await press(root, 'results-file-upload');
    const text = all(byId(root, 'upload-refusal')[0]);
    expect(text).toContain('The results file was not accepted. Nothing was saved.');
    expect(text).toContain('Ravi K. against Alicia Lim: The sets and the points are level. Add another set.');
    expect(text).toContain('This changes the winner or the result type. It needs another committee member to approve it.');
    expect(text).toContain('Submit a change for this match from the match list below.');
    expect(text).not.toContain('G1');
  });
});

describe('Shuffle again (er-m-shuffle, AD-7, A38 board of record)', () => {
  const committee = { points: { entrants: 4, rated: 4, unrated: 0, locked: true, uploaded_at: '2026-11-13T00:00:00Z' }, latest_draft: latest, group_options: { suggested: 2, allowed: [2], advance_per_group_allowed: [1, 2] } };
  // The next draw: the same four entrants in swapped groups, as the server answers it (draft plus `shuffle {index, total}`).
  const shuffled = (extra: Record<string, unknown> = {}) => ({
    ...draftRaw,
    draft_id: 'draft-2',
    version: 2,
    payload: {
      ...draftRaw.payload,
      fixture: {
        ...draftRaw.payload.fixture,
        stages: [
          { stage_id: 'sA', kind: 'group', group_key: 'A', entrant_ids: ['r3', 'r2'] },
          { stage_id: 'sB', kind: 'group', group_key: 'B', entrant_ids: ['r1', 'r4'] },
          { stage_id: 'sK', kind: 'knockout' },
        ],
      },
    },
    ...extra,
  });
  const shuffleCalls = (): unknown[][] => post.mock.calls.filter(c => c[0] === '/tournaments/t-1/fixtures/shuffle');

  it('is offered on an open draft to the committee, calls the route with no body and one correlation id, and shows the new groups', async () => {
    reset({ committee });
    const root = await open();
    expect(all(byId(root, 'setup-shuffle')[0])).toContain('Shows the next balanced draw.');
    expect(all(byId(root, 'setup-draft')[0])).toContain('Ravi K.');
    post.mockResolvedValueOnce({ data: { ...shuffled(), shuffle: { index: 1, total: 28 } } });
    await press(root, 'setup-shuffle-button');
    const call = shuffleCalls()[0];
    expect(call[1]).toBeUndefined();
    expect((call[2] as { correlationId: string }).correlationId).toEqual(expect.any(String));
    expect(all(byId(root, 'setup-shuffle')[0])).toContain('Draw 2 of 28.');
    const groupA = all(byId(root, 'setup-group-A')[0]);
    expect(groupA).toContain('Priya Nair');
    expect(groupA).not.toContain('Ravi K.');
  });

  it('shows no "n of N" when the answer carries no shuffle block, and the button waits while the request runs', async () => {
    reset({ committee });
    const root = await open();
    let release: (value: unknown) => void = () => undefined;
    post.mockReturnValueOnce(new Promise(resolve => { release = resolve; }));
    await act(async () => {
      node(root, 'setup-shuffle-button').props.onPress();
    });
    expect(node(root, 'setup-shuffle-button').props.disabled).toBe(true);
    await act(async () => {
      node(root, 'setup-shuffle-button').props.onPress();
    });
    expect(shuffleCalls()).toHaveLength(1);
    await act(async () => release({ data: shuffled() }));
    const text = all(byId(root, 'setup-shuffle')[0]);
    expect(text).toContain('Draft created.');
    expect(text).not.toMatch(/Draw \d+ of/);
  });

  it.each([
    [409, { code: 'SHUFFLE_UNAVAILABLE', reason: 'single_draw', detail: 'raw server text' }, 'There is no other balanced draw to show, or the draft can no longer be shuffled.'],
    [429, { error: 'Rate limit exceeded: raw server text' }, 'rate'],
    [409, { code: 'FIXTURE_FROZEN', detail: 'raw server text' }, 'result'],
  ])('a %s refusal shows its labelled message, never the server text', async (status, data, expected) => {
    reset({ committee });
    const root = await open();
    post.mockRejectedValueOnce(refusal(status, data));
    await press(root, 'setup-shuffle-button');
    const text = all(byId(root, 'setup-shuffle')[0]);
    expect(text.toLowerCase()).toContain(expected.toLowerCase());
    expect(text).not.toContain('raw server text');
    expect(node(root, 'setup-shuffle-button').props.disabled).toBeFalsy();
  });

  it('a draft that says it has a single balanced draw disables the button and says why', async () => {
    reset({ committee });
    const single = { ...draftRaw, payload: { ...draftRaw.payload, shuffle_index: 0, shuffle_total: 1 } };
    const previous = get.getMockImplementation();
    const root = await mount();
    get.mockImplementation((url: string, c?: unknown) => (url === '/tournaments/t-1/drafts/draft-1' ? Promise.resolve({ data: single }) : (previous ?? (() => Promise.resolve({ data: [] })))(url, c)));
    await press(root, 'tournament-tab-fixtures');
    expect(all(byId(root, 'setup-shuffle')[0])).toContain('This is the only balanced draw for this tournament.');
    expect(node(root, 'setup-shuffle-button').props.disabled).toBe(true);
  });

  it('is not offered when there is no open draft (a published draft has no Shuffle again)', async () => {
    reset({ committee: { ...committee, latest_draft: { ...latest, status: 'published' } } });
    const root = await open();
    expect(byId(root, 'setup-shuffle')).toHaveLength(0);
  });
});
