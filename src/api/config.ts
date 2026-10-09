import { apiClient } from './client';

export interface GameLimits {
  players_min: number;
  players_max: number;
}

export interface ClientConfig {
  google_maps_api_key: string | null;
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
    const { data } = await apiClient.get<ClientConfig>('/config/client');
    return data;
  } catch {
    return { google_maps_api_key: null };
  }
}
