/**
 * TASK 3.1: useAppShare sends the invite message; group share adds the invite link.
 */
import React from 'react';
import { act, create } from 'react-test-renderer';

import { getClientConfig } from '../../api/config';
import { createGroupInvitation } from '../../api/groups';
import { useLabels } from '../../labels/LabelsContext';
import type { ShareTarget } from '../../links/shareLinks';
import { shareGeneric, shareToWhatsApp } from '../../utils/shareLink';
import { useAppShare } from '../useAppShare';
import type { AppShare } from '../useAppShare';

jest.mock('../../api/config', () => ({ getClientConfig: jest.fn() }));
jest.mock('../../labels/LabelsContext', () => ({
  ...jest.requireActual('../../labels/LabelsContext'),
  useLabels: jest.fn(),
}));
jest.mock('../../api/groups', () => ({ createGroupInvitation: jest.fn() }));
jest.mock('../../utils/shareLink', () => ({
  ...jest.requireActual('../../utils/shareLink'),
  shareGeneric: jest.fn(),
  shareToWhatsApp: jest.fn(),
}));

const LABELS = {
  'share.invite_message': 'Join GameOn SG 📲\n{store_links}',
  'share.invite_android_line': '🤖 {url}',
  'share.invite_ios_line': '🍎 {url}',
};
const LINK = 'https://api.example/public/group-invite/abc';

function mountHook(
  labels: Record<string, string>,
  groupId?: string,
  target?: ShareTarget,
): { current: () => AppShare } {
  let latest: AppShare | undefined;
  function Probe(): null {
    latest = useAppShare(groupId, target);
    return null;
  }
  (useLabels as jest.Mock).mockReturnValue(labels);
  act(() => {
    create(<Probe />);
  });
  return { current: () => latest as AppShare };
}

beforeEach(() => {
  jest.clearAllMocks();
  (getClientConfig as jest.Mock).mockResolvedValue({ android_store_url: 'https://play.example', ios_store_url: '' });
  (createGroupInvitation as jest.Mock).mockResolvedValue({ token: 't', invitation_url: LINK });
});

it('game / tournament share sends the message only and creates no invitation', async () => {
  const hook = mountHook(LABELS);
  await act(async () => hook.current().shareViaSystem());
  expect(shareGeneric).toHaveBeenCalledWith({ message: 'Join GameOn SG 📲\n🤖 https://play.example' });
  expect(createGroupInvitation).not.toHaveBeenCalled();
});

it('group share appends a blank line and the invite link', async () => {
  const hook = mountHook(LABELS, 'g1');
  await act(async () => hook.current().shareViaWhatsApp());
  expect(shareToWhatsApp).toHaveBeenCalledWith(`Join GameOn SG 📲\n🤖 https://play.example\n\n${LINK}`);
});

it('does not share (or create an invitation) when share.invite_message is missing', async () => {
  const hook = mountHook({}, 'g1');
  await act(async () => hook.current().shareViaSystem());
  expect(shareGeneric).not.toHaveBeenCalled();
  expect(createGroupInvitation).not.toHaveBeenCalled();
});

describe('game and tournament links (deep-links AD-11)', () => {
  const MESSAGE = 'Join GameOn SG 📲\n🤖 https://play.example';
  const GAME: ShareTarget = { kind: 'game', eventId: 'e1' };
  const TOURNAMENT: ShareTarget = { kind: 'tournament', tournamentId: 't1' };
  const withConfig = (extra: Record<string, unknown>): void => {
    (getClientConfig as jest.Mock).mockResolvedValue({ android_store_url: 'https://play.example', ios_store_url: '', ...extra });
  };

  it('ends with a blank line and the hash-form link when the switch is off', async () => {
    withConfig({ link_base_url: 'https://links.example', app_links_enabled: false });
    const hook = mountHook(LABELS, undefined, GAME);
    await act(async () => hook.current().shareViaSystem());
    // No signed-in user in this test, so no ref.
    expect(shareGeneric).toHaveBeenCalledWith({ message: `${MESSAGE}\n\nhttps://links.example/#event-detail/e1` });
    expect(createGroupInvitation).not.toHaveBeenCalled();
  });

  it('uses the /l/ form for a tournament when the switch is on', async () => {
    withConfig({ link_base_url: 'https://links.example', app_links_enabled: true });
    const hook = mountHook(LABELS, undefined, TOURNAMENT);
    await act(async () => hook.current().shareViaWhatsApp());
    expect(shareToWhatsApp).toHaveBeenCalledWith(`${MESSAGE}\n\nhttps://links.example/l/tournament/t1`);
  });

  it('shares the message only when there is no base', async () => {
    withConfig({ link_base_url: null, app_links_enabled: true });
    const hook = mountHook(LABELS, undefined, GAME);
    await act(async () => hook.current().shareViaSystem());
    expect(shareGeneric).toHaveBeenCalledWith({ message: MESSAGE });
  });

  it('a failing config call does not abort the share: the message (no store lines, no link) still goes out', async () => {
    (getClientConfig as jest.Mock).mockRejectedValue(new Error('offline'));
    const hook = mountHook(LABELS, undefined, GAME);
    await act(async () => hook.current().shareViaSystem());
    expect(shareGeneric).toHaveBeenCalledWith({ message: 'Join GameOn SG 📲\n' });
  });

  it('a group share keeps the server invitation_url unchanged, whatever the link settings', async () => {
    withConfig({ link_base_url: 'https://links.example', app_links_enabled: true });
    const hook = mountHook(LABELS, 'g1');
    await act(async () => hook.current().shareViaSystem());
    expect(shareGeneric).toHaveBeenCalledWith({ message: `${MESSAGE}\n\n${LINK}` });
  });
});
