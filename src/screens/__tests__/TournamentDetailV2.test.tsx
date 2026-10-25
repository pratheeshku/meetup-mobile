/**
 * Tournament page for lifecycle version 2 (tournament-experience AD-T5, AD-T6; boards TV2MobOpen, TV2MobClosedOverview,
 * TV2MobDoneOverview, TV2MobOpenLockFixtures, TV2MobLiveLockResults, TV2MobPopupOrg, TV2MobPopupCom). The real screen
 * and the real API layer run; only the HTTP client is mocked. Version 1 (no server `tabs`) keeps the legacy page.
 */
import React from 'react';
import { Linking } from 'react-native';

import TournamentDetailScreen from '../TournamentDetailScreen';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { mockGet, mockPost, rawTournament } from '../../test-utils/tournamentDetailHarness';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn().mockResolvedValue({ items: [] }) }));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn().mockResolvedValue([]) }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-me' } }) }));

type Props = React.ComponentProps<typeof TournamentDetailScreen>;

const ORGANIZER = { user_id: 'u-org-secret', display_name: 'Ravi K.', nickname: 'Ravi', avatar_url: null };
const COMMITTEE = [
  { user_id: 'u-c1-secret', display_name: 'Alicia Lim', nickname: 'Ally', avatar_url: null },
  { user_id: 'u-c2-secret', display_name: 'Joyce Lee', nickname: 'JoJo', avatar_url: null },
  { user_id: 'u-c3-secret', display_name: 'Sam Tan', nickname: null, avatar_url: null },
];
const PROVIDERS = [{ id: 'p1', name: 'CourtHub', description: 'Courts', booking_url: 'https://courthub.example/book', logo_url: null }];

const PLAYER_TABS = {
  overview: { state: 'open' },
  participants: { state: 'open' },
  fixtures: { state: 'locked', unlocks: 'fixtures_published' },
  standings: { state: 'locked', unlocks: 'fixtures_published' },
  results: { state: 'locked', unlocks: 'tournament_closed' },
  media: { state: 'locked', unlocks: 'play_starts' },
};

const server: {
  tournament: Record<string, unknown>;
  state: Record<string, unknown> | null;
  providers: unknown[];
  closure: Record<string, unknown> | null;
  registrations: unknown[];
} = { tournament: {}, state: null, providers: [], closure: null, registrations: [] };

const stateOf = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  enabled: true,
  applicable: true,
  registration_phase: 'open',
  is_committee: false,
  fixtures_published: false,
  any_result_posted: false,
  committee: null,
  tabs: PLAYER_TABS,
  live_poll_seconds: 10,
  ...over,
});

const registrationsOf = (n: number): unknown[] =>
  Array.from({ length: n }, (_, i) => ({ id: `r${i}`, user_id: `p${i}`, registered_at: '2026-10-20T00:00:00Z', participant_name: `Player ${i}`, status: 'registered' }));

async function mount(
  tournament: Record<string, unknown> = {},
  state: Record<string, unknown> | null = stateOf(),
  extra: { providers?: unknown[]; closure?: Record<string, unknown> | null; registrations?: unknown[] } = {},
): Promise<Instance> {
  server.tournament = rawTournament({
    organizer_id: 'organiser-1',
    registration_closes_at: '2026-10-30T15:59:00Z',
    ends_at: '2999-10-02T10:00:00Z',
    participation_mode: 'individual',
    venue_name: 'Punggol Sports Hall',
    visibility: 'public',
    organizer: ORGANIZER,
    committee: COMMITTEE,
    banner_url: null,
    logo_url: null,
    banner_tone: 'light',
    banner_scrim: 40,
    ...tournament,
  });
  server.state = state;
  server.providers = extra.providers ?? PROVIDERS;
  server.closure = extra.closure ?? null;
  server.registrations = extra.registrations ?? registrationsOf(18);
  mockGet.mockReset().mockImplementation((url: string) => {
    if (url === '/tournaments/t-1') return Promise.resolve({ data: server.tournament });
    if (url === '/tournaments/t-1/scoring/state') {
      return server.state ? Promise.resolve({ data: server.state }) : Promise.reject({ response: { status: 404 } });
    }
    if (url === '/tournaments/t-1/registrations') return Promise.resolve({ data: server.registrations });
    if (url === '/tournaments/t-1/closure') {
      return server.closure ? Promise.resolve({ data: server.closure }) : Promise.reject({ response: { status: 403 } });
    }
    if (url === '/home/court-booking') return Promise.resolve({ data: { items: server.providers } });
    if (url === '/config/client') return Promise.resolve({ data: {} });
    return Promise.resolve({ data: [] });
  });
  mockPost.mockReset().mockResolvedValue({ data: {} });
  const props = {
    route: { key: 'k', name: 'TournamentDetail', params: { tournamentId: 't-1' } },
    navigation: { navigate: jest.fn() },
  } as unknown as Props;
  return renderAsync(<TournamentDetailScreen {...props} />);
}

