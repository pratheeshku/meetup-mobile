/**
 * Share app link on Profile (DES-MEETUP-ADDENDUM-nov24-enhancements NV-04, AD-6): the button opens the existing share
 * options with the admin invite message and the store lines, no game or group link; hidden while neither store URL is
 * published in GET /config/client.
 */
import React from 'react';

import { getClientConfig } from '../../api/config';
import { createGroupInvitation } from '../../api/groups';
import { useLabels } from '../../labels/LabelsContext';
import { act, pressableWithText, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { shareGeneric, shareToWhatsApp } from '../../utils/shareLink';
import ProfileScreen from '../ProfileScreen';

jest.mock('../../api/config', () => ({ getClientConfig: jest.fn() }));
jest.mock('../../labels/LabelsContext', () => ({
  ...jest.requireActual('../../labels/LabelsContext'),
  useLabels: jest.fn(),
}));
jest.mock('../../utils/shareLink', () => ({
  ...jest.requireActual('../../utils/shareLink'),
  shareGeneric: jest.fn(),
  shareToWhatsApp: jest.fn(),
}));
jest.mock('../../api/mobileNumber', () => ({
  getMobileConsent: jest.fn(() => Promise.reject(new Error('x'))),
  getCountryCodes: jest.fn(() => Promise.reject(new Error('x'))),
  updateMobileNumber: jest.fn(),
  classifyMobileNumberError: jest.fn(() => 'other'),
}));
jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ signOut: jest.fn(), updateUser: jest.fn(), user: { id: 'u-1', display_name: 'Sam Smith' } }),
}));
jest.mock('../../api/profile', () => ({
  getProfile: jest.fn().mockResolvedValue({
    id: 'u-1', email: 'a@b.c', nickname: 'sam99', display_name: 'Sam Smith', skill_levels: [],
  }),
  getProfileSummary: jest.fn().mockResolvedValue({
    games_played: 0, games_hosted: 0, groups_count: 0, recent_games: [],
  }),
}));
jest.mock('../../api/groups', () => ({
  getMyGroups: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  createGroupInvitation: jest.fn(),
}));
jest.mock('../../api/home', () => ({ getCachedBanners: jest.fn().mockResolvedValue(null) }));
jest.mock('../../api/sports', () => ({ getSports: jest.fn().mockResolvedValue([]) }));

const LABELS = {
  'share.invite_message': 'Join GameOn SG, from {name}\n{store_links}',
  'share.invite_android_line': 'Android: {url}',
  'share.invite_ios_line': 'iPhone: {url}',
};
const SHARE_APP = 'Share app link';

const config = (android: string, ios: string) => ({ android_store_url: android, ios_store_url: ios, link_base_url: 'https://links.example' });

const mount = async (): Promise<Instance> => {
  const props = { navigation: { navigate: jest.fn() }, route: {} } as unknown as React.ComponentProps<typeof ProfileScreen>;
  const root = await renderAsync(<ProfileScreen {...props} />);
  await act(async () => {
    await Promise.resolve();
  });
  return root;
};

beforeEach(() => {
  jest.clearAllMocks();
  (useLabels as jest.Mock).mockReturnValue(LABELS);
});

it.each([
  ['Android only', config('https://play.google.com/store/apps/details?id=org.duckdns.meetups', '')],
  ['iOS only', config('', 'https://apps.apple.com/app/id1')],
  ['both', config('https://play.google.com/x', 'https://apps.apple.com/x')],
])('is shown when a store URL is published (%s)', async (_label, value) => {
  (getClientConfig as jest.Mock).mockResolvedValue(value);
  expect(texts(await mount())).toContain(SHARE_APP);
});

it('is hidden when neither store URL is published', async () => {
  (getClientConfig as jest.Mock).mockResolvedValue(config('', ''));
  expect(texts(await mount())).not.toContain(SHARE_APP);
});

it('opens the share options and shares the invite message with the store lines, no game or group link', async () => {
  (getClientConfig as jest.Mock).mockResolvedValue(config('https://play.google.com/x', 'https://apps.apple.com/x'));
  const root = await mount();

  await act(async () => {
    pressableWithText(root, SHARE_APP).props.onPress();
  });
  // The existing share sheet, titled with the button's label, offers the existing options.
  expect(texts(root).filter(text => text === SHARE_APP).length).toBeGreaterThanOrEqual(2);

  const sheet = root.findAll(node => typeof node.props.onShareGeneric === 'function')[0];
  await act(async () => {
    await sheet.props.onShareGeneric();
  });
  expect(shareGeneric).toHaveBeenCalledWith({
    message: 'Join GameOn SG, from Sam Smith\nAndroid: https://play.google.com/x\niPhone: https://apps.apple.com/x',
  });

  await act(async () => {
    await sheet.props.onShareWhatsApp();
  });
  expect(shareToWhatsApp).toHaveBeenCalledWith(
    'Join GameOn SG, from Sam Smith\nAndroid: https://play.google.com/x\niPhone: https://apps.apple.com/x',
  );
  expect(createGroupInvitation).not.toHaveBeenCalled();
});
