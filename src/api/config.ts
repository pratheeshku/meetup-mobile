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
  /** teams-payments AD-8: the game fee control and the fee/payment UI of a game are hidden while this is false. */
  game_fee_enabled: boolean;
  game_fee_currency: string | null;
  game_fee_max_cents: number | null;
  /** team-size-capacity AD-3: the wizard's prefill for Maximum participants and Players per team; null when the server does not send them. */
  tournament_default_entrants_max: number | null;
  tournament_default_team_size: number | null;
  /** Admin store URLs for the share invite message; '' when unset (the store line is then omitted). */
  android_store_url: string;
  ios_store_url: string;
  /**
   * Deep-links AD-5, AD-11 (backend task 1.2, additive): the base of generated links and the switch
   * between the `/l/` form and the hash form. Both optional; absent on older servers.
   */
  link_base_url?: string | null;
  app_links_enabled?: boolean;
}

const CLIENT_CONFIG_DEFAULTS: ClientConfig = {
  google_maps_api_key: null,
  venue_catalogue_enabled: false,
  tournament_fee_enabled: false,
  tournament_fee_currency: null,
  tournament_fee_max_cents: null,
  game_fee_enabled: false,
  game_fee_currency: null,
  game_fee_max_cents: null,
  tournament_default_entrants_max: null,
  tournament_default_team_size: null,
  android_store_url: '',
  ios_store_url: '',
};

function positiveInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

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
      game_fee_enabled: data?.game_fee_enabled === true,
      game_fee_currency: typeof data?.game_fee_currency === 'string' && data.game_fee_currency ? data.game_fee_currency : null,
      game_fee_max_cents:
        typeof data?.game_fee_max_cents === 'number' && Number.isFinite(data.game_fee_max_cents) ? data.game_fee_max_cents : null,
      tournament_default_entrants_max: positiveInt(data?.tournament_default_entrants_max),
      tournament_default_team_size: positiveInt(data?.tournament_default_team_size),
      android_store_url: typeof data?.android_store_url === 'string' ? data.android_store_url.trim() : '',
      ios_store_url: typeof data?.ios_store_url === 'string' ? data.ios_store_url.trim() : '',
      link_base_url:
        typeof data?.link_base_url === 'string' && data.link_base_url.trim() ? data.link_base_url.trim() : null,
      app_links_enabled: data?.app_links_enabled === true,
    };
  } catch {
    return { ...CLIENT_CONFIG_DEFAULTS };
  }
}
