/**
 * Group detail member list (WhatsApp-style): ordering, display name over nickname,
 * photo or initials, and the user menu (design UM-T10): a tap on the picture opens View Details,
 * a long-press opens the menu whose actions come only from the server's card.
 */
import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getGroup, getGroupMemberCard, updateMemberRole, removeMember, transferGroupOwnership } from '../../api/groups';
import UserMenuHost from '../../components/user/UserMenuHost';
import { closeUserMenu } from '../../hooks/useUserMenu';
import type { UserCardOut } from '../../types/userCard';
import { searchUsers } from '../../api/users';
import { act, pressableLabelled, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import type { GroupDetail, GroupMember } from '../../types/group';
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
      <UserMenuHost />
    </SafeAreaProvider>,
  );

/** The member rows' person areas (picture + names) in screen order. */
const memberRows = (root: Instance): Instance[] =>
  root.findAll(n => typeof n.props.onLongPress === 'function' && typeof n.props.accessibilityLabel === 'string');
const rowFor = (root: Instance, displayName: string): Instance =>
  memberRows(root).filter(n => texts(n).includes(displayName))[0];
/** The whole row (person area plus role chip). */
const wholeRow = (root: Instance, userId: string): Instance =>
  root.find(n => n.props.testID === `member-row-${userId}`);
const longPress = async (root: Instance, displayName: string): Promise<void> => {
  await act(async () => rowFor(root, displayName).props.onLongPress());
};
const tap = async (root: Instance, displayName: string): Promise<void> => {
  await act(async () => rowFor(root, displayName).props.onPress());
};
const hasAction = (root: Instance, label: string): boolean =>
  root.findAll(n => n.props.accessibilityRole === 'button' && n.props.accessibilityLabel === label).length > 0;
const ACTIONS = ['Make admin', 'Remove admin', 'Make owner', 'Remove from group'];
const shownActions = (root: Instance): string[] => ACTIONS.filter(label => hasAction(root, label));

const card = (userId: string, keys: string[], extra: Partial<UserCardOut> = {}): UserCardOut => ({
  user_id: userId,
  display_name: 'x',
  nickname: null,
  photo_url: null,
  is_self: false,
  relation: 'member',
  allowed_actions: keys.map(key => ({ key, requires_approval: false })),
  ...extra,
});

