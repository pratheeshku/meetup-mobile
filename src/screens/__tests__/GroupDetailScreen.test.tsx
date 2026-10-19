/**
 * GroupDetailScreen — WhatsApp-style redesign (docs/mockups/group-view/): invite
 * panel ("+" adds, "−" undoes), share link visibility. `api/users` is mocked (not
 * `api/client`) so the shared search picker's own debounce runs for real.
 */
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createGroupInvitation, getGroup, inviteMember, removeMember } from '../../api/groups';
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
  transferGroupOwnership: jest.fn(),
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
const mockRemoveMember = removeMember as jest.MockedFunction<typeof removeMember>;
const mockSearchUsers = searchUsers as jest.MockedFunction<typeof searchUsers>;

const DEBOUNCE_MS = 300;
const METRICS = { frame: { x: 0, y: 0, width: 360, height: 640 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

const GROUP: GroupDetail = {
  id: 'group-1',
  name: 'Sunday League',
  description: 'A friendly group',
  owner_id: 'user-me',
  owner_nickname: 'sam99',
  member_count: 1,
  created_at: '2026-01-01T00:00:00Z',
  current_user_role: 'owner',
  members: [{ user_id: 'user-me', nickname: 'sam99', display_name: 'Sam', photo_url: null, role: 'owner', joined_at: '2026-01-01T00:00:00Z' }],
};

const FOUND_USER: UserSearchResult = {
  id: 'u-2',
  display_name: 'Alex Chan',
  nickname: 'alexc',
  pending: false,
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

const searchInput = (root: Instance): Instance =>
  root.find(node => (node.type as unknown) === 'TextInput' && node.props.accessibilityLabel === 'Search users');

const searchRows = (root: Instance): Instance[] =>
  root.findAll(node => node.props.testID === 'user-search-row' && typeof node.props.onPress === 'function');

const undoButtons = (root: Instance): Instance[] =>
  root.findAll(node => node.props.testID === 'undo-add-button' && typeof node.props.onPress === 'function');

async function openInvite(root: Instance): Promise<void> {
  await act(async () => pressableLabelled(root, 'Invite').props.onPress());
}

async function search(root: Instance, query: string): Promise<void> {
  act(() => searchInput(root).props.onChangeText(query));
  await act(async () => {
    jest.advanceTimersByTime(DEBOUNCE_MS);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockUser = { id: 'user-me', nickname: 'sam99', display_name: 'Sam' };
  mockGetGroup.mockReset().mockResolvedValue(GROUP);
  mockInviteMember.mockReset().mockResolvedValue({ nextCandidate: null });
  mockRemoveMember.mockReset().mockResolvedValue(undefined);
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

describe('invite panel', () => {
  it('Invite opens the search (no free-text "User ID") and shows the compact "Invite players" header', async () => {
    const root = await mount();
    await openInvite(root);
    expect(searchInput(root)).toBeDefined();
    expect(texts(root)).toContain('Invite players');
    expect(root.findAll(node => (node.type as unknown) === 'TextInput' && node.props.placeholder === 'User ID')).toHaveLength(0);
  });

  it('searches excluding the current group and lists suggested players', async () => {
    const root = await mount();
    await openInvite(root);
    await search(root, 'alex');
    expect(mockSearchUsers).toHaveBeenCalledWith(
      { q: 'alex', excludeGroupId: 'group-1', excludeEventId: undefined, excludeTeamId: undefined },
      expect.anything(),
    );
    expect(searchRows(root)).toHaveLength(1);
  });

  it('shows the display name above the nickname in a search row', async () => {
    const root = await mount();
    await openInvite(root);
    await search(root, 'alex');
    const t = texts(searchRows(root)[0]);
    expect(t.indexOf('Alex Chan')).toBeGreaterThanOrEqual(0);
    expect(t.indexOf('Alex Chan')).toBeLessThan(t.indexOf('alexc'));
  });

  it('"+" adds the person (inviteMember) and moves them to the Added list with a count', async () => {
    const root = await mount();
    await openInvite(root);
    await search(root, 'alex');
    await act(async () => searchRows(root)[0].props.onPress());

    expect(mockInviteMember).toHaveBeenCalledWith('group-1', 'u-2', expect.objectContaining({ correlationId: expect.any(String) }));
    expect(texts(root)).toContain('Added · 1');
    expect(texts(root)).toContain('Added');
    expect(undoButtons(root)).toHaveLength(1);
    expect(undoButtons(root)[0].props.accessibilityLabel).toBe('Undo add');
  });

  it('"−" removes the person (removeMember), no confirmation, and they reappear with "+"', async () => {
    const root = await mount();
    await openInvite(root);
    await search(root, 'alex');
    await act(async () => searchRows(root)[0].props.onPress());
    expect(searchRows(root)).toHaveLength(0); // already added, so hidden from results
    const groupLoads = mockGetGroup.mock.calls.length;

    await act(async () => undoButtons(root)[0].props.onPress());

    expect(mockRemoveMember).toHaveBeenCalledWith('group-1', 'u-2', expect.objectContaining({ correlationId: expect.any(String) }));
    expect(texts(root)).not.toContain('Added · 1');
    expect(undoButtons(root)).toHaveLength(0);
    expect(mockGetGroup.mock.calls.length).toBeGreaterThan(groupLoads); // group refreshed
    expect(searchRows(root)).toHaveLength(1);
    expect(texts(searchRows(root)[0])).toContain('Alex Chan');
  });

  it('a failed undo keeps the row and shows an inline error', async () => {
    mockRemoveMember.mockRejectedValueOnce(new Error('500'));
    const root = await mount();
    await openInvite(root);
    await search(root, 'alex');
    await act(async () => searchRows(root)[0].props.onPress());

    await act(async () => undoButtons(root)[0].props.onPress());

    expect(texts(root)).toContain('Could not undo this. Please try again.');
    expect(texts(root)).toContain('Added · 1');
    expect(undoButtons(root)).toHaveLength(1);
  });

  it('a double tap on "−" removes once', async () => {
    const root = await mount();
    await openInvite(root);
    await search(root, 'alex');
    await act(async () => searchRows(root)[0].props.onPress());
    const button = undoButtons(root)[0];

    await act(async () => {
      button.props.onPress();
      button.props.onPress();
    });

    expect(mockRemoveMember).toHaveBeenCalledTimes(1);
  });

  it('a person added by email has no "−" (no cancel endpoint)', async () => {
    mockSearchUsers.mockResolvedValue([]);
    const root = await mount();
    await openInvite(root);
    await search(root, 'friend@example.com');
    await act(async () => pressableLabelled(root, 'Invite friend@example.com as new player').props.onPress());

    expect(mockCreateGroupInvitation).toHaveBeenCalledWith(
      'group-1',
      expect.objectContaining({ invitedEmail: 'friend@example.com' }),
    );
    expect(texts(root)).toContain('friend@example.com');
    expect(texts(root)).toContain('Added · 1');
    expect(undoButtons(root)).toHaveLength(0);
  });
});

describe('share link', () => {
  it('shows Share link and Invite to the owner', async () => {
    const root = await mount();
    expect(pressableWithText(root, 'Share link')).toBeDefined();
    expect(pressableWithText(root, 'Invite')).toBeDefined();
  });

  it('shows neither to a regular group member', async () => {
    mockGetGroup.mockResolvedValue({
      ...GROUP,
      owner_id: 'other-owner',
      members: [
        { user_id: 'other-owner', nickname: 'own', display_name: 'Olga', photo_url: null, role: 'owner', joined_at: '2026-01-01T00:00:00Z' },
        { user_id: 'user-me', nickname: 'sam99', display_name: 'Sam', photo_url: null, role: 'member', joined_at: '2026-01-02T00:00:00Z' },
      ],
    });
    const root = await mount();
    expect(texts(root)).not.toContain('Share link');
    expect(texts(root)).not.toContain('Invite');
  });
});
