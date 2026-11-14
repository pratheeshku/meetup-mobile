/** tournament-share: Share on Tournament Detail, from `my_invite_access` only. */
import { Clipboard, Linking, Share } from 'react-native';

import { ENV } from '../../../config/env';
import { act, pressableLabelled, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { getShareUrl } from '../../utils/shareLink';
import { mockGet, mockPost, mountTournament, tournamentCalls } from '../../test-utils/tournamentDetailHarness';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn().mockResolvedValue({ items: [] }) }));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn().mockResolvedValue([]) }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-me' } }) }));

// The share text is the admin-label invite message (utils/shareInvite) and, since deep-links AD-11, ends with
// a blank line and the tournament link built from GET /config/client (links/shareLinks).
const mockLabels: Record<string, string> = {
  'share.invite_message': 'Join GameOn SG 📲\n{store_links}',
  'share.invite_android_line': '🤖 {url}',
};
jest.mock('../../labels/LabelsContext', () => ({
  ...jest.requireActual('../../labels/LabelsContext'),
  useLabels: () => mockLabels,
}));
const CLIENT_CONFIG = {
  android_store_url: 'https://play.example',
  link_base_url: 'https://links.example',
  app_links_enabled: true,
};
const EXPECTED_MESSAGE = 'Join GameOn SG 📲\n🤖 https://play.example\n\nhttps://links.example/l/tournament/t-1';

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

describe('Share: invite message plus the tournament link, and no tournament route is called', () => {
  it('opens the sheet; Copy Link copies the app share URL; WhatsApp and system share end with the tournament link', async () => {
    const root = await mountTournament({ my_invite_access: 'individuals' });
    mockGet.mockClear();
    mockPost.mockClear();
    // After mount only the client config is read (the link base and switch).
    mockGet.mockImplementation((url: string) => Promise.resolve({ data: url === '/config/client' ? CLIENT_CONFIG : [] }));

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
    expect(share).toHaveBeenCalledWith({ message: EXPECTED_MESSAGE });

    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    await act(async () => pressableLabelled(root, 'Share app link').props.onPress());
    await act(async () => {
      await pressableLabelled(root, 'Share via WhatsApp').props.onPress();
    });
    expect(decodeURIComponent(String(open.mock.calls[0][0]))).toContain(EXPECTED_MESSAGE);

    expect(tournamentCalls()).toEqual([]);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('with the link switch off the message ends with the hash-form tournament link', async () => {
    const root = await mountTournament({ my_invite_access: 'full' });
    mockGet.mockImplementation((url: string) =>
      Promise.resolve({ data: url === '/config/client' ? { ...CLIENT_CONFIG, app_links_enabled: false } : [] }),
    );
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    await act(async () => pressableLabelled(root, 'Share app link').props.onPress());
    await act(async () => {
      await pressableLabelled(root, 'Share via other apps').props.onPress();
    });
    expect(share).toHaveBeenCalledWith({
      message: 'Join GameOn SG 📲\n🤖 https://play.example\n\nhttps://links.example/#tournament-detail/t-1',
    });
  });

  it('the URL is the game share URL (/public/share) with no tournament identity', () => {
    expect(getShareUrl()).toBe(`${ENV.API_BASE_URL.replace(/\/+$/, '')}/public/share`);
    expect(getShareUrl()).not.toContain('t-1');
    expect(getShareUrl()).not.toMatch(/tournament/i);
  });
});
