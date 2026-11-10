/**
 * Phone list cards of tournaments and games (DES-MEETUP-ADDENDUM-nov10-enhancements AD-7, NE-06; boards docs/design/list-cards/):
 * render order, and every tap target calls its own handler (venue row, invite-type row, avatars, card body and button, Join).
 * Layout cannot be measured under Jest; the device check is Task 4.2.
 */
import React from 'react';

import { act, render, texts } from '../../../test-utils/render';
import type { Instance } from '../../../test-utils/render';
import { makeEvent } from '../../../test-utils/makeEvent';
import type { Tournament } from '../../../types/tournament';
import { UnifiedGameCard, UnifiedTournamentCard } from '../UnifiedCard';

jest.mock('../../../api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn(), delete: jest.fn() } }));
jest.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
jest.mock('../../../api/events', () => ({ getEventPlayerCard: jest.fn(), removeEventPlayer: jest.fn() }));
jest.mock('../../../api/groups', () => ({
  getGroupMemberCard: jest.fn(),
  removeMember: jest.fn(),
  transferGroupOwnership: jest.fn(),
  updateMemberRole: jest.fn(),
}));

const TOURNAMENT: Tournament = {
  id: 't-1',
  name: 'Sunday Smash Open',
  description: '',
  sport: 'badminton',
  organiser_id: 'o-1',
  organiser_nickname: '',
  format: 'knockout',
  status: 'upcoming',
  registration_open: true,
  participant_count: 16,
  max_participants: 16,
  starts_at: '2999-11-22T01:00:00Z',
  created_at: '2026-09-01T10:00:00Z',
  current_user_registration_status: 'registered',
  is_organiser: false,
  is_full: true,
  visibility: 'group',
  audience_groups: [
    { id: 'g-1', name: 'Sunday Smashers' },
    { id: 'g-2', name: 'Net Ninjas' },
  ],
  venue_name: 'Kallang Badminton Hall',
  venue_address: '1 Stadium Place, Singapore 397628',
  venue_lat: 1.3,
  venue_lng: 103.8,
};

const PLAYERS = [
  { display_name: 'Aisha K', photo_url: null, user_id: 'u-1' },
  { display_name: 'Priya R', photo_url: null, user_id: 'u-2' },
];

const byId = (root: Instance, id: string): Instance[] => root.findAll(n => n.props.testID === id && typeof n.type === 'string');
const pressable = (root: Instance, id: string): Instance => {
  const node = root.findAll(n => n.props.testID === id && typeof n.props.onPress === 'function')[0];
  if (!node) throw new Error(`nothing to press: ${id}`);
  return node;
};
const press = async (root: Instance, id: string): Promise<void> => {
  const node = pressable(root, id);
  await act(async () => node.props.onPress());
};
const inside = (outer: Instance, inner: Instance): boolean => outer.findAll(n => n === inner).length > 0;

describe('tournament card (Main board)', () => {
  const mount = (over: Partial<Tournament> = {}, onPress = jest.fn()): { root: Instance; onPress: jest.Mock } => ({
    root: render(<UnifiedTournamentCard tournament={{ ...TOURNAMENT, ...over }} onPress={onPress} />),
    onPress,
  });

  it('renders header, venue, time, invite type, sport and format, status line, count and button, top to bottom', () => {
    const { root } = mount();
    const all = texts(root);
    const order = [
      'Sunday Smash Open',
      'Kallang Badminton Hall',
      '1 Stadium Place, Singapore 397628',
      'Sunday Smashers +1',
      'badminton · knockout',
      'Status: upcoming',
      '16 registered',
      'View tournament',
    ].map(text => all.findIndex(entry => entry.includes(text)));
    expect(order.every(index => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // The date block and the existing chips are kept; none is invented.
    expect(byId(root, 'date-block')).toHaveLength(1);
    expect(all).toEqual(expect.arrayContaining(['Registered', 'Full']));
  });

  it('keeps the status_line text from the labels, not the board placeholder', () => {
    expect(texts(mount().root)).not.toContain('Status: Registration open');
  });

  it('the card and the View tournament button open the detail', async () => {
    const { root, onPress } = mount();
    const card = pressable(root, 'list-card');
    expect(inside(card, byId(root, 'list-card-button')[0])).toBe(true);
    expect(texts(byId(root, 'list-card-button')[0])).toEqual(['View tournament']);
    await act(async () => card.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('the venue row opens the venue sheet and not the detail', async () => {
    const { root, onPress } = mount();
    expect(byId(root, 'venue-sheet')).toHaveLength(0);
    await press(root, 'venue-row');
    expect(byId(root, 'venue-sheet')).toHaveLength(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('the group invite-type row opens the Invited sheet and not the detail', async () => {
    const { root, onPress } = mount();
    await press(root, 'list-invite-type');
    expect(texts(root)).toEqual(expect.arrayContaining(['Sunday Smashers', 'Net Ninjas']));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('a public tournament reads Public and has no invite tap target', () => {
    const { root } = mount({ visibility: 'public', audience_groups: [] });
    expect(texts(byId(root, 'list-invite-type')[0])).toEqual(['Public']);
    expect(root.findAll(n => n.props.testID === 'list-invite-type' && typeof n.props.onPress === 'function')).toHaveLength(0);
  });

  it('hides the count, not the button, when the backend sent no count', () => {
    const { root } = mount({ participant_count: null });
    expect(byId(root, 'list-card-count')).toHaveLength(0);
    expect(texts(root)).toContain('View tournament');
  });
});

describe('game card (Game board)', () => {
  const mount = (
    over: Parameters<typeof makeEvent>[0] = {},
    extra: { onJoin?: () => void } = {},
  ): { root: Instance; onPress: jest.Mock } => {
    const onPress = jest.fn();
    const event = makeEvent({
      title: 'Sunday Smash Doubles',
      venue_name: 'Our Tampines Hub',
      capacity: 8,
      participant_count: 5,
      players_preview: PLAYERS,
      ...over,
    });
    return { root: render(<UnifiedGameCard event={event} onPress={onPress} badge="Open" {...extra} />), onPress };
  };

  it('renders the chips, title, time with sport, venue name, avatars, count and button', () => {
    const { root } = mount();
    const all = texts(root);
    expect(all).toEqual(expect.arrayContaining(['Open', 'Sunday Smash Doubles', 'Our Tampines Hub', 'View game']));
    expect(texts(byId(root, 'game-card-time')[0])[0]).toContain('badminton');
    expect(byId(root, 'card-avatar')).toHaveLength(2);
    expect(all.some(entry => entry === '+3')).toBe(true);
    expect(texts(byId(root, 'list-card-count')[0])[0]).toMatch(/5/);
  });

  it('the venue stays plain text: no venue sheet, no tap target of its own', () => {
    const { root } = mount();
    expect(byId(root, 'venue-row')).toHaveLength(0);
    const venue = byId(root, 'game-card-venue')[0];
    expect(venue.findAll(n => typeof n.props.onPress === 'function')).toHaveLength(0);
  });

  it('the card and the View game button open the detail', async () => {
    const { root, onPress } = mount();
    const card = pressable(root, 'list-card');
    expect(inside(card, byId(root, 'list-card-button')[0])).toBe(true);
    await act(async () => card.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('an avatar opens the user menu and not the detail', async () => {
    const { root, onPress } = mount();
    const avatars = root.findAll(n => n.props.testID === 'card-avatar' && typeof n.props.onPress === 'function');
    await act(async () => avatars[1].props.onPress());
    expect(byId(root, 'user-menu-details').length).toBeGreaterThan(0);
    expect(texts(root)).toEqual(expect.arrayContaining(['Priya R']));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('a game with no players shows no avatar row and still has the count and button', () => {
    const { root } = mount({ players_preview: [], participant_count: 0 });
    expect(byId(root, 'card-avatar')).toHaveLength(0);
    expect(byId(root, 'list-card-count')).toHaveLength(1);
    expect(texts(root)).toContain('View game');
  });

  it('Join calls onJoin and not the detail', async () => {
    const onJoin = jest.fn();
    const { root, onPress } = mount({}, { onJoin });
    await press(root, 'card-join-button');
    expect(onJoin).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });
});
