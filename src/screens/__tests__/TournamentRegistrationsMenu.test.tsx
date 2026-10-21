/**
 * Tournament registrations show an avatar and open the combined user pop-up from the row only (design
 * UM-12, OI-8, game-view-redesign AD-7: identity, no card request, no actions). A registration with
 * no user id shows a placeholder. The Fixtures | Registrations toggle is gone (GV-7, AD-10): a viewer
 * who cannot read the responses keeps this plain list.
 */
import React from 'react';

import { apiClient } from '../../api/client';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { rawTournament } from '../../test-utils/tournamentDetailHarness';
import TournamentDetailScreen from '../TournamentDetailScreen';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn() }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-me' } }) }));

const mockGet = apiClient.get as jest.Mock;

async function mount(): Promise<Instance> {
  mockGet.mockReset().mockImplementation((url: string) => {
    if (url === '/tournaments/t-1') return Promise.resolve({ data: rawTournament() });
    if (url === '/tournaments/t-1/registrations') {
      return Promise.resolve({
        data: [
          { id: 'r-1', user_id: 'u-dev', participant_name: 'Dev', registered_at: '2999-09-01T10:00:00Z', status: 'registered' },
          { id: 'r-2', user_id: null, participant_name: 'Coach Tan', registered_at: '2999-09-02T10:00:00Z', status: 'registered' },
        ],
      });
    }
    if (url === '/config/client') return Promise.resolve({ data: {} });
    return Promise.resolve({ data: [] });
  });
  const props = {
    route: { key: 'k', name: 'TournamentDetail', params: { tournamentId: 't-1' } },
    navigation: {},
  } as unknown as React.ComponentProps<typeof TournamentDetailScreen>;
  return renderAsync(<TournamentDetailScreen {...props} />);
}

const person = (root: Instance, id: string): Instance =>
  root.find(n => n.props.testID === `registration-${id}` && typeof n.props.onLongPress === 'function');
const urls = (): string[] => mockGet.mock.calls.map(c => String(c[0]));

it('the Fixtures | Registrations tab toggle is gone; Fixtures is a titled section', async () => {
  const root = await mount();
  expect(root.findAll(n => n.props.accessibilityRole === 'tab')).toHaveLength(0);
  expect(texts(root)).toContain('Fixtures');
});

it('a registration with a user opens the pop-up from the row, with no card request and no actions', async () => {
  const root = await mount();
  await act(async () => person(root, 'r-1').props.onPress());
  expect(root.findAll(n => n.props.testID === 'user-menu-details').length).toBeGreaterThan(0);
  expect(texts(root)).toEqual(expect.arrayContaining(['Dev']));
  expect(texts(root)).not.toContain('View Details');
  expect(urls().some(u => u.includes('/card'))).toBe(false);
  await act(async () => person(root, 'r-1').props.onLongPress());
  expect(urls().some(u => u.includes('/card'))).toBe(false);
  expect(root.findAll(n => String(n.props.testID ?? '').startsWith('user-menu-action-'))).toHaveLength(0);
});

it('a registration without a user id still opens the pop-up (placeholder avatar, nickname), no request', async () => {
  const root = await mount();
  await act(async () => person(root, 'r-2').props.onPress());
  expect(texts(root)).toEqual(expect.arrayContaining(['Coach Tan']));
  expect(urls().some(u => u.includes('/card'))).toBe(false);
});
