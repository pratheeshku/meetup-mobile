/**
 * Game view redesign (DES-MEETUP-ADDENDUM-game-view-redesign): organizer section order (GV-7, AD-9),
 * Responses replacing Players only for the organizer (GV-4, AD-3, T7), the venue row (GV-2) and the
 * Invite type row (GV-3, T3) on the real EventDetailScreen. Only the API client and auth are mocked.
 */
import React from 'react';
import { Linking } from 'react-native';

import { apiClient } from '../../api/client';
import { act, pressableLabelled, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { __resetSportDisplayNamesCacheForTests } from '../../utils/labels';
import EventDetailScreen from '../EventDetailScreen';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), patch: jest.fn(), post: jest.fn() } }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-me', nickname: 'Sam' } }) }));

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;

const rawEvent = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'evt-1',
  organizer_id: 'someone-else',
  sport: 'badminton',
  title: 'Sunday Smash Doubles',
  visibility: 'public',
  capacity: 8,
  starts_at: '2999-10-24T11:00:00Z',
  ends_at: '2999-10-24T13:00:00Z',
  allow_waitlist: true,
  status: 'upcoming',
  venue_name: 'Our Tampines Hub',
  venue_address: '1 Tampines Walk',
  going_count: 2,
  user_rsvp_status: null,
  skill_level_requirement: 'all_levels',
  ...overrides,
});
const person = (id: string, name: string, status = 'going') => ({
  id: `p-${id}`,
  user_id: id,
  status,
  user_display_name: name,
  user_nickname: name.toLowerCase(),
  user_photo_url: null,
});
const RESPONSES = {
  accepted: {
    total: 2,
    items: [
      { user_id: 'u-1', display_name: 'Alice', photo_url: null },
      { user_id: 'user-me', display_name: 'Sam', photo_url: null },
    ],
  },
  declined: { total: 1, items: [{ user_id: 'u-9', display_name: 'Ravi', photo_url: null, via: 'invitation' }] },
  pending: { total: 1, items: [{ user_id: 'u-8', display_name: 'Priya', photo_url: null }] },
};

/** What a non-organizer gets: no `declined` key at all (backend response_model_exclude_none). */
const PLAYER_RESPONSES = { accepted: RESPONSES.accepted, pending: RESPONSES.pending };

interface Setup {
  event?: Record<string, unknown>;
  responses?: unknown | 'refused';
  venueCatalogue?: boolean;
}

async function mount({ event = {}, responses = RESPONSES, venueCatalogue = true }: Setup = {}): Promise<Instance> {
  mockGet.mockImplementation((url: string) => {
    if (url === '/config/client') return Promise.resolve({ data: { venue_catalogue_enabled: venueCatalogue } });
    if (url.includes('/participants')) return Promise.resolve({ data: [person('u-1', 'Alice'), person('user-me', 'Sam')] });
    if (url.includes('/responses')) {
      return responses === 'refused'
        ? Promise.reject({ response: { status: 403, data: { detail: 'Forbidden' } } })
        : Promise.resolve({ data: responses });
    }
    if (url.includes('/closure')) return Promise.reject({ response: { status: 404 } });
    return Promise.resolve({ data: rawEvent(event) });
  });
  const props = {
    route: { key: 'k', name: 'EventDetail', params: { eventId: 'evt-1' } },
    navigation: { goBack: jest.fn() },
  } as unknown as React.ComponentProps<typeof EventDetailScreen>;
  return renderAsync(<EventDetailScreen {...props} />);
}

const hostIds = (root: Instance, ids: string[]): string[] =>
  root
    .findAll(n => typeof n.type === 'string' && ids.includes(String(n.props.testID)))
    .map(n => String(n.props.testID));
const byId = (root: Instance, id: string): Instance[] => root.findAll(n => n.props.testID === id && typeof n.type === 'string');
const press = async (root: Instance, id: string): Promise<void> =>
  act(async () => root.find(n => n.props.testID === id && typeof n.props.onPress === 'function').props.onPress());

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset().mockResolvedValue({ data: {} });
  __resetSportDisplayNamesCacheForTests();
});

