/**
 * Signed-in group invitation confirm screen (group-invite-existing-accounts AD-4, D-1): nothing joins on open;
 * Join sends the token once per tap with one correlation ID; joined and already_member open the group; a 404 shows
 * the neutral message and returns to the Groups list; a network error stays for a retry; Not now drops the token.
 */
import React from 'react';
import { Alert } from 'react-native';

import { joinGroupByInvitation } from '../../api/groups';
import { getPublicGroupInvitation } from '../../api/publicLinks';
import { getGroupJoinToken, setGroupJoinToken, _resetLinkStoreForTesting } from '../../links/linkStore';
import { act, pressableWithText, renderAsync, texts } from '../../test-utils/render';
import GroupInviteJoinScreen from '../GroupInviteJoinScreen';

jest.mock('../../api/groups', () => ({ joinGroupByInvitation: jest.fn() }));
jest.mock('../../api/publicLinks', () => ({ getPublicGroupInvitation: jest.fn() }));

const TOKEN = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';
const GROUP = '11111111-2222-4333-8444-555555555555';
const nav = { navigate: jest.fn(), replace: jest.fn() };
const props = { navigation: nav } as unknown as React.ComponentProps<typeof GroupInviteJoinScreen>;
const join = joinGroupByInvitation as jest.Mock;

const httpError = (status: number): Error => Object.assign(new Error('x'), { response: { status } });
const networkError = (): Error => Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' });

async function open(): Promise<Awaited<ReturnType<typeof renderAsync>>> {
  setGroupJoinToken(TOKEN);
  (getPublicGroupInvitation as jest.Mock).mockResolvedValue({ group_name: 'Sunday Smashers' });
  return renderAsync(<GroupInviteJoinScreen {...props} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  _resetLinkStoreForTesting();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

describe('GroupInviteJoinScreen', () => {
  it('shows the group name with Join and Not now, and joins nobody on open', async () => {
    const root = await open();
    expect(texts(root)).toContain('Join Sunday Smashers?');
    expect(texts(root)).toContain('Join');
    expect(texts(root)).toContain('Not now');
    expect(join).not.toHaveBeenCalled();
  });

  it('a failed name lookup shows the generic question', async () => {
    setGroupJoinToken(TOKEN);
    (getPublicGroupInvitation as jest.Mock).mockRejectedValue(new Error('x'));
    const root = await renderAsync(<GroupInviteJoinScreen {...props} />);
    expect(texts(root)).toContain('Join this group?');
  });

  it.each(['joined', 'already_member'])('%s opens the group; the token is dropped', async outcome => {
    join.mockResolvedValue({ group_id: GROUP, outcome });
    const root = await open();
    await act(async () => pressableWithText(root, 'Join').props.onPress());
    expect(join).toHaveBeenCalledWith(TOKEN, { correlationId: expect.any(String) });
    expect(nav.replace).toHaveBeenCalledWith('GroupDetail', { groupId: GROUP });
    expect(getGroupJoinToken()).toBeNull();
  });

  it('404: the neutral message, back to the Groups list, token dropped', async () => {
    join.mockRejectedValue(httpError(404));
    const root = await open();
    await act(async () => pressableWithText(root, 'Join').props.onPress());
    expect(Alert.alert).toHaveBeenCalledWith('Group invitation', 'This invitation is not valid any more.');
    expect(nav.replace).toHaveBeenCalledWith('GroupsList');
    expect(getGroupJoinToken()).toBeNull();
  });

  it('network error: stays, shows the generic error, and a retry uses a new correlation ID', async () => {
    join.mockRejectedValueOnce(networkError()).mockResolvedValueOnce({ group_id: GROUP, outcome: 'joined' });
    const root = await open();
    await act(async () => pressableWithText(root, 'Join').props.onPress());
    expect(texts(root)).toContain('Unable to connect to server.');
    expect(nav.replace).not.toHaveBeenCalled();
    expect(getGroupJoinToken()).toBe(TOKEN);

    await act(async () => pressableWithText(root, 'Join').props.onPress());
    expect(join).toHaveBeenCalledTimes(2);
    expect(join.mock.calls[0][1].correlationId).not.toBe(join.mock.calls[1][1].correlationId);
    expect(nav.replace).toHaveBeenCalledWith('GroupDetail', { groupId: GROUP });
  });

  it('Not now drops the token and opens the Groups list without a join call', async () => {
    const root = await open();
    await act(async () => pressableWithText(root, 'Not now').props.onPress());
    expect(join).not.toHaveBeenCalled();
    expect(nav.replace).toHaveBeenCalledWith('GroupsList');
    expect(getGroupJoinToken()).toBeNull();
  });

  it('with no token in memory it goes to the Groups list', async () => {
    await renderAsync(<GroupInviteJoinScreen {...props} />);
    expect(nav.replace).toHaveBeenCalledWith('GroupsList');
    expect(getPublicGroupInvitation).not.toHaveBeenCalled();
  });
});
