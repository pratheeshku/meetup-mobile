/** dashboard-profile-stats: the stats strip is no longer on Profile; recent games stay. */
import React from 'react';

import { renderAsync, texts } from '../../test-utils/render';
import ProfileScreen from '../ProfileScreen';

jest.mock('../../api/mobileNumber', () => ({
  getMobileConsent: jest.fn(() => Promise.reject(new Error('x'))),
  getCountryCodes: jest.fn(() => Promise.reject(new Error('x'))),
  updateMobileNumber: jest.fn(),
  classifyMobileNumberError: jest.fn(() => 'other'),
}));
jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ signOut: jest.fn(), updateUser: jest.fn() }),
}));
jest.mock('../../api/profile', () => ({
  getProfile: jest.fn().mockResolvedValue({
    id: 'u-1', email: 'a@b.c', nickname: 'sam99', display_name: 'Sam Smith', skill_levels: [],
  }),
  getProfileSummary: jest.fn().mockResolvedValue({
    games_played: 12, games_hosted: 3, groups_count: 2, games_won: 4,
    recent_games: [{ id: 'g1', title: 'Friday doubles', sport: 'badminton', starts_at: '2026-09-25T18:00:00Z', venue_name: 'Hall' }],
  }),
}));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn().mockResolvedValue({ items: [], total: 0 }) }));
jest.mock('../../api/home', () => ({ getCachedBanners: jest.fn().mockResolvedValue(null) }));
jest.mock('../../api/sports', () => ({ getSports: jest.fn().mockResolvedValue([]) }));

it('Profile shows no stats strip but keeps recent games', async () => {
  const props = { navigation: { navigate: jest.fn() }, route: {} } as unknown as React.ComponentProps<typeof ProfileScreen>;
  const root = await renderAsync(<ProfileScreen {...props} />);
  expect(root.findAll(n => n.props.testID === 'profile-stats-strip')).toHaveLength(0);
  const all = texts(root);
  expect(all).not.toContain('Played');
  expect(all).not.toContain('Hosted');
  expect(all).not.toContain('Won');
  expect(all).toContain('Friday doubles');
});
