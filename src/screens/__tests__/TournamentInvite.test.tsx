/** tournament-invite: Invite Group / Player (user or email) on Tournament Detail. */
import React from 'react';

import { act, pressableLabelled, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { getMyGroups } from '../../api/groups';
import { mockPost, mountTournament } from '../../test-utils/tournamentDetailHarness';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn() }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-me' } }) }));
jest.mock('../../components/UserSearchPicker', () => {
  const { Pressable, Text, View } = require('react-native');
  return function MockUserSearchPicker({ onSelect, onSelectEmail, excludeEventId }: any) {
    return (
      <View testID={`picker-exclude-${String(excludeEventId)}`}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pick Alex"
          onPress={() => onSelect({ id: 'u-1', nickname: 'alex', display_name: 'Alex C' })}
        >
          <Text>Pick Alex</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pick Email"
          onPress={() => onSelectEmail('newcomer@example.com')}
        >
          <Text>Pick Email</Text>
        </Pressable>
      </View>
    );
  };
});

const GROUPS = {
  items: [
    { id: 'g-1', name: 'Sunday Footballers' },
    { id: 'g-2', name: 'Office League' },
  ],
};
const has = (root: Instance, label: string): boolean => texts(root).includes(label);
const press = async (root: Instance, label: string): Promise<void> => {
  await act(async () => {
    pressableLabelled(root, label).props.onPress();
  });
};
const httpError = (status: number, detail: unknown) => ({ response: { status, data: { detail } } });

let spies: jest.SpyInstance[];
beforeEach(() => {
  (getMyGroups as jest.Mock).mockReset().mockResolvedValue(GROUPS);
  spies = (['log', 'warn', 'error', 'info', 'debug'] as const).map(m =>
    jest.spyOn(console, m).mockImplementation(() => {}),
  );
});
afterEach(() => spies.forEach(s => s.mockRestore()));

describe('buttons per access level', () => {
  it('full: Invite Group, Invite Player and Share', async () => {
    const root = await mountTournament({ my_invite_access: 'full' });
    expect(has(root, 'Invite Group')).toBe(true);
    expect(has(root, 'Invite Player')).toBe(true);
    expect(has(root, 'Share app link')).toBe(true);
  });

  it('individuals: Invite Player and Share, no Invite Group', async () => {
    const root = await mountTournament({ my_invite_access: 'individuals' });
    expect(has(root, 'Invite Group')).toBe(false);
    expect(has(root, 'Invite Player')).toBe(true);
    expect(has(root, 'Share app link')).toBe(true);
  });

  it.each([['none'], [null], [undefined]])('%p: no invite actions at all', async access => {
    const root = await mountTournament(access === undefined ? {} : { my_invite_access: access });
    expect(has(root, 'Invite Group')).toBe(false);
    expect(has(root, 'Invite Player')).toBe(false);
  });

  it('does not offer the picker an event-only exclude filter', async () => {
    const root = await mountTournament({ my_invite_access: 'full' });
    await press(root, 'Invite Player');
    expect(root.findAll(n => n.props.testID === 'picker-exclude-undefined').length).toBeGreaterThan(0);
  });
});