const byId = (root: Instance, id: string): Instance[] => root.findAll(n => n.props.testID === id && typeof n.type === 'string');
const pressable = (root: Instance, id: string): Instance =>
  root.findAll(n => n.props.testID === id && typeof n.props.onPress === 'function')[0];
const press = async (root: Instance, id: string): Promise<void> => {
  const node = pressable(root, id);
  if (!node) throw new Error(`nothing to press: ${id}`);
  await act(async () => {
    node.props.onPress();
  });
};
const tabKeys = (root: Instance): string[] =>
  byId(root, 'tournament-tabs')[0]
    .findAll(n => String(n.props.testID ?? '').startsWith('tournament-tab-') && typeof n.props.onPress === 'function')
    .map(n => String(n.props.testID).replace('tournament-tab-', ''))
    .filter((key, index, all) => all.indexOf(key) === index);
const everyText = (root: Instance): string => texts(root).join(' | ');

describe('which page', () => {
  it('lifecycle_version 2 shows the new page; 1 keeps the legacy page, whatever tabs say (te-a2)', async () => {
    expect(byId(await mount({ lifecycle_version: 2 }), 'tournament-detail-v2')).toHaveLength(1);
    const legacy = await mount({ lifecycle_version: 1 });
    expect(byId(legacy, 'tournament-detail-v2')).toHaveLength(0);
    expect(texts(legacy)).toContain('Summer Smash');
  });

  it('a server that sends no version falls back to the presence of the server tabs object', async () => {
    expect(byId(await mount(), 'tournament-detail-v2')).toHaveLength(1);
    const legacy = await mount({}, stateOf({ tabs: undefined }));
    expect(byId(legacy, 'tournament-detail-v2')).toHaveLength(0);
    expect(texts(legacy)).toContain('Summer Smash');
    // no scoring state at all (404) and no version: legacy as well
    expect(byId(await mount({}, null), 'tournament-detail-v2')).toHaveLength(0);
  });

  it('version 2 whose scoring state could not be read still gets the new page, with Overview only (always open)', async () => {
    const root = await mount({ lifecycle_version: 2 }, null);
    expect(byId(root, 'tournament-detail-v2')).toHaveLength(1);
    expect(tabKeys(root)).toEqual(['overview']);
    expect(byId(root, 'tournament-overview')).toHaveLength(1);
  });
});

describe('court or hall details (te-a4, AD-T13)', () => {
  it('shows venue_detail after the venue name in the header and in the Overview; hidden when there is none', async () => {
    const root = await mount({ venue_detail: 'Court 2' });
    expect(everyText(root)).toContain('Punggol Sports Hall, Court 2');
    expect(texts(byId(root, 'overview-venue-detail')[0])).toEqual(['Court 2']);
    const none = await mount({ venue_detail: null });
    expect(byId(none, 'overview-venue-detail')).toHaveLength(0);
    expect(everyText(none)).not.toContain('Punggol Sports Hall,');
    const blank = await mount({ venue_detail: '   ' });
    expect(byId(blank, 'overview-venue-detail')).toHaveLength(0);
  });
});

