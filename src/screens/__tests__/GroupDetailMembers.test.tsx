/**
 * Group detail member list (WhatsApp-style): ordering, display name over nickname,
 * photo or initials, and the user menu (tap = View Details, long-press = menu whose actions come
 * from the server's card endpoint; DES-MEETUP-ADDENDUM-user-details-menu.md).
 */
import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getGroup, getGroupMemberCard, removeMember, updateMemberRole } from '../../api/groups';
import { searchUsers } from '../../api/users';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import type { GroupDetail, GroupMember } from '../../types/group';
import type { UserCardOut } from '../../types/userMenu';
import GroupDetailScreen, { sortMembers } from '../GroupDetailScreen';

type Props = React.ComponentProps<typeof GroupDetailScreen>;

jest.mock('../../api/groups', () => ({
  createGroupInvitation: jest.fn(),
  getGroup: jest.fn(),
  getGroupMemberCard: jest.fn(),
  inviteMember: jest.fn(),
  removeMember: jest.fn(),
  transferGroupOwnership: jest.fn(),
  updateMemberRole: jest.fn(),
}));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn() }));

let mockUserId = 'user-me';
jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: mockUserId, nickname: 'sam99', display_name: 'Sam' } }),
}));

const METRICS = { frame: { x: 0, y: 0, width: 360, height: 640 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

const member = (id: string, display: string, role: GroupMember['role'], nickname = id, photo: string | null = null): GroupMember => ({
  user_id: id,
  nickname,
  display_name: display,
  photo_url: photo,
  role,
  joined_at: '2026-01-01T00:00:00Z',
});

const MEMBERS: GroupMember[] = [
  member('u-ben', 'ben lim', 'member', 'benl'),
  member('u-zoe', 'Zoe Tan', 'admin', 'zoe'),
  member('u-aisha', 'Aisha Rahman', 'member', 'aisha_r', 'https://cdn.example.com/aisha.jpg'),
  member('user-me', 'Sam Smith', 'owner', 'samnick'),
  member('u-dan', 'Daniel Tan', 'admin', 'dtan'),
  member('u-chen', 'Chen Wei', 'member', 'chenwei'),
  member('u-bob', 'bob', 'member', 'bob'),
];

const GROUP: GroupDetail = {
  id: 'group-1',
  name: 'Sunday League',
  description: 'A friendly group',
  owner_id: 'user-me',
  member_count: MEMBERS.length,
  created_at: '2026-01-01T00:00:00Z',
  current_user_role: 'owner',
  members: MEMBERS,
};

const mount = (): Promise<Instance> =>
  renderAsync(
    <SafeAreaProvider initialMetrics={METRICS}>
      <GroupDetailScreen
        {...({
          route: { key: 'k', name: 'GroupDetail', params: { groupId: 'group-1' } },
          navigation: { goBack: jest.fn(), navigate: jest.fn() },
        } as unknown as Props)}
      />
    </SafeAreaProvider>,
  );

/** Long-pressable person targets (avatar + names) in screen order. */
const memberRows = (root: Instance): Instance[] =>
  root.findAll(n => typeof n.props.onLongPress === 'function' && typeof n.props.accessibilityLabel === 'string');
/** The whole row (person target and role chip). */
const rowFor = (root: Instance, displayName: string): Instance =>
  root.findAll(
    n =>
      typeof n.type === 'string' &&
      String(n.props.testID ?? '').startsWith('member-row-') &&
      texts(n).includes(displayName),
  )[0];
const personFor = (root: Instance, displayName: string): Instance =>
  memberRows(root).filter(n => texts(n).includes(displayName))[0];
const longPress = async (root: Instance, displayName: string): Promise<void> => {
  await act(async () => personFor(root, displayName).props.onLongPress());
};
const tap = async (root: Instance, displayName: string): Promise<void> => {
  await act(async () => personFor(root, displayName).props.onPress());
};
const byTestId = (root: Instance, id: string): Instance[] => root.findAll(n => n.props.testID === id);
const shownActions = (root: Instance): string[] =>
  root
    .findAll(n => String(n.props.testID ?? '').startsWith('user-menu-action-') && typeof n.props.onPress === 'function')
    .map(n => String(n.props.accessibilityLabel));
const card = (id: string, name: string, relation: string, keys: string[]): UserCardOut => ({
  user_id: id,
  display_name: name,
  nickname: id,
  photo_url: null,
  is_self: false,
  relation,
  allowed_actions: keys.map(key => ({ key, requires_approval: false })),
});

beforeEach(() => {
  mockUserId = 'user-me';
  (getGroup as jest.Mock).mockReset().mockResolvedValue(GROUP);
  (updateMemberRole as jest.Mock).mockReset().mockResolvedValue(undefined);
  (removeMember as jest.Mock).mockReset().mockResolvedValue(undefined);
  (getGroupMemberCard as jest.Mock).mockReset().mockResolvedValue(card('u-aisha', 'Aisha Rahman', 'member', []));
  (searchUsers as jest.Mock).mockReset().mockResolvedValue([]);
});

describe('member order', () => {
  it('sortMembers: owner, then admins A-Z, then members A-Z, case-insensitive', () => {
    expect(sortMembers(MEMBERS).map(m => m.display_name)).toEqual([
      'Sam Smith',
      'Daniel Tan',
      'Zoe Tan',
      'Aisha Rahman',
      'ben lim',
      'bob',
      'Chen Wei',
    ]);
  });

  it('is stable for equal names (user id tiebreak) and does not mutate the input', () => {
    const twins = [member('b', 'Sam', 'member'), member('a', 'sam', 'member')];
    expect(sortMembers(twins).map(m => m.user_id)).toEqual(['a', 'b']);
    expect(twins.map(m => m.user_id)).toEqual(['b', 'a']);
  });

  it('renders the rows in that order', async () => {
    const root = await mount();
    const order = memberRows(root).map(row => String(row.props.accessibilityLabel).split(', ')[0]);
    expect(order).toEqual(['Sam Smith', 'Daniel Tan', 'Zoe Tan', 'Aisha Rahman', 'ben lim', 'bob', 'Chen Wei']);
  });

  it('shows an Owner chip and Admin chips only on those rows', async () => {
    const root = await mount();
    expect(texts(rowFor(root, 'Sam Smith'))).toContain('Owner');
    expect(texts(rowFor(root, 'Daniel Tan'))).toContain('Admin');
    expect(texts(rowFor(root, 'Aisha Rahman'))).not.toContain('Admin');
    expect(texts(rowFor(root, 'Aisha Rahman'))).not.toContain('Owner');
  });
});

describe('member row', () => {
  it('shows the display name first and the nickname underneath, smaller and secondary', async () => {
    const root = await mount();
    const row = rowFor(root, 'Aisha Rahman');
    const t = texts(row);
    expect(t.indexOf('Aisha Rahman')).toBeLessThan(t.indexOf('aisha_r'));
    const nameNode = row.find(n => (n.type as unknown) === 'Text' && n.props.children === 'Aisha Rahman');
    const nickNode = row.find(n => (n.type as unknown) === 'Text' && n.props.children === 'aisha_r');
    const name = StyleSheet.flatten(nameNode.props.style);
    const nick = StyleSheet.flatten(nickNode.props.style);
    expect(nick.fontSize as number).toBeLessThan(name.fontSize as number);
    expect(nick.color).not.toBe(name.color);
  });

  it('does not repeat the nickname when it equals the display name', async () => {
    const root = await mount();
    expect(texts(rowFor(root, 'bob')).filter(x => x === 'bob')).toHaveLength(1);
  });

  it('shows the photo when there is one, otherwise two initials', async () => {
    const root = await mount();
    const images = rowFor(root, 'Aisha Rahman').findAllByType(Image);
    expect(images).toHaveLength(1);
    expect(images[0].props.source).toEqual({ uri: 'https://cdn.example.com/aisha.jpg' });
    const plain = rowFor(root, 'Sam Smith');
    expect(plain.findAllByType(Image)).toHaveLength(0);
    expect(texts(plain)).toContain('SS');
  });
});

describe('user menu on member rows', () => {
  it('long-press: View Details first, then exactly the actions the server returned (owner on a member)', async () => {
    (getGroupMemberCard as jest.Mock).mockResolvedValue(
      card('u-aisha', 'Aisha Rahman', 'member', ['make_admin', 'make_owner', 'remove_from_group']),
    );
    const root = await mount();
    await longPress(root, 'Aisha Rahman');
    expect(getGroupMemberCard).toHaveBeenCalledWith('group-1', 'u-aisha', expect.objectContaining({ correlationId: expect.any(String) }));
    expect(byTestId(root, 'user-menu-view-details').length).toBeGreaterThan(0);
    expect(shownActions(root)).toEqual(['Make admin', 'Make owner', 'Remove from group']);
  });

  it('owner on an admin gets Remove admin (not the old "Demote")', async () => {
    (getGroupMemberCard as jest.Mock).mockResolvedValue(
      card('u-dan', 'Daniel Tan', 'admin', ['remove_admin', 'make_owner', 'remove_from_group']),
    );
    const root = await mount();
    await longPress(root, 'Daniel Tan');
    expect(shownActions(root)).toEqual(['Remove admin', 'Make owner', 'Remove from group']);
  });

  it('rights are the server\'s: nothing is computed on the client, whatever role the viewer seems to have', async () => {
    mockUserId = 'u-chen'; // a plain member in the list
    (getGroupMemberCard as jest.Mock).mockResolvedValue(card('u-aisha', 'Aisha Rahman', 'member', ['remove_from_group']));
    const root = await mount();
    await longPress(root, 'Aisha Rahman');
    expect(shownActions(root)).toEqual(['Remove from group']);
  });

  it('a plain member gets View Details only when the server returns no actions', async () => {
    mockUserId = 'u-chen';
    const root = await mount();
    await longPress(root, 'Aisha Rahman');
    expect(shownActions(root)).toEqual([]);
    expect(byTestId(root, 'user-menu-view-details').length).toBeGreaterThan(0);
  });

  it('own row: View Details only and no card request', async () => {
    const root = await mount();
    await longPress(root, 'Sam Smith');
    expect(getGroupMemberCard).not.toHaveBeenCalled();
    expect(shownActions(root)).toEqual([]);
  });

  it('a card failure leaves View Details only', async () => {
    (getGroupMemberCard as jest.Mock).mockRejectedValue(new Error('boom'));
    const root = await mount();
    await longPress(root, 'Aisha Rahman');
    expect(shownActions(root)).toEqual([]);
    expect(byTestId(root, 'user-menu-view-details').length).toBeGreaterThan(0);
  });

  it('a tap on the avatar opens View Details (no card request)', async () => {
    const root = await mount();
    await tap(root, 'Aisha Rahman');
    expect(byTestId(root, 'user-menu-details')).toHaveLength(1);
    expect(texts(root)).toEqual(expect.arrayContaining(['Details', 'Aisha Rahman', 'aisha_r']));
    expect(getGroupMemberCard).not.toHaveBeenCalled();
  });

  it('Remove from group asks first, names the member by display name, then removes and refetches the group', async () => {
    (getGroupMemberCard as jest.Mock).mockResolvedValue(card('u-aisha', 'Aisha Rahman', 'member', ['remove_from_group']));
    const root = await mount();
    await longPress(root, 'Aisha Rahman');
    await act(async () => byTestId(root, 'user-menu-action-remove_from_group')[0].props.onPress());
    expect(texts(root)).toContain('Remove Aisha Rahman from this group?');
    expect(removeMember).not.toHaveBeenCalled();
    const loads = (getGroup as jest.Mock).mock.calls.length;
    await act(async () => byTestId(root, 'user-menu-confirm-yes')[0].props.onPress());
    expect(removeMember).toHaveBeenCalledWith('group-1', 'u-aisha', expect.anything());
    expect((getGroup as jest.Mock).mock.calls.length).toBeGreaterThan(loads); // host refreshed in place
  });

  it('Make admin changes the role through updateMemberRole', async () => {
    (getGroupMemberCard as jest.Mock).mockResolvedValue(card('u-aisha', 'Aisha Rahman', 'member', ['make_admin']));
    const root = await mount();
    await longPress(root, 'Aisha Rahman');
    await act(async () => byTestId(root, 'user-menu-action-make_admin')[0].props.onPress());
    expect(updateMemberRole).toHaveBeenCalledWith('group-1', 'u-aisha', 'admin', expect.anything());
  });
});