beforeEach(() => {
  act(() => closeUserMenu()); // the menu request store is module-level
  mockUserId = 'user-me';
  (getGroup as jest.Mock).mockReset().mockResolvedValue(GROUP);
  (updateMemberRole as jest.Mock).mockReset().mockResolvedValue(undefined);
  (removeMember as jest.Mock).mockReset().mockResolvedValue(undefined);
  (transferGroupOwnership as jest.Mock).mockReset().mockResolvedValue(undefined);
  (getGroupMemberCard as jest.Mock).mockReset().mockRejectedValue(new Error('no card'));
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
    expect(texts(wholeRow(root, 'user-me'))).toContain('Owner');
    expect(texts(wholeRow(root, 'u-dan'))).toContain('Admin');
    expect(texts(wholeRow(root, 'u-aisha'))).not.toContain('Admin');
    expect(texts(wholeRow(root, 'u-aisha'))).not.toContain('Owner');
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

describe('user menu', () => {
  it('a tap on a member opens View Details with no card request', async () => {
    const root = await mount();
    await tap(root, 'Aisha Rahman');
    expect(root.findAll(n => n.props.testID === 'user-details' && typeof n.type === 'string')).toHaveLength(1);
    expect(getGroupMemberCard).not.toHaveBeenCalled();
    const all = texts(root);
    const last = all.lastIndexOf('Aisha Rahman');
    expect(all[last + 1]).toBe('aisha_r'); // display name above nickname
  });

  it('a long-press fetches the card for this group and member, then lists View Details first', async () => {
    (getGroupMemberCard as jest.Mock).mockResolvedValue(card('u-aisha', ['make_admin', 'make_owner', 'remove_from_group']));
    const root = await mount();
    await longPress(root, 'Aisha Rahman');
    expect(getGroupMemberCard).toHaveBeenCalledWith('group-1', 'u-aisha', expect.objectContaining({ correlationId: expect.any(String) }));
    expect(shownActions(root)).toEqual(['Make admin', 'Make owner', 'Remove from group']);
    const labels = root
      .findAll(
        n =>
          typeof n.type === 'string' &&
          (n.props.testID === 'user-menu-view-details' || String(n.props.testID ?? '').startsWith('user-menu-action-')),
      )
      .map(n => n.props.accessibilityLabel);
    expect(labels[0]).toBe('View Details');
  });

  it('shows exactly the actions the server sent (admin target: Remove admin)', async () => {
    (getGroupMemberCard as jest.Mock).mockResolvedValue(card('u-dan', ['remove_admin', 'make_owner', 'remove_from_group']));
    const root = await mount();
    await longPress(root, 'Daniel Tan');
    expect(shownActions(root)).toEqual(['Remove admin', 'Make owner', 'Remove from group']);
  });

  it('a regular member gets View Details only when the server sends no actions', async () => {
    mockUserId = 'u-chen';
    (getGroupMemberCard as jest.Mock).mockResolvedValue(card('u-aisha', []));
    const root = await mount();
    await longPress(root, 'Aisha Rahman');
    expect(shownActions(root)).toEqual([]);
    expect(hasAction(root, 'View Details')).toBe(true);
  });

  it('never computes rights on the client: a failed card leaves View Details only, with the message', async () => {
    const root = await mount(); // owner viewer, card request rejects
    await longPress(root, 'Aisha Rahman');
    expect(shownActions(root)).toEqual([]);
    expect(hasAction(root, 'View Details')).toBe(true);
    expect(texts(root)).toContain('Could not load options.');
  });

  it('the viewer\'s own row: View Details only, no card request', async () => {
    const root = await mount();
    await longPress(root, 'Sam Smith');
    expect(getGroupMemberCard).not.toHaveBeenCalled();
    expect(shownActions(root)).toEqual([]);
    expect(hasAction(root, 'View Details')).toBe(true);
  });

  it('Make admin asks for confirmation naming the member by display name, then calls updateMemberRole', async () => {
    (getGroupMemberCard as jest.Mock).mockResolvedValue(card('u-aisha', ['make_admin']));
    const root = await mount();
    await longPress(root, 'Aisha Rahman');
    await act(async () => pressableLabelled(root, 'Make admin').props.onPress());
    expect(texts(root)).toContain('Make Aisha Rahman an admin of this group?');
    expect(updateMemberRole).not.toHaveBeenCalled();
    await act(async () => pressableLabelled(root, 'Yes').props.onPress());
    const cardId = (getGroupMemberCard as jest.Mock).mock.calls[0][2].correlationId;
    expect(updateMemberRole).toHaveBeenCalledWith('group-1', 'u-aisha', 'admin', { correlationId: cardId });
    expect(getGroup).toHaveBeenCalledTimes(2); // initial load + refresh after the action
  });

  it('Remove from group and Make owner confirm, then use removeMember / transferGroupOwnership', async () => {
    (getGroupMemberCard as jest.Mock).mockResolvedValue(card('u-aisha', ['make_owner', 'remove_from_group']));
    const root = await mount();
    await longPress(root, 'Aisha Rahman');
    await act(async () => pressableLabelled(root, 'Remove from group').props.onPress());
    expect(texts(root)).toContain('Remove Aisha Rahman from this group?');
    await act(async () => pressableLabelled(root, 'Yes').props.onPress());
    expect(removeMember).toHaveBeenCalledWith('group-1', 'u-aisha', expect.anything());

    await longPress(root, 'Aisha Rahman');
    await act(async () => pressableLabelled(root, 'Make owner').props.onPress());
    await act(async () => pressableLabelled(root, 'Yes').props.onPress());
    expect(transferGroupOwnership).toHaveBeenCalledWith('group-1', 'u-aisha', expect.anything());
  });

  it('a refused action shows the server message and refreshes the group', async () => {
    (getGroupMemberCard as jest.Mock).mockResolvedValue(card('u-aisha', ['make_admin']));
    (updateMemberRole as jest.Mock).mockRejectedValue({ response: { status: 403, data: { detail: 'Only an owner can do that' } } });
    const root = await mount();
    await longPress(root, 'Aisha Rahman');
    await act(async () => pressableLabelled(root, 'Make admin').props.onPress());
    await act(async () => pressableLabelled(root, 'Yes').props.onPress());
    expect(texts(root)).toContain('Only an owner can do that');
    expect(getGroup).toHaveBeenCalledTimes(2);
  });
});
