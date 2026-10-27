/** tournament-invite: Invite groups / players (user or email) on Tournament Detail, through the invite picker (GV-5). */
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
const shown = (root: Instance): string => texts(root).join(' | ');
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
  it('full: Invite groups, Invite players and Share', async () => {
    const root = await mountTournament({ my_invite_access: 'full' });
    expect(has(root, 'Invite groups')).toBe(true);
    expect(has(root, 'Invite players')).toBe(true);
    expect(has(root, 'Share app link')).toBe(true);
  });

  it('individuals: Invite players and Share, no Invite groups', async () => {
    const root = await mountTournament({ my_invite_access: 'individuals' });
    expect(has(root, 'Invite groups')).toBe(false);
    expect(has(root, 'Invite players')).toBe(true);
    expect(has(root, 'Share app link')).toBe(true);
  });

  it.each([['none'], [null], [undefined]])('%p: no invite actions at all', async access => {
    const root = await mountTournament(access === undefined ? {} : { my_invite_access: access });
    expect(has(root, 'Invite groups')).toBe(false);
    expect(has(root, 'Invite players')).toBe(false);
  });

  it('does not offer the picker an event-only exclude filter', async () => {
    const root = await mountTournament({ my_invite_access: 'full' });
    await press(root, 'Invite players');
    expect(root.findAll(n => n.props.testID === 'picker-exclude-undefined').length).toBeGreaterThan(0);
  });
});

