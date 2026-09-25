/**
 * GroupDetailScreen — invite flow (BUG-M01 rebuild). Focus: the free-text
 * "User ID" field is gone, replaced by `UserSearchPicker`; the existing
 * `inviteMember(groupId, userId)` contract is unchanged (still gets a real
 * user id, now sourced from a search result instead of typed by hand).
 *
 * `api/users` is mocked (not `api/client`) so `UserSearchPicker`'s own
 * debounce/search behaviour is exercised for real — only the network call
 * underneath it is faked.
 */
import React from 'react';

import { getGroup, inviteMember } from '../../api/groups';
import { searchUsers } from '../../api/users';
import { act, pressableWithText, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import type { GroupDetail } from '../../types/group';
import type { UserSearchResult } from '../../types/user';
import GroupDetailScreen from '../GroupDetailScreen';

type Props = React.ComponentProps<typeof GroupDetailScreen>;

jest.mock('../../api/groups', () => ({
  getGroup: jest.fn(),
  inviteMember: jest.fn(),
  removeMember: jest.fn(),
  updateMemberRole: jest.fn(),
}));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn() }));
jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-me' } }),
}));

const mockGetGroup = getGroup as jest.MockedFunction<typeof getGroup>;
const mockInviteMember = inviteMember as jest.MockedFunction<typeof inviteMember>;
const mockSearchUsers = searchUsers as jest.MockedFunction<typeof searchUsers>;

const DEBOUNCE_MS = 300;

const GROUP: GroupDetail = {
  id: 'group-1',
  name: 'Sunday League',
  description: 'A friendly group',
  owner_id: 'owner-1',
  owner_nickname: 'ownerNick',
  member_count: 1,
  created_at: '2026-01-01T00:00:00Z',
  current_user_role: 'owner',
  members: [{ user_id: 'user-me', nickname: 'sam99', role: 'owner', joined_at: '2026-01-01T00:00:00Z' }],
};

const FOUND_USER: UserSearchResult = {
  id: 'u-2',
  display_name: 'Alex Chan',
  nickname: 'alexc',
  pending: false,
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

function searchInput(root: Instance): Instance {
  return root.find(
    node => (node.type as unknown) === 'TextInput' && node.props.accessibilityLabel === 'Search users',
  );
}

async function search(root: Instance, query: string): Promise<void> {
  act(() => searchInput(root).props.onChangeText(query));
  await act(async () => {
    jest.advanceTimersByTime(DEBOUNCE_MS);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockGetGroup.mockReset().mockResolvedValue(GROUP);
  mockInviteMember.mockReset().mockResolvedValue(undefined);
  mockSearchUsers.mockReset().mockResolvedValue([FOUND_USER]);
});

afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

describe('invite flow', () => {
  it('opens the search picker (no free-text "User ID" field) when Invite is tapped', async () => {
    const root = await mount();
    act(() => pressableWithText(root, 'Invite').props.onPress());
    expect(root.findAll(node => (node.type as unknown) === 'TextInput' && node.props.placeholder === 'User ID')).toHaveLength(0);
    expect(searchInput(root)).toBeDefined();
  });

  it('searches excluding the current group, and lets the found user be selected then invited', async () => {
    const root = await mount();
    act(() => pressableWithText(root, 'Invite').props.onPress());

    await search(root, 'alex');
    expect(mockSearchUsers).toHaveBeenCalledWith(
      { q: 'alex', excludeGroupId: 'group-1', excludeEventId: undefined, excludeTeamId: undefined },
      expect.anything(),
    );
    expect(texts(root)).toEqual(expect.arrayContaining(['alexc', 'Alex Chan']));

    act(() => pressableWithText(root, 'alexc').props.onPress());
    expect(texts(root)).toContain('alexc (Alex Chan)');

    await act(async () => pressableWithText(root, 'Send Invite').props.onPress());
    expect(mockInviteMember).toHaveBeenCalledWith('group-1', 'u-2', expect.anything());
    expect(mockGetGroup).toHaveBeenCalledTimes(2); // initial load + post-invite refresh
  });

  it('disables Send Invite until a user is chosen', async () => {
    const root = await mount();
    act(() => pressableWithText(root, 'Invite').props.onPress());
    expect(pressableWithText(root, 'Send Invite').props.disabled).toBe(true);
  });

  it('"Change" clears the selection and returns to the search picker', async () => {
    const root = await mount();
    act(() => pressableWithText(root, 'Invite').props.onPress());
    await search(root, 'alex');
    act(() => pressableWithText(root, 'alexc').props.onPress());

    act(() => pressableWithText(root, 'Change').props.onPress());
    expect(texts(root)).not.toContain('alexc (Alex Chan)');
    expect(searchInput(root)).toBeDefined();
  });

  it('shows an error and keeps the form open when the invite call fails', async () => {
    mockInviteMember.mockRejectedValue(new Error('409'));
    const root = await mount();
    act(() => pressableWithText(root, 'Invite').props.onPress());
    await search(root, 'alex');
    act(() => pressableWithText(root, 'alexc').props.onPress());

    await act(async () => pressableWithText(root, 'Send Invite').props.onPress());
    expect(texts(root)).toContain('Could not send the invite. Please try again.');
  });

  it('supports selecting multiple users and invites each on submit', async () => {
    const root = await mount();
    act(() => pressableWithText(root, 'Invite').props.onPress());

    mockSearchUsers.mockResolvedValueOnce([FOUND_USER]);
    await search(root, 'alex');
    act(() => pressableWithText(root, 'alexc').props.onPress());

    const SECOND_USER: UserSearchResult = {
      id: 'u-3',
      display_name: 'Bob Builder',
      nickname: 'bob',
      pending: false,
    };
    mockSearchUsers.mockResolvedValueOnce([SECOND_USER]);
    await search(root, 'bob');
    act(() => pressableWithText(root, 'bob').props.onPress());

    expect(texts(root)).toContain('alexc (Alex Chan)');
    expect(texts(root)).toContain('bob (Bob Builder)');

    // Remove first user
    const removeAlex = root.findByProps({ accessibilityLabel: 'Remove alexc' });
    act(() => removeAlex.props.onPress());
    expect(texts(root)).not.toContain('alexc (Alex Chan)');
    expect(texts(root)).toContain('bob (Bob Builder)');

    await act(async () => pressableWithText(root, 'Send Invite').props.onPress());
    expect(mockInviteMember).toHaveBeenCalledTimes(1);
    expect(mockInviteMember).toHaveBeenCalledWith('group-1', 'u-3', expect.anything());
  });
});
