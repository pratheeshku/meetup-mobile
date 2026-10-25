/**
 * Tournament list rows (DES-MEETUP-ADDENDUM-tournament-registration AD-7, TR-08; brief M8): a Venue line with the full address that opens the
 * existing venue pop-up, and an Invite type line (Public, the group name with "+n", or Invite only) that opens the existing Invited sheet.
 * Everything comes from the list payload: no request is made by a row.
 */
import React from 'react';

import { apiClient } from '../../../api/client';
import { act, render, texts } from '../../../test-utils/render';
import type { Instance } from '../../../test-utils/render';
import type { Tournament } from '../../../types/tournament';
import { UnifiedTournamentCard } from '../UnifiedCard';

jest.mock('../../../api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn(), delete: jest.fn() } }));
jest.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
jest.mock('../../../api/events', () => ({ getEventPlayerCard: jest.fn(), removeEventPlayer: jest.fn() }));
jest.mock('../../../api/groups', () => ({
  getGroupMemberCard: jest.fn(),
  removeMember: jest.fn(),
  transferGroupOwnership: jest.fn(),
  updateMemberRole: jest.fn(),
}));

const BASE: Tournament = {
  id: 't-1',
  name: 'Summer Smash',
  description: '',
  sport: 'badminton',
  organiser_id: 'o-1',
  organiser_nickname: '',
  format: 'knockout',
  status: 'upcoming',
  registration_open: true,
  participant_count: 4,
  max_participants: 8,
  starts_at: '2999-10-01T10:00:00Z',
  created_at: '2026-09-01T10:00:00Z',
  current_user_registration_status: 'none',
  is_organiser: false,
  venue_name: 'Bishan Hall',
  venue_address: '51 Bishan St 13, Singapore 579799',
  venue_lat: 1.35,
  venue_lng: 103.85,
};

const SMASHERS = { id: 'g-1', name: 'Smashers' };
const NINJAS = { id: 'g-2', name: 'Net Ninjas' };

const card = (over: Partial<Tournament>): Instance => render(<UnifiedTournamentCard tournament={{ ...BASE, ...over }} onPress={jest.fn()} />);
const byId = (root: Instance, id: string): Instance[] => root.findAll(n => n.props.testID === id && typeof n.type === 'string');
const pressById = async (root: Instance, id: string): Promise<void> => {
  const node = root.findAll(n => n.props.testID === id && typeof n.props.onPress === 'function')[0];
  if (!node) throw new Error(`nothing to press: ${id}`);
  await act(async () => node.props.onPress());
};

beforeEach(() => {
  (apiClient.get as jest.Mock).mockReset();
});

describe('Venue line', () => {
  it('shows the venue name and the full address on the row', () => {
    const root = card({});
    const venue = byId(root, 'venue-row')[0];
    expect(texts(venue)).toEqual(['Bishan Hall', '51 Bishan St 13, Singapore 579799']);
  });

  it('with no address it is the name alone; with no venue at all it falls back to Location TBC', () => {
    expect(texts(byId(card({ venue_address: null }), 'venue-row')[0])).toEqual(['Bishan Hall']);
    expect(texts(byId(card({ venue_name: null, venue_address: null }), 'venue-row')[0])).toEqual(['Location TBC']);
  });

  it('tapping opens the existing venue pop-up with Open in Google Maps and Copy address', async () => {
    const root = card({});
    expect(byId(root, 'venue-sheet')).toHaveLength(0);
    await pressById(root, 'venue-row');
    expect(byId(root, 'venue-sheet')).toHaveLength(1);
    expect(byId(root, 'venue-open-maps')).toHaveLength(1);
    expect(byId(root, 'venue-copy-address')).toHaveLength(1);
  });
});

describe('Invite type line', () => {
  it('a public tournament reads Public and is not tappable', () => {
    const root = card({ visibility: 'public' });
    const line = byId(root, 'list-invite-type')[0];
    expect(texts(line)).toEqual(['Public']);
    expect(root.findAll(n => n.props.testID === 'list-invite-type' && typeof n.props.onPress === 'function')).toHaveLength(0);
  });

  it('an invite-only tournament reads Invite only', () => {
    expect(texts(byId(card({ visibility: 'invite' }), 'list-invite-type')[0])).toEqual(['Invite only']);
  });

  it('one group shows its name; several show the first name and "+n"', () => {
    expect(texts(byId(card({ visibility: 'group', audience_groups: [SMASHERS] }), 'list-invite-type')[0])).toEqual(['Smashers']);
    const many = card({ visibility: 'group', audience_groups: [SMASHERS, NINJAS, { id: 'g-3', name: 'Third' }] });
    expect(texts(byId(many, 'list-invite-type')[0])).toEqual(['Smashers +2']);
  });

  it('a group line opens the existing group pop-up (the Invited sheet) listing every group, without any request', async () => {
    const root = card({ visibility: 'group', audience_groups: [SMASHERS, NINJAS] });
    await pressById(root, 'list-invite-type');
    const all = texts(root);
    expect(all).toEqual(expect.arrayContaining(['Smashers', 'Net Ninjas']));
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('an unknown visibility (an older server) shows no invite line', () => {
    expect(byId(card({ visibility: undefined }), 'list-invite-type')).toHaveLength(0);
  });
});