describe('endpoints and payloads', () => {
  it('invite-user posts { user_id } to /tournaments/{id}/invite-user', async () => {
    const root = await mountTournament({ my_invite_access: 'individuals' });
    await press(root, 'Invite Player');
    await press(root, 'Pick Alex');
    await press(root, 'Send Invite');
    expect(mockPost).toHaveBeenCalledWith(
      '/tournaments/t-1/invite-user',
      { user_id: 'u-1' },
      expect.objectContaining({ correlationId: expect.any(String) }),
    );
    expect(has(root, 'Invitation sent to alex!')).toBe(true);
  });

  it('invite-email posts { email } to /tournaments/{id}/invite-email', async () => {
    const root = await mountTournament({ my_invite_access: 'individuals' });
    await press(root, 'Invite Player');
    await press(root, 'Pick Email');
    await press(root, 'Send Invite');
    expect(mockPost).toHaveBeenCalledWith(
      '/tournaments/t-1/invite-email',
      { email: 'newcomer@example.com' },
      expect.objectContaining({ correlationId: expect.any(String) }),
    );
  });

  it('invite-group posts { group_id } once per selected group, under one correlation id', async () => {
    mockPost.mockReset();
    const root = await mountTournament({ my_invite_access: 'full' });
    mockPost.mockResolvedValue({ data: [{ id: 'i-1', status: 'pending' }] }); // one new invitation per group
    await press(root, 'Invite Group');
    await press(root, 'Sunday Footballers');
    await press(root, 'Office League');
    await press(root, 'Send Group Invite');

    const calls = mockPost.mock.calls.filter(c => c[0] === '/tournaments/t-1/invite-group');
    expect(calls.map(c => c[1])).toEqual([{ group_id: 'g-1' }, { group_id: 'g-2' }]);
    expect(new Set(calls.map(c => c[2].correlationId)).size).toBe(1);
    expect(has(root, 'Sent 2 group invitations!')).toBe(true);
  });

  it('uses a new correlation id for each user action', async () => {
    const root = await mountTournament({ my_invite_access: 'individuals' });
    await press(root, 'Invite Player');
    await press(root, 'Pick Alex');
    await press(root, 'Send Invite');
    await press(root, 'Pick Alex');
    await press(root, 'Send Invite');
    const ids = mockPost.mock.calls
      .filter(c => c[0] === '/tournaments/t-1/invite-user')
      .map(c => c[2].correlationId);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('a group that adds nobody new says so (no-op, not a crash)', async () => {
    const root = await mountTournament({ my_invite_access: 'full' });
    mockPost.mockResolvedValue({ data: [] });
    await press(root, 'Invite Group');
    await press(root, 'Sunday Footballers');
    await press(root, 'Send Group Invite');
    expect(has(root, 'Everyone in that group is already invited.')).toBe(true);
  });
});

describe('errors', () => {
  const sendUser = async (root: Instance): Promise<void> => {
    await press(root, 'Invite Player');
    await press(root, 'Pick Alex');
    await press(root, 'Send Invite');
  };

  it('shows the server text for a 409 duplicate and keeps working', async () => {
    const root = await mountTournament({ my_invite_access: 'individuals' });
    mockPost.mockRejectedValueOnce(httpError(409, 'User is already invited'));
    await sendUser(root);
    expect(has(root, 'User is already invited')).toBe(true);
    expect(has(root, 'Invite Player')).toBe(true);
  });

  it.each([
    ['string detail', httpError(409, 'Invitations are closed for this tournament (INVITES_CLOSED)'), 'Invitations are closed for this tournament (INVITES_CLOSED)'],
    ['object detail', httpError(409, { code: 'INVITES_CLOSED', message: 'Registration has closed.' }), 'Registration has closed.'],
    ['bare code', httpError(409, 'INVITES_CLOSED'), 'Invitations are closed for this tournament.'],
    ['422 list', httpError(422, [{ loc: ['body', 'email'], msg: 'value is not a valid email address' }]), 'value is not a valid email address'],
    ['403 not allowed', httpError(403, 'You cannot invite to this tournament'), 'You cannot invite to this tournament'],
  ])('shows the server message for %s', async (_name, error, expected) => {
    const root = await mountTournament({ my_invite_access: 'individuals' });
    mockPost.mockRejectedValueOnce(error);
    await sendUser(root);
    expect(has(root, expected)).toBe(true);
  });

  it('a network error uses the generic invite message', async () => {
    const root = await mountTournament({ my_invite_access: 'individuals' });
    mockPost.mockRejectedValueOnce(new Error('network'));
    await sendUser(root);
    expect(has(root, 'Could not send the invite. Please try again.')).toBe(true);
  });

  it('404 (feature off) hides the invite actions silently and leaves Share', async () => {
    const root = await mountTournament({ my_invite_access: 'full' });
    mockPost.mockRejectedValueOnce(httpError(404, 'Not Found'));
    await sendUser(root);
    expect(has(root, 'Not Found')).toBe(false);
    expect(has(root, 'Could not send the invite. Please try again.')).toBe(false);
    expect(has(root, 'Invite Player')).toBe(false);
    expect(has(root, 'Invite Group')).toBe(false);
    expect(has(root, 'Share app link')).toBe(true);
  });

  it('a group-invite 404 also hides the actions', async () => {
    const root = await mountTournament({ my_invite_access: 'full' });
    mockPost.mockRejectedValueOnce(httpError(404, 'Not Found'));
    await press(root, 'Invite Group');
    await press(root, 'Sunday Footballers');
    await press(root, 'Send Group Invite');
    expect(has(root, 'Invite Group')).toBe(false);
    expect(has(root, 'Share app link')).toBe(true);
  });
});

describe('logging', () => {
  it('never writes the email address to the console, even on failure', async () => {
    const root = await mountTournament({ my_invite_access: 'individuals' });
    mockPost.mockRejectedValueOnce(httpError(409, 'Already invited'));
    await press(root, 'Invite Player');
    await press(root, 'Pick Email');
    await press(root, 'Send Invite');
    expect(JSON.stringify(spies.map(s => s.mock.calls))).not.toContain('newcomer@example.com');
  });
});
