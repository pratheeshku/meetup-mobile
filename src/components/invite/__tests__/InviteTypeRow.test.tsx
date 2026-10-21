/**
 * T3 (game-view-redesign GV-3, AD-2): the Invite type row. Organizer sees the groups and, in the
 * Invited sheet, the people by response; a non-organizer sees the groups only; a public game's row is
 * inert. People rows open the combined user pop-up.
 */
import React from 'react';

import { act, render, texts } from '../../../test-utils/render';
import type { Instance } from '../../../test-utils/render';
import type { ResponsesResponse } from '../../../types/event';
import InviteTypeRow from '../InviteTypeRow';

jest.mock('../../../api/events', () => ({ getEventPlayerCard: jest.fn(), removeEventPlayer: jest.fn() }));
jest.mock('../../../api/groups', () => ({
  getGroupMemberCard: jest.fn(),
  removeMember: jest.fn(),
  transferGroupOwnership: jest.fn(),
  updateMemberRole: jest.fn(),
}));

const GROUPS = [
  { key: 'g-1', name: 'Tampines Badminton Crew' },
  { key: 'g-2', name: 'Office Friday League' },
];
const RESPONSES: ResponsesResponse = {
  accepted: {
    total: 3,
    items: [
      { user_id: 'u-org', display_name: 'Pratheesh' },
      { user_id: 'u-1', display_name: 'Priya M' },
      { user_id: 'u-2', display_name: 'Arun Raj' },
    ],
  },
  declined: { total: 1, items: [{ user_id: 'u-3', display_name: 'Ravi N', via: 'invitation' }] },
  pending: {
    total: 2,
    items: [
      { user_id: 'u-4', display_name: 'Sam J' },
      { user_id: null, display_name: '', email: 'friend@example.com' },
    ],
  },
};

const row = (root: Instance): Instance[] => root.findAll(n => n.props.testID === 'invite-type-row');
const rowPress = (root: Instance): Instance =>
  root.find(n => n.props.testID === 'invite-type-row' && typeof n.props.onPress === 'function');
const open = async (root: Instance): Promise<void> => act(async () => rowPress(root).props.onPress());
const byId = (root: Instance, id: string): Instance[] => root.findAll(n => n.props.testID === id && typeof n.type === 'string');

function mount(over: Partial<React.ComponentProps<typeof InviteTypeRow>> = {}): Instance {
  return render(
    <InviteTypeRow
      isPublic={false}
      groups={GROUPS}
      responses={RESPONSES}
      organizerId="u-org"
      menuContext={{ type: 'game', id: 'e-1' }}
      currentUserId="u-org"
      {...over}
    />,
  );
}

