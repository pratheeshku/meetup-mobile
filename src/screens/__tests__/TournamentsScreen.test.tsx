/**
 * Tournaments list: refresh-after-create only. The direct "+" header entry
 * point was removed (Create Flow Amendment, §4.3/§4.5, architect-approved
 * 2026-09-22) — tournament creation now happens via the Home tab's merged
 * Create Game screen, which lands back here with a fresh `refreshKey` on
 * success (see `CreateGameScreen.test.tsx`).
 */
import React from 'react';

import { getTournaments } from '../../api/tournaments';
import { getSports } from '../../api/sports';
import { renderAsync, texts } from '../../test-utils/render';
import { __resetSportDisplayNamesCacheForTests } from '../../utils/labels';
import type { Tournament } from '../../types/tournament';
import TournamentsScreen from '../TournamentsScreen';

type Props = React.ComponentProps<typeof TournamentsScreen>;

jest.mock('../../api/tournaments', () => ({ getTournaments: jest.fn() }));
jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));

const mockGetTournaments = getTournaments as jest.MockedFunction<typeof getTournaments>;
const mockGetSports = getSports as jest.MockedFunction<typeof getSports>;
const navigate = jest.fn();
const setOptions = jest.fn();
const EMPTY = { items: [], total: 0, page: 1, page_size: 0 };

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

function element(params?: { refreshKey?: number }): React.ReactElement {
  const props = { navigation: { navigate, setOptions }, route: { params } };
  return <TournamentsScreen {...(props as unknown as Props)} />;
}

beforeEach(() => {
  mockGetTournaments.mockReset().mockResolvedValue(EMPTY);
  mockGetSports.mockReset().mockRejectedValue(new Error('down'));
  navigate.mockReset();
  setOptions.mockReset();
  __resetSportDisplayNamesCacheForTests();
});

describe('TournamentsScreen refresh after create', () => {
  it('loads once on a normal mount', async () => {
    await renderAsync(element());
    expect(mockGetTournaments).toHaveBeenCalledTimes(1);
  });

  it('re-fetches when returned to with a refreshKey', async () => {
    await renderAsync(element({ refreshKey: 123 }));
    expect(mockGetTournaments).toHaveBeenCalledTimes(2);
  });

  it('no longer sets a header "+" button (creation moved to Create Game)', async () => {
    await renderAsync(element());
    expect(setOptions).not.toHaveBeenCalled();
  });
});

describe('sport display name (BUG-M02)', () => {
  it('falls back to the raw sport slug when the sports list fails to load', async () => {
    mockGetTournaments.mockResolvedValue({ items: [TOURNAMENT], total: 1, page: 1, page_size: 1 });
    const root = await renderAsync(element());
    expect(texts(root)).toContain('table_tennis · knockout');
  });

  it('resolves the sport slug to its display_name from GET /admin/sports/public', async () => {
    mockGetTournaments.mockResolvedValue({ items: [TOURNAMENT], total: 1, page: 1, page_size: 1 });
    mockGetSports.mockResolvedValue([{ name: 'table_tennis', display_name: 'Table Tennis' }]);
    const root = await renderAsync(element());
    expect(texts(root)).toContain('Table Tennis · knockout');
  });
});
