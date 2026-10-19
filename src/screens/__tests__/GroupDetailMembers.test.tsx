/**
 * Group detail member list (WhatsApp-style): ordering, display name over nickname,
 * photo or initials, and the long-press card with its per-role actions.
 */
import React from 'react';
import { Alert, Image, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getGroup, updateMemberRole } from '../../api/groups';
import { searchUsers } from '../../api/users';
import { act, pressableLabelled, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import type { GroupDetail, GroupMember } from '../../types/group';
import GroupDetailScreen, { sortMembers } from '../GroupDetailScreen';

type Props = React.ComponentProps<typeof GroupDetailScreen>;

jest.mock('../../api/groups', () => ({
  createGroupInvitation: jest.fn(),
  getGroup: jest.fn(),
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

/** Long-pressable member rows in screen order. */
const memberRows = (root: Instance): Instance[] =>
  root.findAll(n => typeof n.props.onLongPress === 'function' && typeof n.props.accessibilityLabel === 'string');
const rowFor = (root: Instance, displayName: string): Instance =>
  memberRows(root).filter(n => texts(n).includes(displayName))[0];
const longPress = (root: Instance, displayName: string): void => {
  act(() => rowFor(root, displayName).props.onLongPress());
};
const hasAction = (root: Instance, label: string): boolean =>
  root.findAll(n => n.props.accessibilityRole === 'button' && n.props.accessibilityLabel === label).length > 0;
const ACTIONS = ['Make admin', 'Demote', 'Make owner', 'Remove from group'];
const shownActions = (root: Instance): string[] => ACTIONS.filter(label => hasAction(root, label));

beforeEach(() => {
  mockUserId = 'user-me';
  (getGroup as jest.Mock).mockReset().mockResolvedValue(GROUP);
  (updateMemberRole as jest.Mock).mockReset().mockResolvedValue(undefined);
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

describe('long-press card', () => {
  it('owner on a member: Make admin, Make owner, Remove from group', async () => {
    const root = await mount();
    longPress(root, 'Aisha Rahman');
    expect(shownActions(root)).toEqual(['Make admin', 'Make owner', 'Remove from group']);
  });

  it('owner on an admin: Demote instead of Make admin', async () => {
    const root = await mount();
    longPress(root, 'Daniel Tan');
    expect(shownActions(root)).toEqual(['Demote', 'Make owner', 'Remove from group']);
  });

  it('the card shows the display name above the nickname', async () => {
    const root = await mount();
    longPress(root, 'Aisha Rahman');
    const all = texts(root);
    // list row text comes first in the tree; the card repeats the pair after it
    const last = all.lastIndexOf('Aisha Rahman');
    expect(all[last + 1]).toBe('aisha_r');
  });

  it('admin on a member: Make admin and Remove only (no Make owner)', async () => {
    mockUserId = 'u-dan';
    const root = await mount();
    longPress(root, 'Aisha Rahman');
    expect(shownActions(root)).toEqual(['Make admin', 'Remove from group']);
  });

  it('regular member sees the details card with no actions', async () => {
    mockUserId = 'u-chen';
    const root = await mount();
    longPress(root, 'Aisha Rahman');
    expect(shownActions(root)).toEqual([]);
    expect(texts(root).filter(x => x === 'Aisha Rahman').length).toBeGreaterThan(1); // row + card
  });

  it('nobody gets actions on their own row, and nobody on the owner row', async () => {
    const root = await mount();
    longPress(root, 'Sam Smith'); // owner on self
    expect(shownActions(root)).toEqual([]);

    mockUserId = 'u-dan';
    const asAdmin = await mount();
    longPress(asAdmin, 'Daniel Tan'); // admin on self
    expect(shownActions(asAdmin)).toEqual([]);
    longPress(asAdmin, 'Sam Smith'); // admin on owner
    expect(shownActions(asAdmin)).toEqual([]);
  });

  it('Remove from group asks for confirmation naming the member by display name', async () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const root = await mount();
    longPress(root, 'Aisha Rahman');
    act(() => pressableLabelled(root, 'Remove from group').props.onPress());
    expect(spy).toHaveBeenCalled();
    expect(String(spy.mock.calls[0][1])).toContain('Aisha Rahman');
    expect(String(spy.mock.calls[0][1])).not.toContain('aisha_r');
    spy.mockRestore();
  });

  it('Make owner asks for the existing transfer confirmation', async () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const root = await mount();
    longPress(root, 'Aisha Rahman');
    act(() => pressableLabelled(root, 'Make owner').props.onPress());
    expect(String(spy.mock.calls[0][0])).toBe('Transfer ownership to Aisha Rahman?');
    spy.mockRestore();
  });

  it('Make admin changes the role through updateMemberRole', async () => {
    const root = await mount();
    longPress(root, 'Aisha Rahman');
    await act(async () => pressableLabelled(root, 'Make admin').props.onPress());
    expect(updateMemberRole).toHaveBeenCalledWith('group-1', 'u-aisha', 'admin', expect.anything());
  });
});