describe('endpoints and payloads', () => {
  it('invite-user posts { user_id } to /tournaments/{id}/invite-user', async () => {
    const root = await mountTournament({ my_invite_access: 'individuals' });
    await press(root, 'Invite players');
    await press(root, 'Pick Alex');
    await press(root, 'Send 1 invites');
    expect(mockPost).toHaveBeenCalledWith(
      '/tournaments/t-1/invite-user',
      { user_id: 'u-1' },
      expect.objectContaining({ correlationId: expect.any(String) }),
    );
    expect(has(root, 'Sent 1 invites')).toBe(true);
  });

  it('invite-email posts { email } to /tournaments/{id}/invite-email', async () => {
    const root = await mountTournament({ my_invite_access: 'individuals' });
    await press(root, 'Invite players');
    await press(root, 'Pick Email');
    await press(root, 'Send 1 invites');
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
    await press(root, 'Invite groups');
    await press(root, 'Invite Sunday Footballers');
    await press(root, 'Invite Office League');
    await press(root, 'Send 2 invites');

    const calls = mockPost.mock.calls.filter(c => c[0] === '/tournaments/t-1/invite-group');
    expect(calls.map(c => c[1])).toEqual([{ group_id: 'g-1' }, { group_id: 'g-2' }]);
    expect(new Set(calls.map(c => c[2].correlationId)).size).toBe(1);
    expect(has(root, 'Sent 2 invites')).toBe(true);
  });

  it('uses a new correlation id for each user action', async () => {
    const root = await mountTournament({ my_invite_access: 'individuals' });
    await press(root, 'Invite players');
    await press(root, 'Pick Alex');
    await press(root, 'Send 1 invites');
    // A successful send closes the picker; the next action opens it again.
    await press(root, 'Invite players');
    await press(root, 'Pick Alex');
    await press(root, 'Send 1 invites');
    const ids = mockPost.mock.calls
      .filter(c => c[0] === '/tournaments/t-1/invite-user')
      .map(c => c[2].correlationId);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('a group that adds nobody new says so (no-op, not a crash)', async () => {
    const root = await mountTournament({ my_invite_access: 'full' });
    mockPost.mockResolvedValue({ data: [] });
    await press(root, 'Invite groups');
    await press(root, 'Invite Sunday Footballers');
    await press(root, 'Send 1 invites');
    expect(has(root, 'Everyone in that group is already invited.')).toBe(true);
  });
});

describe('errors', () => {
  const sendUser = async (root: Instance): Promise<void> => {
    await press(root, 'Invite players');
    await press(root, 'Pick Alex');
    await press(root, 'Send 1 invites');
  };

  it('shows the label for a duplicate invitation (never the server text) and keeps working', async () => {
    const root = await mountTournament({ my_invite_access: 'individuals' });
    mockPost.mockRejectedValueOnce(httpError(409, 'User is already invited'));
    await sendUser(root);
    expect(shown(root)).toContain('Could not invite: Alex C');
    expect(shown(root)).toContain('This player is already invited to this tournament.');
    expect(shown(root)).not.toContain('User is already invited');
    expect(has(root, 'Invite players')).toBe(true);
  });

  // tp-mobile-invite (teams-payments AD-1): every refusal shows its own label, never the server text.
  it.each([
    ['string detail with the code', httpError(409, 'Invitations are closed for this tournament (INVITES_CLOSED)'), 'Invitations are closed for this tournament.'],
    ['object detail', httpError(409, { code: 'INVITES_CLOSED', message: 'Registration has closed.' }), 'Invitations are closed for this tournament.'],
    ['bare code', httpError(409, 'INVITES_CLOSED'), 'Invitations are closed for this tournament.'],
    ['422 list', httpError(422, [{ loc: ['body', 'email'], msg: 'value is not a valid email address' }]), 'Enter a valid e-mail address.'],
    ['403 not allowed', httpError(403, 'You cannot invite to this tournament'), 'You cannot do this.'],
    ['the organizer', httpError(400, 'The organizer cannot be invited'), 'The organizer is already in this tournament and cannot be invited.'],
    ['group cap', httpError(409, 'GROUP_CAP_REACHED'), 'This group has more people than can be invited at once. Invite a smaller group or invite players one by one.'],
    ['per-user limit', httpError(409, 'INVITE_LIMIT_REACHED'), 'You have reached the invitation limit for this tournament.'],
  ])('shows the label for %s', async (_name, error, expected) => {
    const root = await mountTournament({ my_invite_access: 'individuals' });
    mockPost.mockRejectedValueOnce(error);
    await sendUser(root);
    expect(shown(root)).toContain(expected);
    expect(shown(root)).not.toContain('Registration has closed.');
    expect(shown(root)).not.toContain('You cannot invite to this tournament');
  });

  it('backend body {"detail":"INVITES_CLOSED"} (409) shows the label and never the raw code', async () => {
    const root = await mountTournament({ my_invite_access: 'individuals' });
    mockPost.mockRejectedValueOnce({ response: { status: 409, data: { detail: 'INVITES_CLOSED' } } });
    await sendUser(root);
    expect(shown(root)).toContain('Invitations are closed for this tournament.');
    expect(texts(root).some(x => x.includes('INVITES_CLOSED'))).toBe(false);
  });

  it('a network error names the entry and shows no server text', async () => {
    const root = await mountTournament({ my_invite_access: 'individuals' });
    mockPost.mockRejectedValueOnce(new Error('network'));
    await sendUser(root);
    expect(shown(root)).toContain('Could not invite: Alex C');
    expect(texts(root).some(x => x.includes('network'))).toBe(false);
  });

  it('404 (feature off) hides the invite actions silently and leaves Share', async () => {
    const root = await mountTournament({ my_invite_access: 'full' });
    mockPost.mockRejectedValueOnce(httpError(404, 'Not Found'));
    await sendUser(root);
    expect(has(root, 'Not Found')).toBe(false);
    expect(shown(root)).not.toContain('Could not invite');
    expect(has(root, 'Invite players')).toBe(false);
    expect(has(root, 'Invite groups')).toBe(false);
    expect(has(root, 'Share app link')).toBe(true);
  });

  it('a group-invite 404 also hides the actions', async () => {
    const root = await mountTournament({ my_invite_access: 'full' });
    mockPost.mockRejectedValueOnce(httpError(404, 'Not Found'));
    await press(root, 'Invite groups');
    await press(root, 'Invite Sunday Footballers');
    await press(root, 'Send 1 invites');
    expect(has(root, 'Invite groups')).toBe(false);
    expect(has(root, 'Share app link')).toBe(true);
  });
});

describe('logging', () => {
  it('never writes the email address to the console, even on failure', async () => {
    const root = await mountTournament({ my_invite_access: 'individuals' });
    mockPost.mockRejectedValueOnce(httpError(409, 'Already invited'));
    await press(root, 'Invite players');
    await press(root, 'Pick Email');
    await press(root, 'Send 1 invites');
    expect(JSON.stringify(spies.map(s => s.mock.calls))).not.toContain('newcomer@example.com');
  });
});
