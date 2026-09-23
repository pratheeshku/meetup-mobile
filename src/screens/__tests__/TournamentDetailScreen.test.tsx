/**
 * TournamentDetailScreen — sport display-name resolution (BUG-M02
 * remainder). Narrow, purpose-built coverage: this screen had no test file
 * before this fix; a full behavioural suite for its registration/fixtures/
 * cancel flows is out of scope for this task.
 */
import React from 'react';

import { getFixtures, getRegistrations, getTournament } from '../../api/tournaments';
import { getSports } from '../../api/sports';
import { renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { __resetSportDisplayNamesCacheForTests } from '../../utils/labels';
import type { Tournament } from '../../types/tournament';
import TournamentDetailScreen from '../TournamentDetailScreen';

type Props = React.ComponentProps<typeof TournamentDetailScreen>;

jest.mock('../../api/tournaments', () => ({
  getTournament: jest.fn(),
  getFixtures: jest.fn(),
  getRegistrations: jest.fn(),
  registerForTournament: jest.fn(),
  withdrawFromTournament: jest.fn(),
  cancelTournament: jest.fn(),
}));
jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-me' } }),
}));

const mockGetTournament = getTournament as jest.MockedFunction<typeof getTournament>;
const mockGetFixtures = getFixtures as jest.MockedFunction<typeof getFixtures>;
const mockGetRegistrations = getRegistrations as jest.MockedFunction<typeof getRegistrations>;
const mockGetSports = getSports as jest.MockedFunction<typeof getSports>;

const TOURNAMENT: Tournament = {
  id: 't-1',
  name: 'Summer Smash',
  description: '',
  sport: 'table_tennis',
  organiser_id: 'organiser-1',
  organiser_nickname: 'org',
  format: 'knockout',
  status: 'upcoming',
  registration_open: true,
  participant_count: 4,
  max_participants: 8,
  starts_at: '2026-10-01T10:00:00Z',
  created_at: '2026-09-01T10:00:00Z',
  current_user_registration_status: 'none',
  is_organiser: false,
};

const mount = (): Promise<Instance> =>
  renderAsync(
    <TournamentDetailScreen
      {...({
        route: { key: 'k', name: 'TournamentDetail', params: { tournamentId: 't-1' } },
        navigation: {},
      } as unknown as Props)}
    />,
  );

beforeEach(() => {
  mockGetTournament.mockReset().mockResolvedValue(TOURNAMENT);
  mockGetFixtures.mockReset().mockResolvedValue([]);
  mockGetRegistrations.mockReset().mockResolvedValue([]);
  mockGetSports.mockReset().mockRejectedValue(new Error('down'));
  __resetSportDisplayNamesCacheForTests();
});

describe('sport display name (BUG-M02)', () => {
  it('falls back to the raw sport slug when the sports list fails to load', async () => {
    const root = await mount();
    expect(texts(root)).toContain('table_tennis · knockout');
  });

  it('resolves the sport slug to its display_name from GET /admin/sports/public', async () => {
    mockGetSports.mockResolvedValue([{ name: 'table_tennis', display_name: 'Table Tennis' }]);
    const root = await mount();
    expect(texts(root)).toContain('Table Tennis · knockout');
  });
});