describe('T3 invite type row', () => {
  it('shows the label and the group count', () => {
    const root = mount();
    expect(texts(root)).toEqual(expect.arrayContaining(['Invite type', 'Groups (2)']));
  });

  it('a public game reads "Public" and the row is not tappable', () => {
    const root = mount({ isPublic: true, groups: [], responses: null });
    expect(texts(root)).toEqual(expect.arrayContaining(['Invite type', 'Public']));
    expect(row(root).length).toBeGreaterThan(0);
    expect(root.findAll(n => n.props.testID === 'invite-type-row' && typeof n.props.onPress === 'function')).toHaveLength(0);
  });

  it('organizer: the Invited sheet lists Groups first, then People by response (Accepted, Declined, Pending) without the organizer', async () => {
    const root = mount();
    expect(byId(root, 'invited-sheet')).toHaveLength(0);
    await open(root);
    expect(byId(root, 'invited-sheet')).toHaveLength(1);
    const sheetTexts = texts(byId(root, 'invited-sheet')[0]);
    expect(sheetTexts).toEqual(
      expect.arrayContaining(['Invited', 'Groups (2)', 'Tampines Badminton Crew', 'Office Friday League', 'People · by response']),
    );
    const order = ['invited-groups', 'invited-people'].map(id => byId(root, id)[0]);
    expect(order.every(Boolean)).toBe(true);
    const sections = root
      .findAll(n => typeof n.type === 'string' && String(n.props.testID ?? '').startsWith('invited-section-'))
      .map(n => String(n.props.testID).replace('invited-section-', ''));
    expect(sections).toEqual(['accepted', 'declined', 'pending']);
    expect(sheetTexts).toEqual(expect.arrayContaining(['Priya M', 'Arun Raj', 'Ravi N', 'Sam J', 'friend@example.com', 'email']));
    expect(sheetTexts).not.toContain('Pratheesh');
  });

  it('non-organizer: groups only (no people section, no responses read)', async () => {
    const root = mount({ responses: null, currentUserId: 'u-9' });
    await open(root);
    expect(byId(root, 'invited-groups')).toHaveLength(1);
    expect(byId(root, 'invited-people')).toHaveLength(0);
    expect(texts(byId(root, 'invited-sheet')[0])).not.toContain('People · by response');
  });

  it('a non-public row with nothing to show is left out', () => {
    const root = mount({ groups: [], responses: null });
    expect(row(root)).toHaveLength(0);
  });

  it('a person row opens the combined user pop-up with the response badge', async () => {
    const root = mount();
    await open(root);
    const sam = root.find(n => n.props.testID === 'invited-person-u-4' && typeof n.props.onPress === 'function');
    await act(async () => sam.props.onPress());
    expect(byId(root, 'user-menu-details').length).toBeGreaterThan(0);
    expect(texts(byId(root, 'user-menu-badge')[0])).toEqual(['Pending']);
  });
});

describe('invitation sources (GV-3 tags and Players count)', () => {
  const INVITATIONS = [
    { invitee_user_id: 'u-1', source_group_id: 'g-1' },
    { invitee_user_id: 'u-2', source_group_id: null },
    { invitee_user_id: 'u-4', source_group_id: null, invited_email: 'sam@example.com' },
    { invitee_user_id: 'u-3', source_group_id: 'g-2' },
  ];

  it('shows Groups (n) · Players (m) with m = invitations that have no source group', () => {
    const root = mount({ invitations: INVITATIONS });
    expect(texts(root)).toContain('Groups (2) · Players (2)');
  });

  it('keeps Groups (n) alone without invitations or without individual ones', () => {
    expect(texts(mount({ invitations: null }))).toContain('Groups (2)');
    expect(texts(mount({ invitations: [{ invitee_user_id: 'u-1', source_group_id: 'g-1' }] }))).toContain('Groups (2)');
  });

  it('tags people: via group, individual, email; declined via tags keep precedence', async () => {
    const root = mount({
      invitations: [...INVITATIONS, { invitee_user_id: 'u-3', source_group_id: 'g-2' }],
    });
    await open(root);
    const sheet = texts(byId(root, 'invited-sheet')[0]);
    // u-1 (Priya) via g-1 -> "via Tampines Badminton Crew"; u-2 (Arun) individual; u-4 (Sam) invited by email.
    expect(sheet).toEqual(
      expect.arrayContaining(['via Tampines Badminton Crew', 'individual', 'email']),
    );
    // Ravi (u-3) is declined via invitation: the existing tag wins over "via <group>".
    const ravi = byId(root, 'invited-declined-row-0')[0];
    expect(texts(ravi)).toContain('Invited');
    expect(texts(ravi).some(x => x.startsWith('via '))).toBe(false);
  });

  it('a group that is not in the payload leaves the name blank; no match means no tag', async () => {
    const root = mount({
      invitations: [{ invitee_user_id: 'u-1', source_group_id: 'g-unknown' }],
    });
    await open(root);
    const sheet = texts(byId(root, 'invited-sheet')[0]);
    expect(sheet).toContain('via ');
    expect(sheet).not.toContain('individual');
  });
});

