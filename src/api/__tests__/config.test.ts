import { apiClient } from '../client';
import { getClientConfig, getGameLimits } from '../config';

jest.mock('../client', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

const mockedGet = apiClient.get as jest.Mock;

describe('getClientConfig & getGameLimits', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('parses venue_catalogue_enabled: true when returned by server', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        google_maps_api_key: 'AIzaSy12345',
        venue_catalogue_enabled: true,
      },
    });

    const config = await getClientConfig();
    expect(mockedGet).toHaveBeenCalledWith('/config/client');
    expect(config.venue_catalogue_enabled).toBe(true);
    expect(config.google_maps_api_key).toBe('AIzaSy12345');
  });

  it('defaults venue_catalogue_enabled to false when field is absent from server response', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        google_maps_api_key: 'AIzaSy12345',
      },
    });

    const config = await getClientConfig();
    expect(config.venue_catalogue_enabled).toBe(false);
  });

  it('defaults venue_catalogue_enabled to false when field is explicitly false', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        google_maps_api_key: null,
        venue_catalogue_enabled: false,
      },
    });

    const config = await getClientConfig();
    expect(config.venue_catalogue_enabled).toBe(false);
  });

  it('returns safe fallback defaults on API error', async () => {
    mockedGet.mockRejectedValueOnce(new Error('Network error'));

    const config = await getClientConfig();
    expect(config).toEqual({
      google_maps_api_key: null,
      venue_catalogue_enabled: false,
      tournament_fee_enabled: false,
      tournament_fee_currency: null,
      tournament_fee_max_cents: null,
      game_fee_enabled: false,
      game_fee_currency: null,
      game_fee_max_cents: null,
    });
  });

  it('returns default game limits on API error', async () => {
    mockedGet.mockRejectedValueOnce(new Error('Failed to fetch'));

    const limits = await getGameLimits();
    expect(limits).toEqual({ players_min: 2, players_max: 100 });
  });

  it('returns server game limits when successful', async () => {
    mockedGet.mockResolvedValueOnce({ data: { players_min: 4, players_max: 50 } });

    const limits = await getGameLimits();
    expect(limits).toEqual({ players_min: 4, players_max: 50 });
  });

  it('reads the game fee switch, currency and cap (teams-payments AD-8); off and null when absent', async () => {
    mockedGet.mockResolvedValueOnce({ data: { game_fee_enabled: true, game_fee_currency: 'SGD', game_fee_max_cents: 100000 } });
    expect(await getClientConfig()).toMatchObject({ game_fee_enabled: true, game_fee_currency: 'SGD', game_fee_max_cents: 100000 });
    mockedGet.mockResolvedValueOnce({ data: {} });
    expect(await getClientConfig()).toMatchObject({ game_fee_enabled: false, game_fee_currency: null, game_fee_max_cents: null });
    mockedGet.mockResolvedValueOnce({ data: { game_fee_enabled: 'true' } });
    expect((await getClientConfig()).game_fee_enabled).toBe(false);
  });
});
