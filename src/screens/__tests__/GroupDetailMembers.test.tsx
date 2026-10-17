/** Group detail: members show display name first, nickname underneath, photo or initials. */
import { Alert, Image, StyleSheet } from 'react-native';

import { getGroup } from '../../api/groups';
import { searchUsers } from '../../api/users';
import { act, pressableWithText, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import type { GroupDetail } from '../../types/group';
import GroupDetailScreen from '../GroupDetailScreen';

type Props = React.ComponentProps<typeof GroupDetailScreen>;

jest.mock('../../api/groups', () => ({
  createGroupInvitation: jest.fn(),
  getGroup: jest.fn(),
  inviteMember: jest.fn(),
  removeMember: jest.fn(),
  updateMemberRole: jest.fn(),
}));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn() }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-me', nickname: 'sam99', display_name: 'Sam' } }) }));

const GROUP: GroupDetail = {
  id: 'group-1',
  name: 'Sunday League',
  description: 'A friendly group',
  owner_id: 'user-me',
  owner_nickname: 'samnick',
  owner_display_name: 'Sam Smith',
  member_count: 3,
  created_at: '2026-01-01T00:00:00Z',
  current_user_role: 'owner',
  members: [
    { user_id: 'user-me', nickname: 'samnick', display_name: 'Sam Smith', photo_url: null, role: 'owner', joined_at: '2026-01-01T00:00:00Z' },
    { user_id: 'u-2', nickname: 'alexc', display_name: 'Alex Chan', photo_url: 'https://cdn.example.com/alex.jpg', role: 'member', joined_at: '2026-01-02T00:00:00Z' },
    { user_id: 'u-3', nickname: 'bob', display_name: 'bob', photo_url: null, role: 'member', joined_at: '2026-01-03T00:00:00Z' },
  ],
};

const mount = (): Promise<Instance> =>
  renderAsync(
    <GroupDetailScreen
      {...({
        route: { key: 'k', name: 'GroupDetail', params: { groupId: 'group-1' } },
        navigation: { goBack: jest.fn() },
      } as unknown as Props)}
    />,
  );

/** The member list row for this user id's display name. */
const memberRow = (root: Instance, displayName: string): Instance =>
  root
    .findAll(n => typeof n.type === 'string' && StyleSheet.flatten(n.props.style)?.paddingVertical === 8 && texts(n).includes(displayName))
    .pop() as Instance;

beforeEach(() => {
  (getGroup as jest.Mock).mockReset().mockResolvedValue(GROUP);
  (searchUsers as jest.Mock).mockReset().mockResolvedValue([]);
});

describe('member list', () => {
  it('shows the display name as the primary name and the nickname underneath, smaller and secondary', async () => {
    const root = await mount();
    const row = memberRow(root, 'Alex Chan');
    const t = texts(row);
    expect(t.indexOf('Alex Chan')).toBeLessThan(t.indexOf('alexc'));
    const nameNode = row.find(n => (n.type as unknown) === 'Text' && n.props.children === 'Alex Chan');
    const nickNode = row.find(n => (n.type as unknown) === 'Text' && n.props.children === 'alexc');
    const name = StyleSheet.flatten(nameNode.props.style);
    const nick = StyleSheet.flatten(nickNode.props.style);
    expect(nick.fontSize as number).toBeLessThan(name.fontSize as number);
    expect(nick.color).not.toBe(name.color); // secondary text colour
  });

  it('does not repeat the nickname when it equals the display name', async () => {
    const root = await mount();
    expect(texts(memberRow(root, 'bob')).filter(x => x === 'bob')).toHaveLength(1);
  });

  it('shows the photo when there is one', async () => {
    const root = await mount();
    const images = memberRow(root, 'Alex Chan').findAllByType(Image);
    expect(images).toHaveLength(1);
    expect(images[0].props.source).toEqual({ uri: 'https://cdn.example.com/alex.jpg' });
  });

  it('shows initials when there is no photo', async () => {
    const root = await mount();
    const row = memberRow(root, 'Sam Smith');
    expect(row.findAllByType(Image)).toHaveLength(0);
    expect(texts(row)).toContain('S');
  });
});

describe('other places a member is named', () => {
  it('"Owned by" uses the owner\'s display name', async () => {
    const root = await mount();
    expect(texts(root)).toContain('Owned by Sam Smith');
  });

  it('"Owned by" falls back to the nickname when there is no display name', async () => {
    (getGroup as jest.Mock).mockResolvedValue({ ...GROUP, owner_display_name: undefined });
    const root = await mount();
    expect(texts(root)).toContain('Owned by samnick');
  });

  it('the remove-member confirmation names the member by display name', async () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const root = await mount();
    const row = memberRow(root, 'Alex Chan');
    const remove = row.find(n => typeof n.props.onPress === 'function' && texts(n).includes('Remove'));
    act(() => remove.props.onPress());
    expect(spy).toHaveBeenCalled();
    expect(String(spy.mock.calls[0][1])).toContain('Alex Chan');
    expect(String(spy.mock.calls[0][1])).not.toContain('alexc');
    spy.mockRestore();
  });
});

describe('invitee rows', () => {
  it('show the display name with the nickname underneath', async () => {
    jest.useFakeTimers();
    (searchUsers as jest.Mock).mockResolvedValue([{ id: 'u-9', display_name: 'Casey Lee', nickname: 'casey', pending: false }]);
    const root = await mount();
    act(() => pressableWithText(root, 'Invite').props.onPress());
    const input = root.find(n => (n.type as unknown) === 'TextInput' && n.props.accessibilityLabel === 'Search users');
    act(() => input.props.onChangeText('cas'));
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    act(() => pressableWithText(root, 'casey').props.onPress());
    const row = root.findAll(n => typeof n.type === 'string' && texts(n).includes('Casey Lee') && texts(n).includes('casey') && texts(n).includes('Change')).pop() as Instance;
    const t = texts(row);
    expect(t.indexOf('Casey Lee')).toBeLessThan(t.indexOf('casey'));
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });
});
