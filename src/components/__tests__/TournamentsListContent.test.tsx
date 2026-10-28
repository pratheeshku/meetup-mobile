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
import { act, renderAsync, texts } from '../../test-utils/render';
import { __resetSportDisplayNamesCacheForTests } from '../../utils/labels';
import type { Tournament } from '../../types/tournament';
import TournamentsListContent from '../TournamentsListContent';

jest.mock('../../api/tournaments', () => ({ getTournaments: jest.fn() }));
jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));

const mockGetTournaments = getTournaments as jest.MockedFunction<typeof getTournaments>;
const mockGetSports = getSports as jest.MockedFunction<typeof getSports>;
const onOpenTournament = jest.fn();
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
  return (
    <TournamentsListContent onOpenTournament={onOpenTournament} refreshKey={params?.refreshKey} />
  );
}

beforeEach(() => {
  mockGetTournaments.mockReset().mockResolvedValue(EMPTY);
  mockGetSports.mockReset().mockRejectedValue(new Error('down'));
  onOpenTournament.mockReset();
  __resetSportDisplayNamesCacheForTests();
});

describe('TournamentsListContent refresh after create', () => {
  it('loads once on a normal mount', async () => {
    await renderAsync(element());
    expect(mockGetTournaments).toHaveBeenCalledTimes(1);
  });

  it('re-fetches when returned to with a refreshKey', async () => {
    await renderAsync(element({ refreshKey: 123 }));
    expect(mockGetTournaments).toHaveBeenCalledTimes(2);
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

const list = (...items: Tournament[]) => ({ items, total: items.length, page: 1, page_size: items.length });

describe('tournament card (matches the game card)', () => {
  it('renders every field: date tile, title, date, venue, sport/format, count, button', async () => {
    mockGetTournaments.mockResolvedValue(
      list({ ...TOURNAMENT, venue_name: 'Bishan Hall', current_user_registration_status: 'registered' }),
    );
    const root = await renderAsync(element());
    const all = texts(root);
    expect(root.findAll(n => n.props.testID === 'date-block').length).toBeGreaterThan(0);
    expect(all).toEqual(
      expect.arrayContaining([
        'Summer Smash',
        'Bishan Hall',
        'table_tennis · knockout',
        '4 registered',
        'View tournament',
        'Registered',
      ]),
    );
  });

  it.each([
    ['none', 'Not Registered'],
    ['registered', 'Registered'],
    ['withdrawn', 'Withdrawn'],
  ] as const)('shows the %s registration badge', async (status, label) => {
    mockGetTournaments.mockResolvedValue(list({ ...TOURNAMENT, current_user_registration_status: status }));
    expect(texts(await renderAsync(element()))).toContain(label);
  });

  it('hides the count and the registration text when unknown (null), never 0 or Not Registered', async () => {
    mockGetTournaments.mockResolvedValue(
      list({ ...TOURNAMENT, participant_count: null, current_user_registration_status: null }),
    );
    const all = texts(await renderAsync(element())).join(' | ');
    expect(all).not.toMatch(/registered/i);
    expect(all).not.toContain('0/8');
    expect(all).not.toContain('Not Registered');
    expect(all).toContain('Summer Smash');
  });

  it('shows a real zero count when the backend sends 0', async () => {
    mockGetTournaments.mockResolvedValue(list({ ...TOURNAMENT, participant_count: 0 }));
    expect(texts(await renderAsync(element()))).toContain('0 registered');
  });

  it('shows the Full chip when the API says is_full, and never the cap (AD-1)', async () => {
    mockGetTournaments.mockResolvedValue(list({ ...TOURNAMENT, participant_count: 8, is_full: true }));
    const all = texts(await renderAsync(element()));
    expect(all).toContain('8 registered');
    expect(all).toContain('Full');
    expect(all.join(' | ')).not.toMatch(/8\/8|of 8/);
    mockGetTournaments.mockResolvedValue(list({ ...TOURNAMENT, participant_count: 7, is_full: false }));
    expect(texts(await renderAsync(element()))).not.toContain('Full');
  });

  it('falls back to Location TBC with no venue and omits avatars', async () => {
    mockGetTournaments.mockResolvedValue(list(TOURNAMENT));
    const root = await renderAsync(element());
    expect(texts(root)).toContain('Location TBC');
    expect(root.findAll(n => n.props.accessibilityRole === 'image')).toHaveLength(0);
  });

  it('tapping a card opens that tournament', async () => {
    mockGetTournaments.mockResolvedValue(list(TOURNAMENT));
    const root = await renderAsync(element());
    // The card is the outermost button; its venue and invite-type lines are buttons of their own (tournament-registration AD-7).
    const card = root.findAll(n => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function')[0];
    await act(async () => card.props.onPress());
    expect(onOpenTournament).toHaveBeenCalledWith('t-1');
  });

  it('shows the empty state for an empty list', async () => {
    const all = texts(await renderAsync(element()));
    expect(all).toContain('No tournaments yet');
  });

  it('makes no per-row network calls: one list call and at most one shared sports lookup for many rows', async () => {
    mockGetTournaments.mockResolvedValue(
      list(TOURNAMENT, { ...TOURNAMENT, id: 't-2' }, { ...TOURNAMENT, id: 't-3' }),
    );
    await renderAsync(element());
    expect(mockGetTournaments).toHaveBeenCalledTimes(1);
    expect(mockGetSports.mock.calls.length).toBeLessThanOrEqual(1);
  });
});