describe('header (AD-T6)', () => {
  it('shows the title, meta line, organizer and committee by name, and never an id', async () => {
    const root = await mount();
    const all = everyText(root);
    expect(all).toContain('Summer Smash');
    expect(all).toContain('Punggol Sports Hall');
    expect(all).toContain('Organized by');
    expect(all).toContain('Ravi K.');
    expect(all).toContain('Committee');
    expect(all).toContain('Alicia Lim, Joyce Lee +1');
    expect(all).not.toMatch(/u-org-secret|u-c1-secret|organiser-1|t-1/);
  });

  it('the strip text tone and scrim are the server\'s values (scrim 25 percent here)', async () => {
    const root = await mount({ banner_tone: 'dark', banner_scrim: 25 });
    const strip = byId(root, 'status-strip')[0];
    const layers = strip.findAll(n => {
      const style = ([] as unknown[]).concat(n.props.style ?? []).flat(3) as { opacity?: number }[];
      return typeof n.type === 'string' && style.some(item => item && item.opacity === 0.25);
    });
    expect(layers.length).toBeGreaterThan(0);
  });

  it('the organizer chip opens the pop-up: picture, display name and nickname, no actions, no id', async () => {
    const root = await mount();
    await press(root, 'tournament-organizer-chip');
    expect(texts(byId(root, 'people-sheet-title')[0])).toEqual(['Organizer']);
    const rows = byId(root, 'people-sheet-row');
    expect(rows).toHaveLength(1);
    expect(texts(rows[0])).toEqual(expect.arrayContaining(['Ravi K.', 'Nickname · Ravi']));
    expect(texts(rows[0]).filter(x => x !== 'RK')).toEqual(['Ravi K.', 'Nickname · Ravi']);
    expect(everyText(root)).not.toContain('u-org-secret');
    await press(root, 'people-sheet-close');
    expect(byId(root, 'people-sheet-title')).toHaveLength(0);
  });

  it('the committee chip lists the members with their nicknames; one without a nickname says so', async () => {
    const root = await mount();
    await press(root, 'tournament-committee-chip');
    expect(texts(byId(root, 'people-sheet-title')[0])).toEqual(['Committee members · 3']);
    // The initials of the avatar come first in each row; the lines under the name are what matters here.
    const rows = byId(root, 'people-sheet-row').map(row => texts(row).slice(1));
    expect(rows).toEqual([
      ['Alicia Lim', 'Nickname · Ally'],
      ['Joyce Lee', 'Nickname · JoJo'],
      ['Sam Tan', 'No nickname'],
    ]);
  });

  it('the status strip says what the server facts say, in words and a stepper glyph', async () => {
    const open = await mount();
    expect(texts(byId(open, 'status-pill')[0])).toEqual(['Registration open']);
    expect(byId(open, 'stage-registration-current')).toHaveLength(1);
    expect(byId(open, 'stage-fixtures-upcoming')).toHaveLength(1);

    const closed = await mount({}, stateOf({ registration_phase: 'frozen' }));
    expect(texts(byId(closed, 'status-pill')[0])).toEqual(['Registration closed']);
    expect(texts(byId(closed, 'status-chip')[0])).toEqual(['Fixtures being prepared']);
    expect(byId(closed, 'stage-registration-done')).toHaveLength(1);
    expect(byId(closed, 'stage-fixtures-current')).toHaveLength(1);
  });
});

describe('Register on the banner', () => {
  it('is shown to the organizer too while registration is open, with the spots left, and registers with one correlation id', async () => {
    const root = await mount({ organizer_id: 'user-me', capacity: 32 });
    expect(texts(pressable(root, 'tournament-register-button'))).toEqual(['Register', '14 spots left']);
    await press(root, 'tournament-register-button');
    // Register opens the confirmation sheet (tournament-registration AD-5); Confirm sends the request.
    await press(root, 'registration-confirm');
    const post = mockPost.mock.calls.find(call => call[0] === '/tournaments/t-1/registrations');
    expect(post).toBeDefined();
    expect(post![2].correlationId).toMatch(/^[0-9a-f-]{36}$/);
    const rereads = mockGet.mock.calls.filter(call => call[0] === '/tournaments/t-1' && call[1]?.correlationId === post![2].correlationId);
    expect(rereads.length).toBeGreaterThan(0);
  });

  it('is not shown once registration is closed, and a registered viewer sees "You\'re registered" instead', async () => {
    const closed = await mount({}, stateOf({ registration_phase: 'committee_only' }));
    expect(byId(closed, 'tournament-register-button')).toHaveLength(0);
    expect(byId(closed, 'tournament-registered-badge')).toHaveLength(0);

    const registered = await mount({}, stateOf(), {
      registrations: [{ id: 'mine', user_id: 'user-me', registered_at: '2026-10-20T00:00:00Z', participant_name: 'Me', status: 'registered' }],
    });
    expect(byId(registered, 'tournament-register-button')).toHaveLength(0);
    expect(texts(byId(registered, 'tournament-registered-badge')[0])).toEqual(["You're registered"]);
  });
});

