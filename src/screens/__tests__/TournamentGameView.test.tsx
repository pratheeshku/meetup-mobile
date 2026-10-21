/**
 * Tournament view redesign (DES-MEETUP-ADDENDUM-game-view-redesign GV-2..GV-5, GV-7, AD-1, AD-9, AD-10)
 * on the real TournamentDetailScreen: section order, the Registered split in the Responses block, the
 * removed Fixtures | Registrations toggle, and the degrade for viewers who cannot read the responses.
 */
import React from 'react';

import { apiClient } from '../../api/client';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { rawTournament } from '../../test-utils/tournamentDetailHarness';
import TournamentDetailScreen from '../TournamentDetailScreen';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn().mockResolvedValue({ items: [] }) }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-me' } }) }));

const mockGet = apiClient.get as jest.Mock;

const REGISTRATIONS = [
  { id: 'r-1', user_id: 'u-1', participant_name: 'Alice', registered_at: '2999-09-01T10:00:00Z', status: 'registered' },
  { id: 'r-2', user_id: 'u-9', participant_name: 'Zed', registered_at: '2999-09-02T10:00:00Z', status: 'withdrawn' },
];
const RESPONSES = {
  accepted: {
    total: 2,
    items: [
      { user_id: 'u-1', display_name: 'Alice', photo_url: null },
      { user_id: 'u-2', display_name: 'Bob', photo_url: null },
    ],
  },
  declined: { total: 1, items: [{ user_id: 'u-3', display_name: 'Cara', photo_url: null, via: 'invitation' }] },
  pending: { total: 1, items: [{ user_id: 'u-4', display_name: 'Dan', photo_url: null }] },
};

interface Setup {
  tournament?: Record<string, unknown>;
  responses?: unknown | 'refused';
}

async function mount({ tournament = {}, responses = RESPONSES }: Setup = {}): Promise<Instance> {
  mockGet.mockReset().mockImplementation((url: string) => {
    if (url === '/tournaments/t-1') return Promise.resolve({ data: rawTournament(tournament) });
    if (url === '/tournaments/t-1/registrations') return Promise.resolve({ data: REGISTRATIONS });
    if (url === '/tournaments/t-1/fixtures') {
      return Promise.resolve({
        data: [
          {
            id: 'f-1',
            home_team: 'Arun / Mo',
            away_team: 'Ting / Sam',
            scheduled_at: '2999-11-07T09:00:00Z',
            home_score: null,
            away_score: null,
            status: 'scheduled',
            round: 'Round 1',
          },
        ],
      });
    }
    if (url === '/tournaments/t-1/responses') {
      return responses === 'refused'
        ? Promise.reject({ response: { status: 403, data: { detail: 'Forbidden' } } })
        : Promise.resolve({ data: responses });
    }
    if (url.includes('/closure')) return Promise.reject({ response: { status: 404 } });
    if (url === '/config/client') return Promise.resolve({ data: { venue_catalogue_enabled: true } });
    return Promise.resolve({ data: [] });
  });
  const props = {
    route: { key: 'k', name: 'TournamentDetail', params: { tournamentId: 't-1' } },
    navigation: {},
  } as unknown as React.ComponentProps<typeof TournamentDetailScreen>;
  return renderAsync(<TournamentDetailScreen {...props} />);
}

const byId = (root: Instance, id: string): Instance[] => root.findAll(n => n.props.testID === id && typeof n.type === 'string');
const hostIds = (root: Instance, ids: string[]): string[] =>
  root
    .findAll(n => typeof n.type === 'string' && ids.includes(String(n.props.testID)))
    .map(n => String(n.props.testID));
const press = async (root: Instance, id: string): Promise<void> =>
  act(async () => root.find(n => n.props.testID === id && typeof n.props.onPress === 'function').props.onPress());

