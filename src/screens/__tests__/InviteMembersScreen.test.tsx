/** Group create step 2 uses the shared UserSearchPicker, like Group Detail. */
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createGroupInvitation, inviteMember } from '../../api/groups';
import { searchUsers } from '../../api/users';
import { showCompletion } from '../../navigation/showCompletion';
import { act, pressableLabelled, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import InviteMembersScreen from '../InviteMembersScreen';

type Props = React.ComponentProps<typeof InviteMembersScreen>;

jest.mock('../../api/groups', () => ({ inviteMember: jest.fn(), createGroupInvitation: jest.fn() }));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn() }));
jest.mock('../../navigation/showCompletion', () => ({ showCompletion: jest.fn() }));

const ALEX = { id: 'u-1', nickname: 'alex', display_name: 'Alex Chen', pending: false };
const BO = { id: 'u-2', nickname: 'bo', display_name: 'Bo Lim', pending: false };
const METRICS = { frame: { x: 0, y: 0, width: 360, height: 640 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

const mockInviteMember = inviteMember as jest.Mock;
const mockInviteEmail = createGroupInvitation as jest.Mock;
const mockSearch = searchUsers as jest.Mock;

async function mount(): Promise<Instance> {
  const props = {
    route: { key: 'k', name: 'InviteMembers', params: { groupId: 'g-1' } },
    navigation: { goBack: jest.fn() },
  } as unknown as Props;
  return renderAsync(
    <SafeAreaProvider initialMetrics={METRICS}>
      <InviteMembersScreen {...props} />
    </SafeAreaProvider>,
  );
}

const field = (root: Instance): Instance =>
  root.find(n => (n.type as unknown) === 'TextInput' && n.props.accessibilityLabel === 'Search users');
const rows = (root: Instance): Instance[] =>
  root.findAll(n => n.props.testID === 'user-search-row' && typeof n.props.onPress === 'function');
const emailBtn = (root: Instance, email: string): Instance | undefined =>
  root.findAll(n => n.props.accessibilityLabel === `Invite ${email} as new group member` && typeof n.props.onPress === 'function')[0];
const type = async (root: Instance, value: string): Promise<void> => {
  await act(async () => {
    field(root).props.onChangeText(value);
  });
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
};
const tap = async (node: Instance): Promise<void> => {
  await act(async () => {
    node.props.onPress();
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  mockInviteMember.mockReset().mockResolvedValue({ nextCandidate: null });
  mockInviteEmail.mockReset().mockResolvedValue({});
  (showCompletion as jest.Mock).mockReset();
  mockSearch.mockReset().mockImplementation(async ({ q }: { q: string }) => {
    const needle = q.trim().toLowerCase();
    return [ALEX, BO].filter(u => !needle || u.display_name.toLowerCase().includes(needle));
  });
});
afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

it('has one search field only and asks the server to exclude current members of this group', async () => {
  const root = await mount();
  expect(root.findAll(n => (n.type as unknown) === 'TextInput')).toHaveLength(1);
  expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({ excludeGroupId: 'g-1' }), expect.anything());
  expect(rows(root)).toHaveLength(2); // the default suggested members
});

it('a name search adds the member (inviteMember) and removes them from the suggestions', async () => {
  const root = await mount();
  await type(root, 'alex');
  expect(rows(root)).toHaveLength(1);
  await tap(rows(root)[0]);
  expect(mockInviteMember).toHaveBeenCalledWith('g-1', 'u-1', expect.objectContaining({ correlationId: expect.any(String) }));
  expect(texts(root)).toContain('1 added');
  expect(texts(root)).toContain('Alex');
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  expect(rows(root).some(r => String(r.props.accessibilityLabel).includes('Alex Chen'))).toBe(false);
});

it('a valid email that matches nobody shows the Invite button and invites by email like Group Detail', async () => {
  const root = await mount();
  await type(root, 'new.person@example.com');
  expect(texts(root)).toContain('Invite new.person@example.com as new group member');
  await tap(emailBtn(root, 'new.person@example.com') as Instance);
  expect(mockInviteEmail).toHaveBeenCalledTimes(1);
  expect(mockInviteEmail).toHaveBeenCalledWith(
    'g-1',
    expect.objectContaining({ invitedEmail: 'new.person@example.com', correlationId: expect.any(String) }),
  );
  expect(mockInviteMember).not.toHaveBeenCalled();
  expect(texts(root)).toContain('1 added');
  expect(texts(root)).toContain('new.person@example.com');
});

it.each([['not-an-email'], ['zzz'], ['a@b']])('"%s" shows no email button', async text => {
  const root = await mount();
  await type(root, text);
  expect(root.findAll(n => /^Invite .+@.+ as new /.test(String(n.props.accessibilityLabel ?? '')))).toHaveLength(0);
  expect(mockInviteEmail).not.toHaveBeenCalled();
});

it('inviting the same email in a different case makes only one call', async () => {
  const root = await mount();
  await type(root, 'Sam@Example.com');
  await tap(emailBtn(root, 'Sam@Example.com') as Instance);
  await type(root, 'sam@example.COM');
  await tap(emailBtn(root, 'sam@example.COM') as Instance);
  expect(mockInviteEmail).toHaveBeenCalledTimes(1);
  expect(texts(root)).toContain('1 added');
});

it('a failed invite shows the existing error and adds nobody', async () => {
  mockInviteEmail.mockRejectedValueOnce(new Error('boom'));
  const root = await mount();
  await type(root, 'x@example.com');
  await tap(emailBtn(root, 'x@example.com') as Instance);
  expect(texts(root)).toContain('Could not add this person to the group. Please try again.');
  expect(texts(root)).not.toContain('1 added');
});

it('finishing reports members and invited emails together', async () => {
  const root = await mount();
  await tap(rows(root)[0]);
  await type(root, 'x@example.com');
  await tap(emailBtn(root, 'x@example.com') as Instance);
  await act(async () => pressableLabelled(root, 'Create group').props.onPress());
  const rowsArg = (showCompletion as jest.Mock).mock.calls[0][0].rows as { label: string; value: string }[];
  expect(rowsArg.find(r => r.label === 'Group members added')?.value).toBe('2 — Alex Chen, x@example.com');
});