describe('organizer view (GV-2..GV-7)', () => {
  const ORGANIZER = { organizer_id: 'user-me' };

  it('GV-7/AD-9: Details (venue, invite type) → Responses → Invite → Close notice last', async () => {
    const root = await mount({ event: { ...ORGANIZER, visibility: 'group', group_ids: ['g-1'], group_names: ['Crew'] } });
    expect(
      hostIds(root, ['venue-row', 'invite-type-row', 'organizer-responses-section', 'invite-card', 'closure-opens-notice']),
    ).toEqual(['venue-row', 'invite-type-row', 'organizer-responses-section', 'invite-card', 'closure-opens-notice']);
  });

  it('GV-4/AD-3: Responses replaces Players for the organizer, with "x of y joined" in the header', async () => {
    const root = await mount({ event: ORGANIZER });
    expect(byId(root, 'organizer-responses-section')).toHaveLength(1);
    expect(byId(root, 'player-avatar')).toHaveLength(0);
    expect(texts(root)).toEqual(expect.arrayContaining(['Responses', '2 of 8 joined']));
    const sections = root
      .findAll(n => typeof n.type === 'string' && String(n.props.testID ?? '').startsWith('responses-section-'))
      .map(n => String(n.props.testID).replace('responses-section-', ''));
    expect(sections).toEqual(['accepted', 'declined', 'pending']);
  });

  it('GV-4: the organizer is first in Accepted with the Organizer badge', async () => {
    const root = await mount({ event: ORGANIZER });
    const accepted = byId(root, 'responses-section-accepted')[0];
    const names = texts(accepted).filter(x => ['Alice', 'Sam'].includes(x));
    expect(names).toEqual(['Sam', 'Alice']);
    expect(texts(accepted)).toContain('Organizer');
  });

  it('GV-4: a person row opens the combined pop-up and the server decides the actions (Remove player)', async () => {
    const root = await mount({ event: ORGANIZER });
    const base = mockGet.getMockImplementation() as (url: string) => Promise<unknown>;
    mockGet.mockImplementation((url: string) =>
      url === '/events/evt-1/players/u-1/card'
        ? Promise.resolve({
            data: {
              user_id: 'u-1',
              display_name: 'Alice',
              nickname: 'alice',
              photo_url: null,
              is_self: false,
              relation: 'player',
              allowed_actions: [{ key: 'remove_player', requires_approval: false }],
            },
          })
        : base(url),
    );
    await press(root, 'response-person-u-1');
    expect(byId(root, 'user-menu-details').length).toBeGreaterThan(0);
    expect(texts(root)).not.toContain('View Details');
    expect(byId(root, 'user-menu-action-remove_player').length).toBeGreaterThan(0);
  });

  it('degrades to the Players block when the responses call fails', async () => {
    const root = await mount({ event: ORGANIZER, responses: 'refused' });
    expect(byId(root, 'organizer-responses-section')).toHaveLength(0);
    expect(byId(root, 'player-avatar').length).toBeGreaterThan(0);
  });

  it('GV-5: the Invite card has Invite groups and Invite players entries that open the picker', async () => {
    const root = await mount({ event: ORGANIZER });
    expect(texts(byId(root, 'invite-card')[0])).toEqual(expect.arrayContaining(['Invite', 'Invite groups', 'Invite players']));
    expect(byId(root, 'invite-picker')).toHaveLength(0);
    await press(root, 'invite-player-entry');
    expect(byId(root, 'invite-picker')).toHaveLength(1);
  });

  it('the picker lists people already in the game under "Already in this game"', async () => {
    const root = await mount({ event: ORGANIZER });
    await press(root, 'invite-player-entry');
    expect(texts(root)).toContain('Already in this game');
  });
});

