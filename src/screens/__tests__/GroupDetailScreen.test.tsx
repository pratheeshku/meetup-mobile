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
import { Clipboard, Linking, Share } from 'react-native';

import { createGroupInvitation, getGroup, inviteMember } from '../../api/groups';
import { searchUsers } from '../../api/users';
import { act, pressableLabelled, pressableWithText, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import type { GroupDetail } from '../../types/group';
import type { UserSearchResult } from '../../types/user';
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

let mockUser: { id: string; nickname?: string; display_name?: string } = {
  id: 'user-me',
  nickname: 'sam99',
  display_name: 'Sam',
};
jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

const mockCreateGroupInvitation = createGroupInvitation as jest.MockedFunction<typeof createGroupInvitation>;
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
  members: [{ user_id: 'user-me', nickname: 'sam99', display_name: 'sam99', photo_url: null, role: 'owner', joined_at: '2026-01-01T00:00:00Z' }],
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
  mockInviteMember.mockReset().mockResolvedValue({ nextCandidate: null });
  mockSearchUsers.mockReset().mockResolvedValue([FOUND_USER]);
  mockCreateGroupInvitation.mockReset().mockResolvedValue({
    token: 'tok-1',
    invitation_url: 'https://meetups.duckdns.org/groups/invite/tok-1',
  });
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
    expect(texts(root)).toContain('Alex Chan');

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
    expect(texts(root)).not.toContain('Alex Chan');
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

    expect(texts(root)).toEqual(expect.arrayContaining(['Alex Chan', 'alexc', 'Bob Builder', 'bob']));

    // Remove first user
    const removeAlex = root.findByProps({ accessibilityLabel: 'Remove Alex Chan' });
    act(() => removeAlex.props.onPress());
    expect(texts(root)).not.toContain('Alex Chan');
    expect(texts(root)).toContain('Bob Builder');

    await act(async () => pressableWithText(root, 'Send Invite').props.onPress());
    expect(mockInviteMember).toHaveBeenCalledTimes(1);
    expect(mockInviteMember).toHaveBeenCalledWith('group-1', 'u-3', expect.anything());
  });

  it('supports inviting by email when zero search results for valid email (Decision 23 & 24)', async () => {
    mockSearchUsers.mockResolvedValueOnce([]);
    mockCreateGroupInvitation.mockResolvedValueOnce({
      token: 'tok-email-abc',
      invitation_url: 'https://meetups.duckdns.org/groups/invite/tok-email-abc',
    });

    const root = await mount();
    act(() => pressableWithText(root, 'Invite').props.onPress());

    await search(root, 'friend@example.com');
    expect(texts(root)).toContain('✉️ Invite friend@example.com as new member');

    act(() => pressableLabelled(root, 'Invite friend@example.com as new member').props.onPress());
    expect(texts(root)).toContain('Invite by email: friend@example.com');
    expect(texts(root)).toContain('Change');

    await act(async () => pressableWithText(root, 'Send Invite').props.onPress());

    expect(mockCreateGroupInvitation).toHaveBeenCalledWith(
      'group-1',
      expect.objectContaining({ invitedEmail: 'friend@example.com' }),
    );
    expect(mockInviteMember).not.toHaveBeenCalled();
    expect(mockGetGroup).toHaveBeenCalledTimes(2);
  });
});

describe('group invite link sharing', () => {
  it('renders "Share Group Invite" and "Share Link" for group owner/admin', async () => {
    const root = await mount();
    expect(texts(root)).toContain('Share Group Invite');
    expect(texts(root)).toContain('Share Link');
  });

  it('does NOT render "Share Group Invite" for regular member', async () => {
    mockGetGroup.mockResolvedValueOnce({
      ...GROUP,
      owner_id: 'other-owner',
      members: [{ user_id: 'user-me', nickname: 'sam99', display_name: 'sam99', photo_url: null, role: 'member', joined_at: '2026-01-01T00:00:00Z' }],
    });
    const root = await mount();
    expect(texts(root)).not.toContain('Share Group Invite');
    expect(texts(root)).not.toContain('Share Link');
  });

  it('calls createGroupInvitation and opens ShareActionSheet when Share Group Invite is tapped', async () => {
    const root = await mount();
    await act(async () => {
      await pressableLabelled(root, 'Share Group Invite').props.onPress();
    });

    expect(mockCreateGroupInvitation).toHaveBeenCalledWith('group-1', expect.anything());
    expect(texts(root)).toContain('Share Group Invite');
    expect(texts(root)).toContain('Share via WhatsApp');
    expect(texts(root)).toContain('Share via other apps');
    expect(texts(root)).toContain('Copy Link');
  });

  it('shares via generic Share.share with composed message and invitation URL', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValueOnce({ action: 'sharedAction' });
    const root = await mount();

    await act(async () => {
      await pressableLabelled(root, 'Share Group Invite').props.onPress();
    });

    await act(async () => {
      await pressableLabelled(root, 'Share via other apps').props.onPress();
    });

    expect(shareSpy).toHaveBeenCalledWith({
      message:
        'Sam invited you to Sunday League on Shuttlr \u2014 https://meetups.duckdns.org/groups/invite/tok-1',
      url: 'https://meetups.duckdns.org/groups/invite/tok-1',
    });
  });

  it('shares via WhatsApp with composed message', async () => {
    const canOpenSpy = jest.spyOn(Linking, 'canOpenURL').mockResolvedValueOnce(true);
    const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(undefined as never);
    const root = await mount();

    await act(async () => {
      await pressableLabelled(root, 'Share Group Invite').props.onPress();
    });

    await act(async () => {
      await pressableLabelled(root, 'Share via WhatsApp').props.onPress();
    });

    const expectedMsg =
      'Sam invited you to Sunday League on Shuttlr \u2014 https://meetups.duckdns.org/groups/invite/tok-1';
    expect(canOpenSpy).toHaveBeenCalledWith('whatsapp://send');
    expect(openSpy).toHaveBeenCalledWith(`whatsapp://send?text=${encodeURIComponent(expectedMsg)}`);
  });

  it('copies invitation link to clipboard and displays toast', async () => {
    const setStringSpy = jest.spyOn(Clipboard, 'setString');
    const root = await mount();

    await act(async () => {
      await pressableLabelled(root, 'Share Group Invite').props.onPress();
    });

    act(() => {
      pressableLabelled(root, 'Copy Link').props.onPress();
    });

    expect(setStringSpy).toHaveBeenCalledWith('https://meetups.duckdns.org/groups/invite/tok-1');
    expect(texts(root)).toContain('Link copied to clipboard');
  });

  it('displays error inline when createGroupInvitation fails', async () => {
    mockCreateGroupInvitation.mockRejectedValueOnce(new Error('500 server error'));
    const root = await mount();

    await act(async () => {
      await pressableLabelled(root, 'Share Group Invite').props.onPress();
    });

    expect(texts(root)).toContain('Could not generate group invite link. Please try again.');
  });
});