describe('tabs (AD-T5): server object only', () => {
  it('draws the six tabs in order for a player, locked ones with a lock glyph, and no Approvals', async () => {
    const root = await mount();
    expect(tabKeys(root)).toEqual(['overview', 'participants', 'fixtures', 'standings', 'results', 'media']);
    for (const locked of ['fixtures', 'standings', 'results', 'media']) {
      expect(byId(root, `tournament-tab-lock-${locked}`)).toHaveLength(1);
    }
    expect(byId(root, 'tournament-tab-lock-overview')).toHaveLength(0);
    expect(byId(root, 'tournament-tab-lock-participants')).toHaveLength(0);
    expect(pressable(root, 'tournament-tab-fixtures').props.accessibilityLabel).toBe('Fixtures, locked. This opens when the fixtures are published.');
  });

  it('Approvals is drawn last, with its badge, only when the server sent it', async () => {
    const root = await mount({}, stateOf({ tabs: { ...PLAYER_TABS, approvals: { state: 'open', badge: 3 } } }));
    expect(tabKeys(root)).toEqual(['overview', 'participants', 'fixtures', 'standings', 'results', 'media', 'approvals']);
    expect(texts(byId(root, 'tournament-tab-badge-approvals')[0])).toEqual(['3']);
    expect(pressable(root, 'tournament-tab-approvals').props.accessibilityLabel).toBe('Approvals. 3 waiting for your decision');
  });

  it('a tab the server opened is open; one it left out is not drawn', async () => {
    const root = await mount({}, stateOf({ tabs: { overview: { state: 'open' }, participants: { state: 'open' }, fixtures: { state: 'open' } } }));
    expect(tabKeys(root)).toEqual(['overview', 'participants', 'fixtures']);
    expect(byId(root, 'tournament-tab-lock-fixtures')).toHaveLength(0);
  });

  it.each([
    ['fixtures', 'This opens when the fixtures are published.'],
    ['standings', 'This opens when the fixtures are published.'],
    ['results', 'This opens when the tournament is closed out.'],
    ['media', 'This opens when play starts.'],
  ])('a locked %s tab opens a greyed preview with the unlock message and no data', async (key, message) => {
    const root = await mount();
    await press(root, `tournament-tab-${key}`);
    expect(byId(root, 'tournament-locked-preview')).toHaveLength(1);
    expect(texts(byId(root, 'tournament-locked-message')[0])).toEqual([message]);
    expect(texts(byId(root, 'tournament-locked-preview')[0])).toContain('Not available yet');
    expect(byId(root, 'tournament-overview')).toHaveLength(0);
  });

  it('the committee Fixtures unlock code gets its own message', async () => {
    const root = await mount({}, stateOf({ tabs: { ...PLAYER_TABS, fixtures: { state: 'locked', unlocks: 'registration_closes' }, approvals: { state: 'open', badge: 0 } } }));
    await press(root, 'tournament-tab-fixtures');
    expect(texts(byId(root, 'tournament-locked-message')[0])).toEqual(['Fixtures setup opens when registration closes.']);
  });

  it('an open tab other than Overview shows its body, and the way back to Overview works (te-a2)', async () => {
    const root = await mount();
    await press(root, 'tournament-tab-participants');
    expect(byId(root, 'tournament-participants')).toHaveLength(1);
    expect(texts(byId(root, 'tournament-participants')[0])).toContain('Players');
    expect(everyText(root)).not.toContain('Coming to the app soon');
    await press(root, 'tournament-tab-overview');
    expect(byId(root, 'tournament-overview')).toHaveLength(1);
  });
});