describe('organizer view', () => {
  const ORGANIZER = { organizer_id: 'user-me', my_invite_access: 'full', venue_snapshot: { name: 'Our Tampines Hub', source: 'catalogue' } };

  it('GV-7/AD-9: Details (venue, invite type) → Responses → Invite → Fixtures → Close notice last', async () => {
    const root = await mount({ tournament: ORGANIZER });
    expect(
      hostIds(root, [
        'venue-row',
        'invite-type-row',
        'organizer-responses-section',
        'invite-card',
        'tournament-fixtures-section',
        'tournament-closure-opens-notice',
      ]),
    ).toEqual([
      'venue-row',
      'invite-type-row',
      'organizer-responses-section',
      'invite-card',
      'tournament-fixtures-section',
      'tournament-closure-opens-notice',
    ]);
  });

  it('T2/AD-1: Responses reads Registered, Accepted not yet registered, Declined, Pending; header "x of y registered"', async () => {
    const root = await mount({ tournament: ORGANIZER });
    const sections = root
      .findAll(n => typeof n.type === 'string' && String(n.props.testID ?? '').startsWith('responses-section-'))
      .map(n => String(n.props.testID).replace('responses-section-', ''));
    expect(sections).toEqual(['registered', 'accepted_not_registered', 'declined', 'pending']);
    expect(texts(byId(root, 'responses-section-registered')[0])).toContain('Alice');
    expect(texts(byId(root, 'responses-section-accepted_not_registered')[0])).toContain('Bob');
    // One active registration (the withdrawn one does not count) of capacity 8.
    expect(texts(root)).toContain('1 of 8 registered');
  });

  it('AD-10: no Fixtures | Registrations toggle; Fixtures is a titled section', async () => {
    const root = await mount({ tournament: ORGANIZER });
    expect(root.findAll(n => n.props.accessibilityRole === 'tab')).toHaveLength(0);
    const fixtures = byId(root, 'tournament-fixtures-section')[0];
    expect(texts(fixtures)).toEqual(expect.arrayContaining(['Fixtures', 'Round 1']));
    // The registrations list is not repeated next to the Responses block.
    expect(byId(root, 'registration-r-1')).toHaveLength(0);
  });

  it('GV-4: a person row opens the combined pop-up (identity, no card request for tournaments)', async () => {
    const root = await mount({ tournament: ORGANIZER });
    await press(root, 'response-person-u-2');
    expect(byId(root, 'user-menu-details').length).toBeGreaterThan(0);
    expect(mockGet.mock.calls.some(c => String(c[0]).includes('/card'))).toBe(false);
  });

  it('GV-5: the Invite card opens the picker; a tournament has no event-only exclude filter', async () => {
    const root = await mount({ tournament: ORGANIZER });
    expect(byId(root, 'invite-picker')).toHaveLength(0);
    await press(root, 'invite-group-entry');
    expect(byId(root, 'invite-picker')).toHaveLength(1);
  });
});

describe('viewers without the full payload', () => {
  it('a plain participant keeps the registrations list and sees no Responses block (nothing disappears)', async () => {
    const root = await mount({ responses: 'refused' });
    expect(byId(root, 'organizer-responses-section')).toHaveLength(0);
    expect(byId(root, 'registration-r-1')).toHaveLength(1);
    expect(texts(root)).toContain('Registrations');
    expect(root.findAll(n => n.props.accessibilityRole === 'tab')).toHaveLength(0);
  });

  it('a committee member whose responses call is refused degrades to today\'s content and keeps the Invite card', async () => {
    const root = await mount({ tournament: { my_invite_access: 'individuals' }, responses: 'refused' });
    expect(byId(root, 'organizer-responses-section')).toHaveLength(0);
    expect(byId(root, 'registration-r-1')).toHaveLength(1);
    expect(byId(root, 'invite-card')).toHaveLength(1);
  });

  it('a plain viewer whose payload has no `declined` sees Registered, Accepted not yet registered and Pending, no Declined, no Invite card', async () => {
    const playerView = { accepted: RESPONSES.accepted, pending: RESPONSES.pending };
    const root = await mount({ responses: playerView });
    const sections = root
      .findAll(n => typeof n.type === 'string' && String(n.props.testID ?? '').startsWith('responses-section-'))
      .map(n => String(n.props.testID).replace('responses-section-', ''));
    expect(sections).toEqual(['registered', 'accepted_not_registered', 'pending']);
    expect(byId(root, 'invite-card')).toHaveLength(0);
    expect(byId(root, 'registration-r-1')).toHaveLength(0);
  });
});
