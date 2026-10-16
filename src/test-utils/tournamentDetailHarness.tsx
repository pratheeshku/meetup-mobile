/** Shared mount helper for the TournamentDetail share/invite/respond tests (not a test file). */
import React from 'react';

import { apiClient } from '../api/client';
import TournamentDetailScreen from '../screens/TournamentDetailScreen';
import { renderAsync } from './render';
import type { Instance } from './render';

type Props = React.ComponentProps<typeof TournamentDetailScreen>;

export const mockGet = apiClient.get as jest.Mock;
export const mockPost = apiClient.post as jest.Mock;

/** Raw `TournamentResponse` for `GET /tournaments/t-1` (organiser is someone else). */
export function rawTournament(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 't-1',
    organizer_id: 'organiser-1',
    sport: 'badminton',
    title: 'Summer Smash',
    name: null,
    description: 'A cup',
    format: 'knockout',
    capacity: 8,
    registration_closes_at: null,
    starts_at: '2999-10-01T10:00:00Z',
    status: 'upcoming',
    created_at: '2026-09-01T10:00:00Z',
    ...overrides,
  };
}

/** `current` is read on every GET so a test can change what the server returns next. */
export const server = { tournament: rawTournament() as Record<string, unknown> };

export async function mountTournament(overrides: Record<string, unknown> = {}): Promise<Instance> {
  server.tournament = rawTournament(overrides);
  mockGet.mockReset().mockImplementation((url: string) => {
    if (url === '/tournaments/t-1') return Promise.resolve({ data: server.tournament });
    if (url === '/tournaments/t-1/fixtures') return Promise.resolve({ data: [] });
    if (url === '/tournaments/t-1/registrations') return Promise.resolve({ data: [] });
    if (url === '/config/client') return Promise.resolve({ data: {} });
    return Promise.resolve({ data: [] });
  });
  mockPost.mockReset().mockResolvedValue({ data: {} });
  const props = {
    route: { key: 'k', name: 'TournamentDetail', params: { tournamentId: 't-1' } },
    navigation: {},
  } as unknown as Props;
  return renderAsync(<TournamentDetailScreen {...props} />);
}

/** Calls to the tournament API made after `mountTournament` returned. */
export const tournamentCalls = (): string[] =>
  [...mockGet.mock.calls, ...mockPost.mock.calls]
    .map(c => String(c[0]))
    .filter(url => url.startsWith('/tournaments'));