describe('non-organizer view (T7/T8, AD-3 v1.1)', () => {
  it('T7: a non-organizer sees Responses with Accepted and Pending, no Declined (absent, no crash), no Invite card, no old Players list', async () => {
    const root = await mount({ responses: PLAYER_RESPONSES });
    expect(byId(root, 'organizer-responses-section')).toHaveLength(1);
    const sections = root
      .findAll(n => typeof n.type === 'string' && String(n.props.testID ?? '').startsWith('responses-section-'))
      .map(n => String(n.props.testID).replace('responses-section-', ''));
    expect(sections).toEqual(['accepted', 'pending']);
    expect(texts(root)).not.toContain('Declined');
    expect(byId(root, 'invite-card')).toHaveLength(0);
    expect(byId(root, 'player-avatar')).toHaveLength(0);
  });

  it('T8: the Declined group follows the payload, not the viewer: present means shown', async () => {
    const root = await mount({ responses: RESPONSES });
    expect(byId(root, 'responses-section-declined')).toHaveLength(1);
    expect(byId(root, 'invite-card')).toHaveLength(0);
  });

  it('if the responses call fails for a non-organizer the Players block is kept', async () => {
    const root = await mount({ responses: 'refused' });
    expect(byId(root, 'organizer-responses-section')).toHaveLength(0);
    expect(texts(root)).toEqual(expect.arrayContaining(['Players', '2 of 8 joined']));
    expect(byId(root, 'player-avatar')).toHaveLength(2);
  });

  it('keeps the Join / Decline actions below the Players block', async () => {
    const root = await mount({ responses: PLAYER_RESPONSES });
    expect(pressableLabelled(root, 'Join')).toBeDefined();
    expect(pressableLabelled(root, 'Decline')).toBeDefined();
  });
});

describe('Invite type row (GV-3, T3)', () => {
  it('a public game: "Public", not tappable', async () => {
    const root = await mount({ responses: 'refused' });
    expect(texts(root)).toEqual(expect.arrayContaining(['Invite type', 'Public']));
    expect(root.findAll(n => n.props.testID === 'invite-type-row' && typeof n.props.onPress === 'function')).toHaveLength(0);
  });

  it('a group game: "Groups (n)" for a non-organizer; the sheet lists the groups only', async () => {
    const root = await mount({
      event: { visibility: 'group', group_ids: ['g-1', 'g-2'], group_names: ['Crew', 'League'] },
      responses: 'refused',
    });
    expect(texts(root)).toContain('Groups (2)');
    await press(root, 'invite-type-row');
    expect(byId(root, 'invited-groups')).toHaveLength(1);
    expect(byId(root, 'invited-people')).toHaveLength(0);
    expect(texts(byId(root, 'invited-sheet')[0])).toEqual(expect.arrayContaining(['Crew', 'League']));
  });

  it('the organizer\'s sheet adds People by response from the responses endpoint', async () => {
    const root = await mount({
      event: { organizer_id: 'user-me', visibility: 'group', group_ids: ['g-1'], group_names: ['Crew'] },
    });
    await press(root, 'invite-type-row');
    expect(byId(root, 'invited-people')).toHaveLength(1);
    expect(texts(byId(root, 'invited-sheet')[0])).toEqual(expect.arrayContaining(['Alice', 'Ravi', 'Priya']));
  });
});

describe('venue row (GV-2, T6)', () => {
  it('opens the venue sheet; Open in Google Maps builds the AD-5 fallback link from the payload', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    try {
      const root = await mount({ responses: 'refused' });
      expect(texts(root)).toContain('Our Tampines Hub');
      expect(byId(root, 'venue-sheet')).toHaveLength(0);
      await press(root, 'venue-row');
      expect(byId(root, 'venue-sheet')).toHaveLength(1);
      await act(async () => pressableLabelled(root, 'Open in Google Maps').props.onPress());
      expect(open).toHaveBeenCalledWith(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Our Tampines Hub 1 Tampines Walk')}`,
      );
    } finally {
      open.mockRestore();
    }
  });

  it('without the venue catalogue flag the row stays the plain, non-tappable text it was', async () => {
    const root = await mount({ responses: 'refused', venueCatalogue: false });
    expect(byId(root, 'venue-row')).toHaveLength(0);
    expect(texts(root).some(x => x.includes('Our Tampines Hub'))).toBe(true);
  });
});
