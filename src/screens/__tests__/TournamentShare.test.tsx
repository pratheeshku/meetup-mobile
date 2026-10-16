/** tournament-share: Share on Tournament Detail, from `my_invite_access` only. */
import { Clipboard, Linking, Share } from 'react-native';

import { ENV } from '../../../config/env';
import { act, pressableLabelled, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { getShareUrl } from '../../utils/shareLink';
import { mockGet, mockPost, mountTournament } from '../../test-utils/tournamentDetailHarness';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn().mockResolvedValue({ items: [] }) }));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn().mockResolvedValue([]) }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-me' } }) }));

const has = (root: Instance, label: string): boolean => texts(root).includes(label);

describe('Share visibility follows my_invite_access', () => {
  it.each([['full'], ['individuals']])('shows Share for %s', async access => {
    expect(has(await mountTournament({ my_invite_access: access }), 'Share app link')).toBe(true);
  });

  it.each([['none'], [null], [undefined], ['bogus']])('hides Share for %p (including flag off)', async access => {
    const root = await mountTournament(access === undefined ? {} : { my_invite_access: access });
    expect(has(root, 'Share app link')).toBe(false);
  });

  it('never derives access from being the organiser', async () => {
    const root = await mountTournament({ organizer_id: 'user-me' });
    expect(has(root, 'Share app link')).toBe(false);
  });
});

describe('Share is the app link and calls no tournament route', () => {
  it('opens the sheet; copy link, WhatsApp and system share use getShareUrl() and make no API call', async () => {
    const root = await mountTournament({ my_invite_access: 'individuals' });
    mockGet.mockClear();
    mockPost.mockClear();

    await act(async () => pressableLabelled(root, 'Share app link').props.onPress());
    expect(has(root, 'Share via WhatsApp')).toBe(true);
    expect(has(root, 'Share via other apps')).toBe(true);
    expect(has(root, 'Copy Link')).toBe(true);

    const setString = jest.spyOn(Clipboard, 'setString');
    await act(async () => pressableLabelled(root, 'Copy Link').props.onPress());
    expect(setString).toHaveBeenCalledWith(getShareUrl());

    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    await act(async () => pressableLabelled(root, 'Share app link').props.onPress());
    await act(async () => {
      await pressableLabelled(root, 'Share via other apps').props.onPress();
    });
    expect(share.mock.calls[0][0].message).toContain(getShareUrl());

    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    await act(async () => pressableLabelled(root, 'Share app link').props.onPress());
    await act(async () => {
      await pressableLabelled(root, 'Share via WhatsApp').props.onPress();
    });
    expect(decodeURIComponent(String(open.mock.calls[0][0]))).toContain(getShareUrl());

    expect(mockGet).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('the URL is the game share URL (/public/share) with no tournament identity', () => {
    expect(getShareUrl()).toBe(`${ENV.API_BASE_URL.replace(/\/+$/, '')}/public/share`);
    expect(getShareUrl()).not.toContain('t-1');
    expect(getShareUrl()).not.toMatch(/tournament/i);
  });
});
