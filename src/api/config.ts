import { apiClient } from './client';

export interface GameLimits {
  players_min: number;
  players_max: number;
  /** Most groups one game can be shared with; absent on older servers (default 20). */
  max_groups_per_game?: number;
}

export interface ClientConfig {
  google_maps_api_key: string | null;
  venue_catalogue_enabled: boolean;
  /** tournament-registration AD-4: the fee control is hidden while this is false. */
  tournament_fee_enabled: boolean;
  tournament_fee_currency: string | null;
  tournament_fee_max_cents: number | null;
}

const CLIENT_CONFIG_DEFAULTS: ClientConfig = {
  google_maps_api_key: null,
  venue_catalogue_enabled: false,
  tournament_fee_enabled: false,
  tournament_fee_currency: null,
  tournament_fee_max_cents: null,
};

export async function getGameLimits(): Promise<GameLimits> {
  try {
    const { data } = await apiClient.get<GameLimits>('/config/game-limits');
    return data;
  } catch {
    return { players_min: 2, players_max: 100 };
  }
}

export async function getClientConfig(): Promise<ClientConfig> {
  try {
    const { data } = await apiClient.get<Partial<ClientConfig>>('/config/client');
    return {
      google_maps_api_key: data?.google_maps_api_key ?? null,
      venue_catalogue_enabled: Boolean(data?.venue_catalogue_enabled),
      tournament_fee_enabled: data?.tournament_fee_enabled === true,
      tournament_fee_currency:
        typeof data?.tournament_fee_currency === 'string' && data.tournament_fee_currency ? data.tournament_fee_currency : null,
      tournament_fee_max_cents:
        typeof data?.tournament_fee_max_cents === 'number' && Number.isFinite(data.tournament_fee_max_cents)
          ? data.tournament_fee_max_cents
          : null,
    };
  } catch {
    return { ...CLIENT_CONFIG_DEFAULTS };
  }
}
