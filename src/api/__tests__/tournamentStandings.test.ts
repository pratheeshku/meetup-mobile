import { apiClient } from '../client';
import { getTournamentScoringState, getTournamentStandings } from '../tournaments';
import { STANDINGS_RAW } from '../../test-utils/scoringFixtures';

jest.mock('../client', () => ({ apiClient: { get: jest.fn() } }));
const get = apiClient.get as jest.Mock;

describe('getTournamentStandings', () => {
  beforeEach(() => get.mockReset());

  it('calls the standings route and returns the normalised v2 view', async () => {
    get.mockResolvedValue({ data: STANDINGS_RAW });
    const view = await getTournamentStandings('t-1', { correlationId: 'c-1' });
    expect(get).toHaveBeenCalledWith('/tournaments/t-1/standings', { correlationId: 'c-1' });
    expect(view?.groups).toHaveLength(3);
  });

  it('returns null for the v1 list, an unpublished fixture and a 404', async () => {
    get.mockResolvedValueOnce({ data: [{ id: 'f1' }] });
    expect(await getTournamentStandings('t-1')).toBeNull();
    get.mockResolvedValueOnce({ data: { published: false, groups: [], knockout: [] } });
    expect(await getTournamentStandings('t-1')).toBeNull();
    get.mockRejectedValueOnce({ response: { status: 404 } });
    expect(await getTournamentStandings('t-1')).toBeNull();
  });

  it('propagates other errors', async () => {
    get.mockRejectedValueOnce({ response: { status: 500 } });
    await expect(getTournamentStandings('t-1')).rejects.toEqual({ response: { status: 500 } });
  });
});

describe('getTournamentScoringState', () => {
  beforeEach(() => get.mockReset());

  it('calls the state route and keeps only enabled and applicable', async () => {
    get.mockResolvedValue({ data: { enabled: true, applicable: true, committee: { points: null }, is_committee: true } });
    expect(await getTournamentScoringState('t-1', { correlationId: 'c-1' })).toEqual({ enabled: true, applicable: true });
    expect(get).toHaveBeenCalledWith('/tournaments/t-1/scoring/state', { correlationId: 'c-1' });
  });

  it('returns null for a 404 and propagates other errors', async () => {
    get.mockRejectedValueOnce({ response: { status: 404 } });
    expect(await getTournamentScoringState('t-1')).toBeNull();
    get.mockRejectedValueOnce({ response: { status: 500 } });
    await expect(getTournamentScoringState('t-1')).rejects.toEqual({ response: { status: 500 } });
  });
});
