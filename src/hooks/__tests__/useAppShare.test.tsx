/**
 * TASK 3.1: useAppShare sends the invite message; group share adds the invite link.
 */
import React from 'react';
import { act, create } from 'react-test-renderer';

import { getClientConfig } from '../../api/config';
import { createGroupInvitation } from '../../api/groups';
import { useLabels } from '../../labels/LabelsContext';
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

function mountHook(labels: Record<string, string>, groupId?: string): { current: () => AppShare } {
  let latest: AppShare | undefined;
  function Probe(): null {
    latest = useAppShare(groupId);
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
