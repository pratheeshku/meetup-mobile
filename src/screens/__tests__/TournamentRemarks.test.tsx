/** Remarks on the tournament page (team-screens-remarks AD-4, TS-11, TS-T13): titled, only when non-empty, plain text, on both pages. */
import React from 'react';

import TournamentDetailScreen from '../TournamentDetailScreen';
import { renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { mockGet, mockPost, rawTournament } from '../../test-utils/tournamentDetailHarness';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn(), delete: jest.fn() } }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn().mockResolvedValue({ items: [] }) }));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn().mockResolvedValue([]) }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-me' } }) }));

type Props = React.ComponentProps<typeof TournamentDetailScreen>;

const TABS = {
  overview: { state: 'open' },
  participants: { state: 'open' },
  fixtures: { state: 'locked', unlocks: 'fixtures_published' },
  standings: { state: 'locked', unlocks: 'fixtures_published' },
  results: { state: 'locked', unlocks: 'tournament_closed' },
  media: { state: 'locked', unlocks: 'play_starts' },
};
const STATE = { enabled: true, applicable: true, registration_phase: 'open', is_committee: false, fixtures_published: false, any_result_posted: false, committee: null, tabs: TABS, live_poll_seconds: 10 };

async function mount(overrides: Record<string, unknown>): Promise<Instance> {
  const tournament = rawTournament({ organizer_id: 'organiser-1', registration_open: true, ends_at: '2999-10-02T10:00:00Z', participation_mode: 'individual', visibility: 'public', ...overrides });
  mockGet.mockReset().mockImplementation((url: string) => {
    if (url === '/tournaments/t-1') return Promise.resolve({ data: tournament });
    if (url === '/tournaments/t-1/scoring/state') return overrides.lifecycle_version === 1 ? Promise.reject({ response: { status: 404 } }) : Promise.resolve({ data: STATE });
    if (url === '/tournaments/t-1/registrations') return Promise.resolve({ data: [] });
    if (url === '/tournaments/t-1/closure') return Promise.reject({ response: { status: 403 } });
    if (url === '/home/court-booking') return Promise.resolve({ data: { items: [] } });
    if (url === '/config/client') return Promise.resolve({ data: {} });
    return Promise.resolve({ data: [] });
  });
  mockPost.mockReset().mockResolvedValue({ data: {} });
  const props = { route: { key: 'k', name: 'TournamentDetail', params: { tournamentId: 't-1' } }, navigation: { navigate: jest.fn() } } as unknown as Props;
  return renderAsync(<TournamentDetailScreen {...props} />);
}

const byId = (root: Instance, id: string): Instance[] => root.findAll(n => n.props.testID === id && typeof n.type === 'string');

describe.each([
  ['overview (lifecycle version 2)', { lifecycle_version: 2 }, 'overview-remarks'],
  ['legacy page (version 1)', { lifecycle_version: 1 }, 'tournament-remarks'],
])('%s', (_name, version, testID) => {
  it('shows Remarks with the text, as typed', async () => {
    const root = await mount({ ...version, description: 'Bring your own shuttles <b>please</b>' });
    expect(byId(root, testID)).toHaveLength(1);
    expect(texts(root)).toEqual(expect.arrayContaining(['Remarks', 'Bring your own shuttles <b>please</b>']));
  });

  it.each([[''], ['   '], [null]])('shows nothing when the remarks are %p', async description => {
    const root = await mount({ ...version, description });
    expect(byId(root, testID)).toHaveLength(0);
    expect(texts(root)).not.toContain('Remarks');
  });
});
