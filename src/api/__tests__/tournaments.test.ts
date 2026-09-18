/**
 * Regression tests for the full-contract-audit fixes to
 * `api/tournaments.ts` (docs/reports/AUDIT-API-CONTRACTS-2026-09-18.md),
 * using fixtures built from the real backend's confirmed OpenAPI schemas
 * (`TournamentResponse`, `TournamentRegistrationResponse`).
 */
import { apiClient } from '../client';
import { getRegistrations, getTournament, getTournaments } from '../tournaments';

jest.mock('../client', () => ({
  apiClient: { get: jest.fn() },
}));

const mockedGet = apiClient.get as jest.Mock;

afterEach(() => {
  mockedGet.mockReset();
});

describe('getTournaments', () => {
  it('wraps the backend\'s bare array response and maps title->name, capacity->max_participants', async () => {
    mockedGet.mockResolvedValueOnce({
      data: [
        {
          id: 't-1',
          organizer_id: 'org-1',
          sport: 'Football',
          title: 'Summer Cup',
          name: null,
          description: 'A cup',
          format: 'knockout',
          capacity: 16,
          registration_closes_at: null,
          starts_at: '2026-10-01T10:00:00Z',
          status: 'upcoming',
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
    });

    const result = await getTournaments();

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 't-1',
      name: 'Summer Cup',
      organiser_id: 'org-1',
      max_participants: 16,
      registration_open: true,
    });
    // Not derivable without a per-tournament extra call — must be the
    // flagged placeholder, never a guessed real-looking value.
    expect(result.items[0].organiser_nickname).toBe('');
    expect(result.items[0].current_user_registration_status).toBe('none');
  });

  it('derives registration_open=false once registration_closes_at is in the past', async () => {
    mockedGet.mockResolvedValueOnce({
      data: [
        {
          id: 't-2',
          organizer_id: 'org-1',
          sport: 'Football',
          title: 'Past Cup',
          name: null,
          description: null,
          format: 'league',
          capacity: 8,
          registration_closes_at: '2020-01-01T00:00:00Z',
          starts_at: '2020-02-01T10:00:00Z',
          status: 'completed',
          created_at: '2019-01-01T00:00:00Z',
        },
      ],
    });

    const result = await getTournaments();
    expect(result.items[0].registration_open).toBe(false);
  });
});

describe('getTournament', () => {
  it('maps a single TournamentResponse the same way as the list', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        id: 't-1',
        organizer_id: 'org-1',
        sport: 'Football',
        title: 'Summer Cup',
        name: null,
        description: 'A cup',
        format: 'knockout',
        capacity: 16,
        registration_closes_at: null,
        starts_at: '2026-10-01T10:00:00Z',
        status: 'upcoming',
        created_at: '2026-01-01T00:00:00Z',
      },
    });

    const result = await getTournament('t-1');
    expect(result.name).toBe('Summer Cup');
    expect(result.max_participants).toBe(16);
  });
});

describe('getRegistrations', () => {
  it('maps participant_name->nickname and carries through status/nullable user_id', async () => {
    mockedGet.mockResolvedValueOnce({
      data: [
        {
          id: 'r-1',
          tournament_id: 't-1',
          user_id: null,
          team_id: 'team-1',
          registered_by_user_id: 'u-1',
          status: 'registered',
          seed_number: null,
          declared_skill_score: null,
          strength_score: null,
          registered_at: '2026-01-05T00:00:00Z',
          participant_name: 'The Strikers',
        },
      ],
    });

    const result = await getRegistrations('t-1');
    expect(result[0]).toMatchObject({
      id: 'r-1',
      user_id: null,
      nickname: 'The Strikers',
      status: 'registered',
    });
  });
});