describe('Overview per status', () => {
  it('open (TV2MobOpen): status card with the count, spots and soft block; Format and Key dates; Book a court last', async () => {
    const root = await mount({ capacity: 32 });
    const status = byId(root, 'overview-status-open')[0];
    const inCard = texts(status);
    expect(inCard).toContain('Registration is open');
    expect(inCard.join(' ')).toContain('Self-registration closes');
    expect(inCard).toContain('18 of 32');
    expect(inCard).toContain('Organizers can register for their own tournament.');
    expect(texts(byId(root, 'overview-format')[0])).toContain('Punggol Sports Hall');
    expect(texts(byId(root, 'overview-format')[0])).toContain('Individuals');
    expect(byId(root, 'key-date-soft-current')).toHaveLength(1);
    expect(byId(root, 'key-date-fixtures-upcoming')).toHaveLength(1);
    const order = root
      .findAll(n => typeof n.type === 'string' && ['overview-status-open', 'overview-format', 'overview-key-dates', 'overview-court-booking'].includes(String(n.props.testID)))
      .map(n => n.props.testID);
    expect(order).toEqual(['overview-status-open', 'overview-format', 'overview-key-dates', 'overview-court-booking']);
  });

  it('closed (TV2MobClosedOverview): "Registration is closed", players locked in, soft block done and fixtures current', async () => {
    const root = await mount({ capacity: 32, roster_frozen_at: '2026-10-31T10:00:00Z' }, stateOf({ registration_phase: 'frozen' }));
    const inCard = texts(byId(root, 'overview-status-closed')[0]);
    expect(inCard).toContain('Registration is closed');
    expect(inCard.join(' ')).toContain('18 players are locked in. The committee is preparing the fixtures.');
    expect(byId(root, 'key-date-soft-done')).toHaveLength(1);
    // the server's roster_frozen_at (set only once the hard block passed) decides the hard block and the next row
    expect(byId(root, 'key-date-fixtures-current')).toHaveLength(1);
    expect(byId(root, 'overview-roster-frozen')).toHaveLength(1);
  });

  it('completed (TV2MobDoneOverview): champion, runner-up and third place by name; every key date done', async () => {
    const closure = {
      can_close: true,
      outcome: 'completed',
      version: 1,
      winner: { display_name: 'Priya Nair', registration_id: 'r1' },
      runner_up: { display_name: 'Ravi K.', registration_id: 'r2' },
      third_place: { display_name: 'Daniel Soh', registration_id: 'r3' },
    };
    const root = await mount({ lifecycle_status: 'closed', closure_outcome: 'completed' }, stateOf({ registration_phase: 'frozen', fixtures_published: true }), { closure });
    const inCard = texts(byId(root, 'overview-status-done')[0]);
    expect(inCard).toContain('Tournament completed');
    expect(inCard).toContain('Champion');
    expect(inCard).toContain('Priya Nair');
    expect(inCard.join(' ')).toContain('Runner-up Ravi K. · Third Daniel Soh');
    expect(inCard).toContain('Standings final');
    expect(inCard).toContain('Closure report submitted');
    expect(byId(root, 'key-date-days-done')).toHaveLength(1);
    expect(texts(byId(root, 'status-pill')[0])).toEqual(['Completed']);
  });
});

describe('Book a court closes the Overview (AD-T2)', () => {
  it('shows the providers and opens the link in the system browser', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const root = await mount();
    expect(byId(root, 'overview-court-booking')).toHaveLength(1);
    await press(root, 'court-book-p1');
    expect(open).toHaveBeenCalledWith('https://courthub.example/book');
    open.mockRestore();
  });

  it('is not rendered when the list is empty', async () => {
    expect(byId(await mount({}, stateOf(), { providers: [] }), 'overview-court-booking')).toHaveLength(0);
  });

  it('is not part of a locked tab preview', async () => {
    const root = await mount();
    await press(root, 'tournament-tab-fixtures');
    expect(byId(root, 'overview-court-booking')).toHaveLength(0);
  });
});

describe('organizer tools: only what has a working target', () => {
  it('the committee sees Invite and Review requests (Approvals present); a player sees no tools card', async () => {
    const committee = await mount({ my_invite_access: 'full' }, stateOf({ is_committee: true, tabs: { ...PLAYER_TABS, approvals: { state: 'open', badge: 1 } } }));
    expect(byId(committee, 'overview-tools')).toHaveLength(1);
    expect(byId(committee, 'overview-tool-invite').length).toBeGreaterThan(0);
    expect(byId(committee, 'overview-tool-review').length).toBeGreaterThan(0);
    await press(committee, 'overview-tool-review');
    expect(byId(committee, 'tournament-approvals')).toHaveLength(1);

    const player = await mount();
    expect(byId(player, 'overview-tools')).toHaveLength(0);
  });
});
