/**
 * Tournaments list: refresh-after-create only. The direct "+" header entry
 * point was removed (Create Flow Amendment, §4.3/§4.5, architect-approved
 * 2026-09-22) — tournament creation now happens via the Home tab's merged
 * Create Game screen, which lands back here with a fresh `refreshKey` on
 * success (see `CreateGameScreen.test.tsx`).
 */
import React from 'react';

import { getTournaments } from '../../api/tournaments';
import { renderAsync } from '../../test-utils/render';
import TournamentsScreen from '../TournamentsScreen';

type Props = React.ComponentProps<typeof TournamentsScreen>;

jest.mock('../../api/tournaments', () => ({ getTournaments: jest.fn() }));

const mockGetTournaments = getTournaments as jest.MockedFunction<typeof getTournaments>;
const navigate = jest.fn();
const setOptions = jest.fn();
const EMPTY = { items: [], total: 0, page: 1, page_size: 0 };

function element(params?: { refreshKey?: number }): React.ReactElement {
  const props = { navigation: { navigate, setOptions }, route: { params } };
  return <TournamentsScreen {...(props as unknown as Props)} />;
}

beforeEach(() => {
  mockGetTournaments.mockReset().mockResolvedValue(EMPTY);
  navigate.mockReset();
  setOptions.mockReset();
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
